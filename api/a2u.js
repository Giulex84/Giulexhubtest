export default async function handler(req, res) {
  console.log("A2U RAW BODY:", req.body);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount } = req.body || {};

  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "Invalid uid" });
  }

  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ error: "Missing PI_API_KEY" });
  }

  try {
    const createRes = await fetch(
      "https://api.testnet.minepi.com/v2/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid,
          amount: amt,
          memo: "Testnet A2U",
          metadata: {
            type: "a2u-test",
            uid,
            ts: Date.now(),
          },
        }),
      }
    );

    const created = await createRes.json();

    if (!createRes.ok) {
      console.error("CREATE ERROR:", created);
      return res.status(500).json(created);
    }

    const paymentId = created.identifier;

    const approveRes = await fetch(
      `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
        },
      }
    );

    const approved = await approveRes.json();

    if (!approveRes.ok) {
      console.error("APPROVE ERROR:", approved);
      return res.status(500).json(approved);
    }

    return res.status(200).json({
      success: true,
      paymentId,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
}
