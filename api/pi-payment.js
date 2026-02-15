module.exports = async function handler(req, res) {
  console.log("PI PAYMENT RAW BODY:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, paymentId, txid } = req.body;

  if (!action || !paymentId) {
    return res.status(400).json({ error: "Missing action or paymentId" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not set" });
  }

  // ✅ PRODUZIONE CORRETTA
  const BASE_URL = "https://api.minepi.com/v2/payments/";

try {

  if (action === "approve") {
    const r = await fetch(`${BASE_URL}${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
      },
    });

    const data = await r.json();
    console.log("APPROVE RESPONSE:", data);

    return res.status(r.status).json(data);
  }

  if (action === "complete") {
  const r = await fetch(`${BASE_URL}${paymentId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txid }),
  });

  const data = await r.json();
  console.log("COMPLETE RESPONSE:", data);

  // 🔥 IDPOTENT SUCCESS
  if (data.error === "already_completed") {
    return res.status(200).json({
      success: true,
      message: "Payment already completed",
      payment: data.payment,
    });
  }

  if (!r.ok) {
    return res.status(r.status).json(data);
  }

  return res.status(200).json({
    success: true,
    payment: data,
  });
}


  if (action === "cancel") {
    const r = await fetch(`${BASE_URL}${paymentId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
      },
    });

    const data = await r.json();
    console.log("CANCEL RESPONSE:", data);

    return res.status(r.status).json(data);
  }

  return res.status(400).json({ error: "Unknown action" });

} catch (err) {
  console.error("SERVER ERROR:", err);
  return res.status(500).json({ error: "Server error" });
}
};
