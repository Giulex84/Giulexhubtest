// /api/a2u.js
// Pi Network A2U – TESTNET

export default async function handler(req, res) {
  console.log("A2U RAW BODY:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ error: "Missing PI_API_KEY" });
  }

  const { uid, amount } = req.body || {};

  if (!uid || !amount) {
    return res.status(400).json({ error: "Missing uid or amount" });
  }

  try {
    // ✅ TESTNET endpoint
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
            memo: "A2U Testnet transfer",
            metadata: {
              type: "a2u-testnet",
              uid: uid,
              ts: Date.now(),
            },
            uid: uid,
          },
        }),
      }
    );

    const created = await createRes.json();
    console.log("CREATE RESPONSE:", created);

    if (!createRes.ok) {
      return res.status(500).json({
        error: "Create failed",
        details: created,
      });
    }

    const paymentId = created.identifier;

    // 🔥 APPROVE
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
    console.log("APPROVE RESPONSE:", approved);

    if (!approveRes.ok) {
      return res.status(500).json({
        error: "Approve failed",
        details: approved,
      });
    }

    return res.status(200).json({
      success: true,
      paymentId,
    });

  } catch (err) {
    console.error("A2U EXCEPTION:", err);
    return res.status(500).json({
      error: "Backend exception",
      message: err.message,
    });
  }
}
