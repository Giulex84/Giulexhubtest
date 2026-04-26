export default async function handler(req, res) {
  // Accettiamo solo richieste POST dall'SDK
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, paymentId, txid } = req.body;

  // Verifica parametri minimi
  if (!action || !paymentId) {
    return res.status(400).json({ error: "Missing action or paymentId" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    console.error("ERRORE: PI_API_KEY non configurata su Vercel");
    return res.status(500).json({ error: "Server configuration error" });
  }

  // URL standard per le API di pagamento Pi (valido sia per Testnet che Mainnet)
  const BASE_URL = "https://api.minepi.com/v2/payments";

  let url = "";
  let payload = null;

  // Determina l'endpoint in base all'azione richiesta dall'SDK
  if (action === "approve") {
    url = `${BASE_URL}/${paymentId}/approve`;
  } else if (action === "complete") {
    if (!txid) {
      return res.status(400).json({ error: "Missing txid for completion" });
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
        "Authorization": `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PI API ERROR:", data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("PAYMENT SYSTEM ERROR:", error);
    return res.status(500).json({ error: "Internal server error during payment" });
  }
}
