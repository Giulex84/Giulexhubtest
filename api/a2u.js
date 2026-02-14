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

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not set" });
  }

  const BASE_URL = "https://api.minepi.com/v2/payments";

  try {
    // CREATE
    const createRes = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment: {
          amount: amount,
          memo: "A2U Test Payment",
          metadata: { source: "GiulexHubA2U" },
          uid: uid,
        },
      }),
    });

    const createData = await createRes.json();
    console.log("A2U CREATE RESPONSE:", createData);

    if (!createRes.ok) {
      return res.status(createRes.status).json(createData);
    }

    const paymentId = createData.identifier;

    // APPROVE
    await fetch(`${BASE_URL}/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
      },
    });

    return res.status(200).json({
      success: true,
      paymentId: paymentId,
    });

  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
