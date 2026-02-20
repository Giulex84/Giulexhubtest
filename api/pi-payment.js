export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, paymentId, txid } = req.body;

  if (!action || !paymentId) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not set" });
  }

  // ⚠️ TESTNET ENDPOINT (giulexhub test)
  const BASE_URL = "https://api.minepi.com/v2/payments";

  let url = "";
  let payload = undefined;

  if (action === "approve") {
    url = `${BASE_URL}/${paymentId}/approve`;
  }
if (action === "complete" && !txid) {
  return res.status(400).json({ error: "Missing txid" });
}

  if (action === "complete") {
    url = `${BASE_URL}/${paymentId}/complete`;
    payload = { txid };
  }

  if (action === "cancel") {
    url = `${BASE_URL}/${paymentId}/cancel`;
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

    const data = await response.json();

    console.log("PI TEST RESPONSE:", data);

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("PI TEST ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
