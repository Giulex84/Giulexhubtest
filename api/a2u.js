// /api/a2u.js

export default async function handler(req, res) {
  // Solo POST manuale (no GET, no UI)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ error: "Missing PI_API_KEY" });
  }

  const { uid, amount } = req.body || {};

  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "Invalid uid" });
  }

  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    // 1️⃣ CREATE A2U PAYMENT (App → User)
    const createRes = await fetch("https://api.minepi.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid,           // destinatario (utente Testnet)
        amount: amt,
        memo: "Testnet A2U – unlock App Wallet Mainnet",
        metadata: {
          type: "a2u-testnet",
          uid,
          ts: Date.now(),
        },
      }),
    });

    const created = await createRes.json();

    if (!createRes.ok || !created.identifier) {
      console.error("CREATE ERROR", created);
      return res
        .status(500)
        .json({ error: "Create failed", details: created });
    }

    const paymentId = created.identifier;

    // 2️⃣ APPROVE
    const approveRes = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const approved = await approveRes.json();

    if (!approveRes.ok) {
      console.error("APPROVE ERROR", approved);
      return res
        .status(500)
        .json({ error: "Approve failed", details: approved });
    }

    // 3️⃣ COMPLETE
    const completeRes = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const completed = await completeRes.json();

    if (!completeRes.ok) {
      console.error("COMPLETE ERROR", completed);
      return res
        .status(500)
        .json({ error: "Complete failed", details: completed });
    }

    // Tutto ok ✅
    return res.status(200).json({
      ok: true,
      uid,
      amount: amt,
      paymentId,
      status: completed.status,
    });
  } catch (err) {
    console.error("A2U EXCEPTION", err);
    return res.status(500).json({
      error: "A2U exception",
      details: err?.message || String(err),
    });
  }
}
