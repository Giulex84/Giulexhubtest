import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount } = req.body;

  if (!uid || !amount) {
    return res.status(400).json({ error: "Missing uid or amount" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not configured" });
  }

  try {
    // 1️⃣ Create App → User payment (Testnet)
    const createRes = await fetch("https://api.minepi.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid,
        amount,
        memo: "A2U testnet payout",
        metadata: { type: "a2u_test" },
      }),
    });

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
          "Content-Type": "application/json",
        },
      }
    );

    // 3️⃣ Complete
    await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({ ok: true, paymentId });
  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({ error: "A2U failed" });
  }
}
