const StellarSdk = require("@stellar/stellar-sdk");

const {
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  BASE_FEE,
  Memo,
  Networks,
} = StellarSdk;

module.exports = async function handler(req, res) {
  console.log("A2U RAW BODY:", req.body);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount } = req.body;

  if (!uid || !amount) {
    return res.status(400).json({ error: "Missing uid or amount" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  const APP_SEED = process.env.PI_APP_WALLET_SEED;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not set" });
  }

  if (!APP_SEED) {
    return res.status(500).json({ error: "PI_APP_WALLET_SEED not set" });
  }

  const BASE_URL = "https://api.minepi.com/v2/payments";

  try {
    // ===============================
    // 1️⃣ CREATE PAYMENT
    // ===============================
    let createRes = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment: {
          amount,
          memo: "A2U Test Payment",
          metadata: { source: "GiulexHubA2U" },
          uid,
        },
      }),
    });

    let createData = await createRes.json();
    console.log("A2U CREATE RESPONSE:", createData);

    // ===============================
    // 🔥 AUTO CANCEL IF ONGOING
    // ===============================
    if (
      createData.error === "ongoing_payment_found" &&
      createData.payment?.identifier
    ) {
      const ongoingId = createData.payment.identifier;
      console.log("ONGOING FOUND → Cancelling:", ongoingId);

      await fetch(`${BASE_URL}/${ongoingId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
        },
      });

      console.log("ONGOING CANCELLED");

      // Retry create
      createRes = await fetch(BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment: {
            amount,
            memo: "A2U Test Payment",
            metadata: { source: "GiulexHubA2U" },
            uid,
          },
        }),
      });

      createData = await createRes.json();
      console.log("A2U RETRY CREATE:", createData);
    }

    if (!createRes.ok) {
      return res.status(createRes.status).json(createData);
    }

    const paymentId = createData.identifier;
    const destination = createData.to_address;

    // ===============================
    // 2️⃣ APPROVE
    // ===============================
    await fetch(`${BASE_URL}/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
      },
    });

    console.log("A2U APPROVED:", paymentId);

    // ===============================
    // 3️⃣ SUBMIT ON-CHAIN (AUTO SIGN)
    // ===============================
    const server = new StellarSdk.Horizon.Server(
      "https://api.testnet.minepi.com"
    );

    const keypair = Keypair.fromSecret(APP_SEED);
    const account = await server.loadAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addMemo(Memo.text(paymentId))
      .addOperation(
        Operation.payment({
          destination,
          asset: Asset.native(),
          amount: Number(amount).toFixed(7),
        })
      )
      .setTimeout(120)
      .build();

    tx.sign(keypair);

    const result = await server.submitTransaction(tx);
    const txid = result.hash;

    console.log("HORIZON TX SUCCESS:", txid);

    // ===============================
    // 4️⃣ COMPLETE
    // ===============================
    const completeRes = await fetch(
      `${BASE_URL}/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const completeData = await completeRes.json();
    console.log("A2U COMPLETE RESPONSE:", completeData);

    if (!completeRes.ok) {
      return res.status(completeRes.status).json(completeData);
    }

    return res.status(200).json({
      success: true,
      paymentId,
      txid,
    });
  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({
      error: "A2U processing failed",
      details: err.message,
    });
  }
};
