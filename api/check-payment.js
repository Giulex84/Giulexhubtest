module.exports = async function handler(req, res) {
  console.log("CHECK PAYMENT RAW BODY:", req.body);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentId } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: "Missing paymentId" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not set" });
  }

  const BASE_URL = `https://api.minepi.com/v2/payments/${paymentId}`;

  try {
    const r = await fetch(BASE_URL, {
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
      },
    });

    const data = await r.json();
    console.log("CHECK RESPONSE:", data);

    return res.status(200).json({
      transaction_verified: data.status?.transaction_verified || false,
      txid: data.transaction?.txid || null,
    });

  } catch (err) {
    console.error("CHECK ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

