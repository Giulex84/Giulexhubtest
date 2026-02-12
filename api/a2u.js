export default async function handler(req, res) {
  console.log("A2U RAW BODY:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount } = req.body || {};

  if (!uid || !amount) {
    return res.status(400).json({ error: "Missing uid or amount" });
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
          payment: {
            amount: Number(amount),
            memo: "A2U Testnet payment",
            metadata: {
              type: "a2u-testnet",
              timestamp: Date.now(),
            },
          },
          uid: uid,
        }),
      }
    );

    const createData = await createRes.json();
    console.log("CREATE RESPONSE:", createData);

    if (!createRes.ok) {
      return res.status(500).json({
        error: "Create failed",
        details: createData,
      });
    }

    const paymentId = createData.identifier;

    // APPROVE
    const approveRes = await fetch(
      `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
        },
      }
    );

    const approveData = await approveRes.json();
    console.log("APPROVE RESPONSE:", approveData);

    if (!approveRes.ok) {
      return res.status(500).json({
        error: "Approve failed",
        details: approveData,
      });
    }

    return res.status(200).json({
      success: true,
      paymentId,
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
}
