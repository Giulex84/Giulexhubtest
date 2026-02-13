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

  const BASE_URL = "https://api.minepi.com/v2/payments";

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

    // -------- TRACK UNIQUE WALLETS (NON ROMPE NULLA) --------
    if (r.ok && data && data.from_address) {
      globalThis.__A2U_WALLETS__ =
        globalThis.__A2U_WALLETS__ || new Set();

      globalThis.__A2U_WALLETS__.add(data.from_address);

      console.log(
        "UNIQUE WALLETS COUNT:",
        globalThis.__A2U_WALLETS__.size
      );

      console.log(
        "UNIQUE WALLETS LIST:",
        Array.from(globalThis.__A2U_WALLETS__)
      );
    }

    return res.status(r.status).json(data);

  } catch (err) {
    console.error("A2U ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
