export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, paymentId, txid } = req.body;

  if (!action || !paymentId) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // IMPORTANTE: Assicurati che su Vercel la variabile PI_API_KEY 
  // sia quella generata dalla Dashboard per la TESTNET
  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not set" });
  }

  // CORREZIONE QUI: URL specifico per la Testnet
  const BASE_URL = "https://api.minepi.com/v2/payments"; 

  let url = "";
  let payload = undefined;

  if (action === "approve") {
    url = `${BASE_URL}/${paymentId}/approve`;
  } else if (action === "complete") {
    if (!txid) {
      return res.status(400).json({ error: "Missing txid" });
    }
    url = `${BASE_URL}/${paymentId}/complete`;
    payload = { txid };
  } else if (action === "cancel") {
    url = `${BASE_URL}/${paymentId}/cancel`;
  } else {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    // Gestione errori dalla risposta dell'API di Pi
    if (!response.ok) {
      const errorData = await response.json();
      console.error("PI API ERROR DETAILS:", errorData);
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("PI PAYMENT SERVER ERROR:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
