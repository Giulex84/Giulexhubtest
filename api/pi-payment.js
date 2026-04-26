export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, paymentId, txid } = req.body;
  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) return res.status(500).json({ error: "Chiave API mancante su Vercel" });

  const BASE_URL = "https://api.minepi.com/v2/payments";
  let url = "";
  let payload = null;

  if (action === "approve") {
    url = `${BASE_URL}/${paymentId}/approve`;
  } else if (action === "complete") {
    url = `${BASE_URL}/${paymentId}/complete`;
    payload = { txid };
  } else if (action === "cancel") {
    url = `${BASE_URL}/${paymentId}/cancel`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Server Error", details: error.message });
  }
}
