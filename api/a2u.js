const StellarSdk = require("@stellar/stellar-sdk");
const {
  PI_API_BASE,
  REWARD_AMOUNT,
  REWARD_MEMO,
  bearerFromRequest,
  verifyAccessToken,
  getPayment,
  piPost,
  validateRewardPayment,
  getServerApiKey,
} = require("../lib/pi");
const {
  isStoreConfigured,
  beginRewardAttempt,
  releaseRewardAttempt,
  commitRewardAttempt,
  recordReward,
  getRewardReceipt,
} = require("../lib/store");

const HORIZON_URL = "https://api.testnet.minepi.com";
const NETWORK_PASSPHRASE = "Pi Testnet";

async function getIncompleteServerPayments() {
  const response = await fetch(`${PI_API_BASE}/payments/incomplete_server_payments`, {
    headers: { Authorization: `Key ${getServerApiKey()}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Could not inspect incomplete reward payments");
  return Array.isArray(data?.incomplete_server_payments) ? data.incomplete_server_payments : [];
}

function isArenaReward(payment, uid) {
  if (!payment || payment.user_uid !== uid) return false;
  if (payment.direction !== "app_to_user") return false;
  if (payment.network !== "Pi Testnet") return false;
  if (Number(payment.amount) !== REWARD_AMOUNT) return false;
  if (payment.memo !== REWARD_MEMO) return false;
  if (payment.metadata?.event !== "triple_combo") return false;
  if (payment.status?.cancelled || payment.status?.user_cancelled) return false;
  return true;
}

async function findSubmittedTransaction(server, sourceAddress, paymentId) {
  try {
    const page = await server.transactions().forAccount(sourceAddress).order("desc").limit(100).call();
    const match = page.records.find((tx) => tx.successful && tx.memo_type === "text" && tx.memo === paymentId);
    return match?.hash || null;
  } catch {
    return null;
  }
}

async function submitRewardTransaction(payment) {
  const paymentId = payment.identifier;
  const destination = payment.to_address;
  if (!paymentId || !destination) throw new Error("Pi returned an incomplete reward payment");

  const server = new StellarSdk.Horizon.Server(HORIZON_URL);
  const keypair = StellarSdk.Keypair.fromSecret(process.env.PI_APP_WALLET_SEED);
  const sourceAddress = keypair.publicKey();

  if (payment.from_address && payment.from_address !== sourceAddress) {
    throw new Error("Configured reward wallet does not match the Pi payment source wallet");
  }

  const existingTxid = await findSubmittedTransaction(server, sourceAddress, paymentId);
  if (existingTxid) return existingTxid;

  const account = await server.loadAccount(sourceAddress);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addMemo(StellarSdk.Memo.text(paymentId))
    .addOperation(StellarSdk.Operation.payment({
      destination,
      asset: StellarSdk.Asset.native(),
      amount: REWARD_AMOUNT.toFixed(7),
    }))
    .setTimeout(120)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function finalizeReward(payment, uid, recovered = false) {
  const invalid = validateRewardPayment(payment, uid);
  if (invalid) throw new Error(invalid);

  const paymentId = payment.identifier;
  const existingReceipt = await getRewardReceipt(paymentId);
  if (existingReceipt) {
    if (existingReceipt.uid !== uid) throw new Error("Reward receipt belongs to another user");
    return { paymentId, txid: existingReceipt.txid, recovered: true, alreadyRecorded: true };
  }

  if (payment.status?.developer_completed && payment.status?.transaction_verified) {
    const txid = payment.transaction?.txid || "verified";
    await recordReward(uid, paymentId, txid, { amount: REWARD_AMOUNT, recovered: true });
    return { paymentId, txid, recovered: true, alreadyRecorded: false };
  }

  let txid = payment.transaction?.txid || null;
  if (!txid) txid = await submitRewardTransaction(payment);

  const complete = await piPost(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid });
  const completeError = complete.data?.error;
  if (!complete.response.ok && completeError !== "already_completed") {
    throw new Error(completeError || "Reward completion failed");
  }

  const verified = await getPayment(paymentId);
  const verifiedInvalid = validateRewardPayment(verified, uid);
  if (verifiedInvalid) throw new Error(verifiedInvalid);
  if (!verified.status?.developer_completed || !verified.status?.transaction_verified) {
    throw new Error("Reward transaction is not fully verified yet");
  }

  await recordReward(uid, paymentId, txid, { amount: REWARD_AMOUNT, recovered });
  return { paymentId, txid, recovered, alreadyRecorded: false };
}

async function recoverExistingReward(uid) {
  const incomplete = await getIncompleteServerPayments();
  const matching = incomplete.find((payment) => isArenaReward(payment, uid));
  if (!matching) return null;
  return finalizeReward(matching, uid, true);
}

async function createReward(uid) {
  const response = await fetch(`${PI_API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Key ${getServerApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment: {
        amount: REWARD_AMOUNT,
        memo: REWARD_MEMO,
        metadata: { event: "triple_combo", source: "ArenaTest", uid },
        uid,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (data?.error === "ongoing_payment_found") {
      const recovered = await recoverExistingReward(uid);
      if (recovered) return recovered;
      throw new Error("Another Test-Pi server payment is still in progress. Retry shortly.");
    }
    throw new Error(data?.error || "Could not create reward payment");
  }

  return finalizeReward(data, uid, false);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isStoreConfigured()) return res.status(503).json({ error: "Reward storage is not configured" });
  if (!process.env.PI_APP_WALLET_SEED) return res.status(503).json({ error: "Testnet reward wallet is not configured" });
  if (req.body?.event !== "triple_combo") return res.status(400).json({ error: "Unsupported reward event" });

  const token = bearerFromRequest(req);
  if (!token) return res.status(401).json({ error: "Missing Pi access token" });

  let attempt = null;
  try {
    const user = await verifyAccessToken(token);

    // Recovery is deliberately outside quota/cooldown accounting: completing a
    // previously-created payment must never count as a second reward.
    const recovered = await recoverExistingReward(user.uid);
    if (recovered) {
      return res.status(200).json({
        success: true,
        phase: "verified",
        amount: REWARD_AMOUNT,
        paymentId: recovered.paymentId,
        txid: recovered.txid,
        recovered: true,
      });
    }

    // Reserve concurrency first. Daily quota/cooldown are committed only after
    // Pi has fully verified the reward, so failed attempts do not burn quota.
    attempt = await beginRewardAttempt(user.uid);
    const result = await createReward(user.uid);
    await commitRewardAttempt(user.uid, attempt.processId, attempt.day);
    attempt = null;

    return res.status(200).json({
      success: true,
      phase: "verified",
      amount: REWARD_AMOUNT,
      paymentId: result.paymentId,
      txid: result.txid,
      recovered: Boolean(result.recovered),
    });
  } catch (error) {
    const msg = error?.message || "Reward processing failed";
    console.error("A2U reward error:", msg);

    if (attempt) {
      try {
        const token2 = bearerFromRequest(req);
        const user2 = token2 ? await verifyAccessToken(token2) : null;
        if (user2) await releaseRewardAttempt(user2.uid, attempt.processId);
      } catch (releaseError) {
        console.error("A2U lock release error:", releaseError?.message || releaseError);
      }
    }

    if (msg === "Unauthorized") return res.status(401).json({ error: "Pi authentication could not be verified" });
    if (msg.includes("cooldown") || msg.includes("limit")) return res.status(429).json({ error: msg });
    if (msg.includes("processing already in progress") || msg.includes("still in progress") || msg.includes("not fully verified yet")) {
      return res.status(409).json({ error: msg, retryable: true, phase: "pending" });
    }
    if (msg.includes("does not belong") || msg.includes("Unexpected") || msg.includes("Malformed")) return res.status(409).json({ error: msg });
    if (msg.includes("wallet does not match")) return res.status(503).json({ error: msg });
    return res.status(500).json({ error: msg });
  }
};
