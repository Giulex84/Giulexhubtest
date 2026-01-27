import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount } = req.body;

  if (!uid || !amount) {
    return res.status(400).json({ error: "Missing uid or amount" });
  }

  const PI_API_KEY = process.env.PI_API_KEY; // Testnet API key
  const APP_WALLET_SECRET = process.env.PI_DEV_WALLET_SECRET_TESTNET;

  if (!PI_API_KEY || !APP_WALLET_SECRET) {
    return res.status(500).json({ error: "Env not configured" });
  }

  try {
    // 1️⃣ Crea pagamento App → User
    const createRes = await fetch(
      "https://api.minepi.com/v2/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          memo: "Testnet A2U reward",
          metadata: { reason: "a2u_test" },
          uid
        })
      }
    );

    const payment = await createRes.json();
    if (!createRes.ok) {
      return res.status(500).json(payment);
    }

    const paymentId = payment.identifier;

    // 2️⃣ Approve
    await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // 3️⃣ Complete
    await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "A2U failed" });
  }
}

