function config() {
  const url =
    process.env.ARENA_KV_KV_REST_API_URL ||
    process.env.ARENA_KV_REDIS_URL ||
    process.env.ARENA_KV_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.ARENA_KV_KV_REST_API_TOKEN ||
    process.env.ARENA_KV_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function isStoreConfigured() {
  return Boolean(config());
}

async function command(parts) {
  const cfg = config();
  if (!cfg) throw new Error("Persistent store is not configured");
  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || "Store request failed");
  return payload?.result;
}

const premiumKey = (uid) => `arena:test:premium:${uid}`;
const paymentKey = (paymentId) => `arena:test:payment:${paymentId}`;
const rewardLockKey = (uid) => `arena:test:reward-lock:${uid}`;
const rewardDayKey = (uid, day) => `arena:test:reward-day:${day}:${uid}`;
const rewardReceiptKey = (paymentId) => `arena:test:reward:${paymentId}`;
const gameStateKey = (uid) => `arena:test:game:${uid}`;

async function hasPremium(uid) {
  if (!isStoreConfigured()) return false;
  return (await command(["GET", premiumKey(uid)])) === "1";
}

async function claimPayment(uid, paymentId) {
  const key = paymentKey(paymentId);
  const created = await command(["SET", key, uid, "NX"]);
  if (created === "OK") return true;
  const existing = await command(["GET", key]);
  if (existing !== uid) throw new Error("Payment already belongs to another user");
  return false;
}

async function grantPremium(uid, paymentId) {
  await claimPayment(uid, paymentId);
  await command(["SET", premiumKey(uid), "1"]);
}

async function getGameState(uid) {
  if (!isStoreConfigured()) return null;
  const raw = await command(["GET", gameStateKey(uid)]);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      level: Number(parsed.level) || 1,
      lives: Number.isFinite(Number(parsed.lives)) ? Number(parsed.lives) : 5,
      score: Number(parsed.score) || 0,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return null;
  }
}

async function saveGameState(uid, state) {
  const level = Math.max(1, Math.min(100, Math.trunc(Number(state?.level) || 1)));
  const lives = Math.max(0, Math.min(999, Math.trunc(Number(state?.lives) || 0)));
  const score = Math.max(0, Math.min(1000000000, Math.trunc(Number(state?.score) || 0)));
  const value = JSON.stringify({ level, lives, score, updatedAt: new Date().toISOString() });
  await command(["SET", gameStateKey(uid), value]);
  return { level, lives, score };
}

async function acquireRewardPermit(uid) {
  const lock = await command(["SET", rewardLockKey(uid), "1", "NX", "EX", 60]);
  if (lock !== "OK") throw new Error("Reward cooldown active");

  const day = new Date().toISOString().slice(0, 10);
  const key = rewardDayKey(uid, day);
  const count = Number(await command(["INCR", key]));
  if (count === 1) await command(["EXPIRE", key, 172800]);
  if (count > 20) throw new Error("Daily Test-Pi reward limit reached");
  return count;
}

async function recordReward(uid, paymentId, txid) {
  await command(["SET", rewardReceiptKey(paymentId), JSON.stringify({ uid, txid, at: new Date().toISOString() })]);
}

module.exports = {
  isStoreConfigured,
  hasPremium,
  claimPayment,
  grantPremium,
  getGameState,
  saveGameState,
  acquireRewardPermit,
  recordReward,
};
