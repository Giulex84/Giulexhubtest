"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const pi_1 = require("../lib/pi");
const store_1 = require("../lib/store");
const metrics_1 = require("../lib/metrics");
async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });
    const token = (0, pi_1.bearerFromRequest)(req);
    if (!token)
        return res.status(401).json({ error: "Missing Pi access token" });
    let user;
    try { user = await (0, pi_1.verifyAccessToken)(token); }
    catch { return res.status(401).json({ error: "Pi authentication could not be verified" }); }
    try {
        const storeReady = (0, store_1.isStoreConfigured)();
        if (!storeReady) return res.status(503).json({error:"The service is temporarily unavailable"});
        if (storeReady) {
            const requestedSource = typeof req.body?.source === "string" ? req.body.source.toLowerCase() : "direct";
            const source = ["fireside", "staking", "share"].includes(requestedSource) ? requestedSource : "direct";
            await (0, store_1.saveProfile)(user.uid, user.username || null);
            await Promise.all([(0, metrics_1.safeRecordMetric)(user.uid, "login"), (0, metrics_1.safeRecordMetric)(user.uid, `source_${source}`, new Date().toISOString().slice(0, 10))]);
        }
        const loginReward=await store_1.recordLoginReward(user.uid);
        return res.status(200).json({
            loginReward,
            uid: user.uid,
            username: user.username || null,
            premium: storeReady ? await (0, store_1.hasPremium)(user.uid) : false,
            replayCredits: storeReady ? await (0, store_1.getReplayCredits)(user.uid) : 0,
            storeReady,
            arenaSession: (0, pi_1.issueArenaSession)(user.uid, user.username || null),
        });
    }
    catch {
        return res.status(503).json({ error: "The service is temporarily unavailable" });
    }
}

module.exports = exports.default;

