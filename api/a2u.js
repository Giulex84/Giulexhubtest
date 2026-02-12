export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: "Missing PI_API_KEY" });
  }

  const { recipient, amount } = req.body || {};

  if (!recipient || typeof recipient !== "string") {
    return res.status(400).json({ error: "Invalid recipient wallet address" });
  }

  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    // 1️⃣ CREATE A2U PAYMENT (Testnet endpoint)
    const createRes = await fetch("https://api.testnet.minepi.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payment: {
          amount: amt,
          recipient: recipient,
          memo: "Testnet A2U - Unlock App Wallet",
          metadata: {
            type: "a2u-testnet",
            ts: Date.now()
          }
        }
      })
    });

    const created = await createRes.json();
    console.log("CREATE RESPONSE:", created);

    if (!createRes.ok || !created.identifier) {
      return res.status(500).json({
        error: "Create failed",
        details: created
      });
    }

    const paymentId = created.identifier;

    // 2️⃣ APPROVE
    const approveRes = await fetch(
      `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const approved = await approveRes.json();
    console.log("APPROVE RESPONSE:", approved);

    if (!approveRes.ok) {
      return res.status(500).json({
        error: "Approve failed",
        details: approved
      });
    }

    // 3️⃣ COMPLETE
    const completeRes = await fetch(
      `https://api.testnet.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const completed = await completeRes.json();
    console.log("COMPLETE RESPONSE:", completed);

    if (!completeRes.ok) {
      return res.status(500).json({
        error: "Complete failed",
        details: completed
      });
    }

    return res.status(200).json({
      success: true,
      paymentId
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err });
  }
}
