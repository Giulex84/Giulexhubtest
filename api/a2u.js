module.exports = async function handler(req, res) {
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

  try {
    const response = await fetch(
      "https://api.minepi.com/v2/payments",
      {
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
      }
    );

    const data = await response.json();
    console.log("A2U CREATE RESPONSE:", data);

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // -------- TRACK UNIQUE WALLETS --------
    globalThis.__A2U_WALLETS__ =
      globalThis.__A2U_WALLETS__ || new Set();

    if (
      data &&
      data.from_address &&
      data.status &&
      data.status.developer_approved === true
    ) {
      globalThis.__A2U_WALLETS__.add(data.from_address);
    }

    console.log(
      "UNIQUE WALLETS COUNT:",
      globalThis.__A2U_WALLETS__.size
    );

    console.log(
      "UNIQUE WALLETS LIST:",
      Array.from(globalThis.__A2U_WALLETS__)
    );

    return res.status(200).json(data);

  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
