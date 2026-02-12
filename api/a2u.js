export default async function handler(req, res) {
  console.log("A2U RAW BODY:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount } = req.body;

  if (!uid || !amount) {
    return res.status(400).json({ error: "Missing uid or amount" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  const paymentData = {
    amount: amount,
    memo: "GiulexHub Test Payment",
    metadata: { uid: uid },
    uid: uid
  };

  try {
    const response = await fetch(
      "https://api.testnet.minepi.com/v2/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(paymentData)
      }
    );

    const data = await response.json();
    console.log("CREATE RESPONSE:", data);

    if (!response.ok) {
      return res.status(500).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
