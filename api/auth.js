const { bearerFromRequest, verifyAccessToken } = require("../lib/pi");
const { hasPremium, isStoreConfigured } = require("../lib/store");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = bearerFromRequest(req);
  if (!token) return res.status(401).json({ error: "Missing Pi access token" });

  try {
    const user = await verifyAccessToken(token);
    const premium = isStoreConfigured() ? await hasPremium(user.uid) : false;
    return res.status(200).json({
      uid: user.uid,
      username: user.username || null,
      premium,
      storeReady: isStoreConfigured(),
    });
  } catch {
    return res.status(401).json({ error: "Pi authentication could not be verified" });
  }
};
