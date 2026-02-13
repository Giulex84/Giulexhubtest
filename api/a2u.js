export default async function handler(req, res) {
  console.log("A2U RAW BODY:", req.body);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount } = req.body;

  if (!uid || !amount) {
    return res.status(400).json({ error: "Missing uid or amount" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  const BASE_URL = "https://api.minepi.com/v2/payments"; // NOT testnet

  try {
    const r = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payment: {
          amount: amount,
          memo: "A2U Test Payment",
          metadata: { source: "GiulexHubA2U" },
          uid: uid
        }
      })
    });

    const data = await r.json();
    console.log("A2U CREATE RESPONSE:", data);

    return res.status(r.status).json(data);

  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}






api/pi-payent.js



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

      if (!r.ok) {
        return res.status(500).json(data);
      }

      return res.status(200).json(data);
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

      if (!r.ok) {
        return res.status(500).json(data);
      }

      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Unknown action" });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
