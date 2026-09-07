const { bearerFromRequest, verifyAccessToken } = require("../lib/pi");
const { getGameState, saveGameState, isStoreConfigured } = require("../lib/store");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = bearerFromRequest(req);
  if (!token) return res.status(401).json({ error: "Missing Pi access token" });
  if (!isStoreConfigured()) return res.status(503).json({ error: "Persistent store is not configured" });

  try {
    const user = await verifyAccessToken(token);
    const action = req.body?.action || "load";

    if (action === "load") {
      const state = await getGameState(user.uid);
      return res.status(200).json({ state });
    }

    if (action === "save") {
      const state = await saveGameState(user.uid, req.body?.state || {});
      return res.status(200).json({ ok: true, state });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    return res.status(401).json({ error: error?.message || "Pi authentication could not be verified" });
  }
};
