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
const { isStoreConfigured, acquireRewardPermit, recordReward } = require("../lib/store");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isStoreConfigured()) return res.status(503).json({ error: "Reward storage is not configured" });
  if (!process.env.PI_APP_WALLET_SEED) return res.status(503).json({ error: "Testnet reward wallet is not configured" });
  if (req.body?.event !== "triple_combo") return res.status(400).json({ error: "Unsupported reward event" });

  const token = bearerFromRequest(req);
  if (!token) return res.status(401).json({ error: "Missing Pi access token" });

  try {
    const user = await verifyAccessToken(token);
    await acquireRewardPermit(user.uid);

    const createRes = await fetch(`${PI_API_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Key ${getServerApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment: {
          amount: REWARD_AMOUNT,
          memo: REWARD_MEMO,
          metadata: { event: "triple_combo", source: "ArenaTest" },
          uid: user.uid,
        },
      }),
    });
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const message = createData?.error === "ongoing_payment_found"
        ? "A Test-Pi reward is already in progress. Try again after it settles."
        : (createData?.error || "Could not create reward payment");
      return res.status(createRes.status).json({ error: message });
    }

    const paymentId = createData.identifier;
    const destination = createData.to_address;
    if (!paymentId || !destination) return res.status(502).json({ error: "Pi returned an incomplete reward payment" });

    const approve = await piPost(`/payments/${encodeURIComponent(paymentId)}/approve`);
    if (!approve.response.ok) return res.status(approve.response.status).json({ error: approve.data?.error || "Reward approval failed" });

    const server = new StellarSdk.Horizon.Server("https://api.testnet.minepi.com");
    const keypair = StellarSdk.Keypair.fromSecret(process.env.PI_APP_WALLET_SEED);
    const account = await server.loadAccount(keypair.publicKey());
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: "Pi Testnet",
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
    const txid = result.hash;

    const complete = await piPost(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid });
    if (!complete.response.ok) return res.status(complete.response.status).json({ error: complete.data?.error || "Reward completion failed" });

    const verified = await getPayment(paymentId);
    const invalid = validateRewardPayment(verified, user.uid);
    if (invalid) return res.status(409).json({ error: invalid });
    if (!verified.status?.developer_completed || !verified.status?.transaction_verified) {
      return res.status(409).json({ error: "Reward transaction is not fully verified" });
    }

    await recordReward(user.uid, paymentId, txid);
    return res.status(200).json({ success: true, amount: REWARD_AMOUNT, paymentId, txid });
  } catch (error) {
    const msg = error?.message || "Reward processing failed";
    if (msg === "Unauthorized") return res.status(401).json({ error: "Pi authentication could not be verified" });
    if (msg.includes("cooldown") || msg.includes("limit")) return res.status(429).json({ error: msg });
    return res.status(500).json({ error: "Reward processing failed" });
  }
};
