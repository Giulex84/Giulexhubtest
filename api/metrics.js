"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const crypto_1 = __importDefault(require("crypto"));
const store_1 = require("../lib/store");
const pi_1 = require("../lib/pi");
function authorizedBySecret(req) {
    const expected = process.env.ARENA_METRICS_KEY || "";
    const supplied = typeof req.headers["x-arena-metrics-key"] === "string" ? req.headers["x-arena-metrics-key"] : "";
    if (!expected || !supplied)
        return false;
    const a = Buffer.from(expected), b = Buffer.from(supplied);
    return a.length === b.length && crypto_1.default.timingSafeEqual(a, b);
}
async function authorizedByPi(req) {
    const token = (0, pi_1.bearerFromRequest)(req);
    if (!token)
        return false;
    const user = await (0, pi_1.verifyAccessToken)(token);
    const expectedUsername = (process.env.ARENA_ADMIN_USERNAME || "Giulex84").trim().toLowerCase();
    return Boolean(expectedUsername) && (user.username || "").trim().toLowerCase() === expectedUsername;
}
async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET")
        return res.status(405).json({ error: "Method not allowed" });
    let authorized = authorizedBySecret(req);
    if (!authorized) {
        try {
            authorized = await authorizedByPi(req);
        }
        catch {
            authorized = false;
        }
    }
    if (!authorized)
        return res.status(403).json({ error: "Forbidden" });
    if (!(0, store_1.isStoreConfigured)())
        return res.status(503).json({ error: "Persistent store is not configured" });
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
    try {
        return res.status(200).json({ generatedAt: new Date().toISOString(), retentionDays: 400, rows: await (0, store_1.getMetricsReport)(days) });
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Metrics request failed" });
    }
}

module.exports = exports.default;
