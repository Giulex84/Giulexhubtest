// /api/a2u.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    console.error("Missing PI_API_KEY");
    return res.status(500).json({ error: "Missing PI_API_KEY" });
  }

  const { uid, amount } = req.body || {};

  if (!uid) {
    console.error("UID missing");
    return res.status(400).json({ error: "UID missing" });
  }

  if (!amount) {
    console.error("Amount missing");
    return res.status(400).json({ error: "Amount missing" });
  }

  try {
    // 1️⃣ CREATE PAYMENT (Testnet endpoint)
    const createRes = await fetch(
      "https://api.testnet.minepi.com/v2/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment: {
            amount: Number(amount),
            memo: "Test A2U payment",
            metadata: {
              uid,
            },
            uid,
          },
        }),
      }
    );

    const created = await createRes.json();

    if (!createRes.ok) {
      console.error("CREATE ERROR:", created);
      return res.status(400).json(created);
    }

    const paymentId = created.identifier;

    // 2️⃣ APPROVE
    const approveRes = await fetch(
      `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const approved = await approveRes.json();

    if (!approveRes.ok) {
      console.error("APPROVE ERROR:", approved);
      return res.status(400).json(approved);
    }

    return res.status(200).json({
      success: true,
      paymentId,
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err });
  }
}
