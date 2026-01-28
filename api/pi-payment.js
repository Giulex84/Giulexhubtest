/**
 * Pi Network Payments Backend – Testnet
 * Canonical, headless, isolated
 *
 * Env required (Vercel):
 * - PI_API_KEY   (Testnet API Key)
 *
 * Supported actions:
 * - approve
 * - complete
 */

export default async function handler(req, res) {
  // 🔍 LOG CHIAVE — NON TOCCARE ALTRO
  console.log("PI PAYMENT RAW BODY:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { action, paymentId, txid } = body;

  if (!action || !paymentId) {
    return res.status(400).json({ error: "Missing action or paymentId" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not configured" });
  }

  const BASE_URL = "https://api.minepi.com/v2/payments/";
  const headers = {
    Authorization: `Key ${PI_API_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    if (action === "approve") {
      const r = await fetch(`${BASE_URL}${paymentId}/approve`, {
        method: "POST",
        headers,
      });

      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({
          error: "Approve failed",
          details: t,
        });
      }

      return res.status(200).json({ ok: true, stage: "approved" });
    }

    if (action === "complete") {
      if (!txid) {
        return res.status(400).json({ error: "Missing txid for completion" });
      }

      const r = await fetch(`${BASE_URL}${paymentId}/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ txid }),
      });

      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({
          error: "Complete failed",
          details: t,
        });
      }

      return res.status(200).json({ ok: true, stage: "completed" });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({
      error: "Backend exception",
      message: err?.message || "Unknown error",
    });
  }
}
