"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeRecordMetric = safeRecordMetric;
const crypto_1 = __importDefault(require("crypto"));
const pi_1 = require("./pi");
const store_1 = require("./store");
const EVENTS = new Set([
    "login",
    "daily_started",
    "daily_completed",
    "daily_failed",
    "daily_replay_started",
    "daily_shared",
    "daily_viewed",
    "daily_first_flip",
    "daily_timeout",
    "daily_recovered",
    "pvp_timeout",
    "pvp_recovered",
    "pvp_started",
    "pvp_bot_started",
    "pvp_completed",
    "premium_purchased",
    "replay_purchased",
    "source_fireside",
    "source_staking",
    "source_share",
    "source_direct",
]);
const day = () => new Date().toISOString().slice(0, 10);
const pseudonym = (value) => crypto_1.default.createHmac("sha256", (0, pi_1.getServerApiKey)()).update(value).digest("hex");
async function safeRecordMetric(uid, event, dedupeId = "", value = 0, eventDay = day()) {
    if (!uid || !EVENTS.has(event) || !/^\d{4}-\d{2}-\d{2}$/.test(eventDay))
        return false;
    try {
        const subject = pseudonym(`user:${uid}`);
        const dedupe = dedupeId ? pseudonym(`event:${uid}:${event}:${dedupeId}`) : "";
        return await (0, store_1.recordMetric)(eventDay, subject, event, dedupe, value);
    }
    catch {
        return false;
    }
}
