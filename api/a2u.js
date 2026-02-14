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
  if (!PI_API_KEY) {
    return res.status(500).json({ error: "PI_API_KEY not configured" });
  }

  const BASE = "https://api.minepi.com/v2/payments";

  async function createA2U() {
    const r = await fetch(BASE, {
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

    const data = await r.json();
    console.log("A2U CREATE RESPONSE:", data);
    return { r, data };
  }

  async function cancelPayment(paymentId) {
    const r = await fetch(`${BASE}/${paymentId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Key ${PI_API_KEY}` },
    });
    const data = await r.json();
    console.log("A2U CANCEL RESPONSE:", data);
    return { r, data };
  }

  try {
    // 1) First attempt
    let { r, data } = await createA2U();

    // Success
    if (r.ok) {
      // log identifier sempre
      if (data?.identifier) console.log("A2U IDENTIFIER:", data.identifier);
      return res.status(200).json(data);
    }

    // 2) If ongoing payment found: cancel it and retry once
    if (data?.error === "ongoing_payment_found" && data?.payment?.identifier) {
      const pendingId = data.payment.identifier;
      console.log("A2U ONGOING FOUND, pendingId:", pendingId);

      // cancel pending
      await cancelPayment(pendingId);

      // retry once
      const retry = await createA2U();
      if (retry.r.ok) {
        if (retry.data?.identifier) console.log("A2U IDENTIFIER:", retry.data.identifier);
        return res.status(200).json(retry.data);
      }

      return res.status(retry.r.status).json(retry.data);
    }

    // Other errors
    return res.status(r.status).json(data);
  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
