"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
// @ts-nocheck
const crypto = require("crypto");
const { bearerFromRequest, arenaSessionFromRequest, verifyArenaSession, verifyAccessToken } = require("../lib/pi");
const { getGameState, saveGameState, getClassicLeaderboard, recordClassicResult, getDailyChallenge, acquireDailyLock, releaseDailyLock, flipDailyCard, getReplayCredits, startDailyChallenge, resetDailyChallenge, recordDailyResult, recordDailyCompletion, getDailyMeta, getDailyLeaderboard, getPvpMatch, savePvpMatch, getUserPvpMatch, setUserPvpMatch, clearUserPvpMatch, getPvpQueue, setPvpQueue, clearPvpQueue, acquirePvpLock, releasePvpLock, acquirePvpMatchLock, releasePvpMatchLock, flipPvpCard, isStoreConfigured } = require("../lib/store");
const { safeRecordMetric } = require("../lib/metrics");
const DAILY_SYMBOLS = ["⚔", "🔥", "🛡", "🏹", "👑", "💎"];
const MAX_MOVES = 18;
const today = () => new Date().toISOString().slice(0, 10);
function shuffle(values) { const a = [...values]; for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
} return a; }
function publicDaily(s) { const matchedValues = {}; for (const i of s.matched)
    matchedValues[i] = s.deck[i]; return { day: s.day, attemptId: s.attemptId || s.startedAt, status: s.status, moves: s.moves, maxMoves: MAX_MOVES, matches: s.matched.length / 2, matched: s.matched, matchedValues, firstIndex: s.firstIndex, firstValue: s.firstIndex === null ? null : s.deck[s.firstIndex], score: s.score }; }
function newPvpPlayer(uid, username, bot = false) { return { uid, username: username || "Pioneer", bot, matched: [], firstIndex: null, moves: 0, score: 0, status: bot ? "completed" : "active" }; }
function comparePvp(a, b) { if (a.status === "completed" && b.status !== "completed")
    return 1; if (b.status === "completed" && a.status !== "completed")
    return -1; if (a.moves !== b.moves)
    return a.moves < b.moves ? 1 : -1; if (a.score !== b.score)
    return a.score > b.score ? 1 : -1; return 0; }
function publicPvp(match, uid) { if (!match)
    return null; const own = match.players.find(p => p.uid === uid), opponent = match.players.find(p => p.uid !== uid); if (!own)
    return null; const matchedValues = {}; for (const i of own.matched)
    matchedValues[i] = match.deck[i]; const bothDone = opponent && own.status !== "active" && opponent.status !== "active", comparison = bothDone ? comparePvp(own, opponent) : null; return { id: match.id, status: match.status, maxMoves: MAX_MOVES, own: { status: own.status, moves: own.moves, score: own.score, matched: own.matched, matchedValues, firstIndex: own.firstIndex, firstValue: own.firstIndex === null ? null : match.deck[own.firstIndex], rematchRequested: Boolean(own.rematchRequested) }, opponent: opponent ? { username: opponent.username, bot: Boolean(opponent.bot), status: opponent.status, moves: opponent.moves, score: opponent.score, rematchRequested: Boolean(opponent.rematchRequested) } : null, result: comparison === null ? null : comparison > 0 ? "win" : comparison < 0 ? "loss" : "draw" }; }
async function reconcileWaitingPvp(user, existing) {
    let lockId;
    try {
        lockId = await acquirePvpLock();
    }
    catch (error) {
        if (error?.message === "Matchmaking is busy. Retry shortly.")
            return existing;
        throw error;
    }
    try {
        const current = await getUserPvpMatch(user.uid);
        if (current && current.status !== "waiting")
            return current;
        const own = current || existing;
        const queued = await getPvpQueue();
        if (queued && queued.uid !== user.uid) {
            const target = await getPvpMatch(queued.matchId);
            if (target && target.status === "waiting" && target.players.length === 1 && target.players[0].uid !== user.uid) {
                target.players.push(newPvpPlayer(user.uid, user.username));
                target.status = "active";
                target.matchedAt = new Date().toISOString();
                await savePvpMatch(target);
                await setUserPvpMatch(user.uid, target.id);
                await clearPvpQueue(target.id);
                return target;
            }
            await clearPvpQueue(queued.matchId);
        }
        if (own && own.status === "waiting") {
            await setPvpQueue({ uid: user.uid, matchId: own.id });
            return own;
        }
        return null;
    }
    finally {
        await releasePvpLock(lockId);
    }
}
async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });
    const sessionToken = arenaSessionFromRequest(req), token = bearerFromRequest(req);
    if (!sessionToken && !token)
        return res.status(401).json({ error: "Missing Arena session" });
    if (!isStoreConfigured())
        return res.status(503).json({ error: "Persistent store is not configured" });
    try {
        const user = sessionToken ? verifyArenaSession(sessionToken) : await verifyAccessToken(token), action = req.body?.action || "load";
        if (action === "load")
            return res.status(200).json({ state: await getGameState(user.uid) });
        if (action === "save")
            return res.status(200).json({ ok: true, state: await saveGameState(user.uid, req.body?.state || {}) });
        if (action === "classic-leaderboard")
            return res.status(200).json(await getClassicLeaderboard(user.uid));
        if (action === "classic-complete") {
            const level = Math.trunc(Number(req.body?.level)), score = Math.trunc(Number(req.body?.score)), lives = Math.trunc(Number(req.body?.lives));
            const current = await getGameState(user.uid), currentLevel = Math.max(1, Number(current?.level) || 1), currentScore = Math.max(0, Number(current?.score) || 0);
            if (!Number.isInteger(level) || level < 2 || level > 100 || level > currentLevel + 1)
                return res.status(400).json({ error: "Invalid Classic progression" });
            if (!Number.isInteger(score) || score < currentScore)
                return res.status(400).json({ error: "Invalid Classic score" });
            const leaderboard = await recordClassicResult(user.uid, level, score);
            await saveGameState(user.uid, { level, lives, score });
            return res.status(200).json(leaderboard);
        }
        const day = today();
        if (action === "client-event") {
            const event = String(req.body?.event || "");
            if (!new Set(["daily_viewed", "daily_timeout", "daily_recovered", "pvp_timeout", "pvp_recovered"]).has(event))
                return res.status(400).json({ error: "Invalid event" });
            await safeRecordMetric(user.uid, event, `${day}:${event}`);
            return res.status(200).json({ ok: true });
        }
        if (action === "daily-leaderboard")
            return res.status(200).json(await getDailyLeaderboard(user.uid, day));
        if (action === "daily-share") {
            await safeRecordMetric(user.uid, "daily_shared", `${day}:${user.uid}`);
            return res.status(200).json({ ok: true });
        }
        if (action === "daily-status") {
            let daily = await getDailyChallenge(user.uid, day);
            if (daily?.status === "completed") {
                await recordDailyResult(user.uid, day, daily);
                await recordDailyCompletion(user.uid, day);
                await safeRecordMetric(user.uid, "daily_completed", daily.completedAt || day, Math.max(1, Math.round((Date.parse(daily.completedAt) - Date.parse(daily.startedAt)) / 1000)), day);
            }
            if (daily?.status === "failed")
                await safeRecordMetric(user.uid, "daily_failed", daily.completedAt || day, 0, day);
            const meta = await getDailyMeta(user.uid, day);
            return res.status(200).json({ daily: daily ? publicDaily(daily) : null, meta, replayCredits: await getReplayCredits(user.uid) });
        }
        if (action === "daily-start") {
            const lockId = await acquireDailyLock(user.uid, day);
            try {
                let daily = await getDailyChallenge(user.uid, day);
                if (!daily) {
                    daily = { day, attemptId: crypto.randomUUID(), deck: shuffle([...DAILY_SYMBOLS, ...DAILY_SYMBOLS]), matched: [], firstIndex: null, moves: 0, score: 0, status: "active", startedAt: new Date().toISOString() };
                    daily = await startDailyChallenge(user.uid, day, daily, lockId);
                    await safeRecordMetric(user.uid, "daily_started", daily.startedAt, 0, day);
                }
                return res.status(200).json({ daily: publicDaily(daily), meta: await getDailyMeta(user.uid, day) });
            }
            finally {
                await releaseDailyLock(user.uid, day, lockId);
            }
        }
        if (action === "daily-reset") {
            if (req.body?.day && req.body.day !== day)
                return res.status(409).json({ error: "Daily day changed. Reload saved progress." });
            const lockId = await acquireDailyLock(user.uid, day);
            try {
                const daily = { day, attemptId: crypto.randomUUID(), deck: shuffle([...DAILY_SYMBOLS, ...DAILY_SYMBOLS]), matched: [], firstIndex: null, moves: 0, score: 0, status: "active", startedAt: new Date().toISOString(), replay: true };
                const replayCredits = await resetDailyChallenge(user.uid, day, daily, lockId, typeof req.body?.expectedAttemptId === "string" ? req.body.expectedAttemptId : "");
                await safeRecordMetric(user.uid, "daily_replay_started", daily.startedAt, 0, day);
                return res.status(200).json({ daily: publicDaily(daily), replayCredits, meta: await getDailyMeta(user.uid, day) });
            }
            finally {
                await releaseDailyLock(user.uid, day, lockId);
            }
        }
        if (action === "daily-flip") {
            if (req.body?.day && req.body.day !== day)
                return res.status(409).json({ error: "Daily day changed. Reload saved progress." });
            const index = Number(req.body?.index);
            if (!Number.isInteger(index) || index < 0 || index >= DAILY_SYMBOLS.length * 2)
                return res.status(400).json({ error: "Invalid card" });
            let expected = null;
            if (req.body?.expectedMoves !== undefined) {
                const moves = req.body.expectedMoves, firstIndex = req.body.expectedFirstIndex;
                if (!Number.isInteger(moves) || moves < 0 || moves > MAX_MOVES || (firstIndex !== null && (!Number.isInteger(firstIndex) || firstIndex < 0 || firstIndex >= 12)))
                    return res.status(400).json({ error: "Invalid Daily state expectation" });
                expected = { moves, firstIndex, attemptId: typeof req.body?.expectedAttemptId === "string" ? req.body.expectedAttemptId : "" };
            }
            const result = await flipDailyCard(user.uid, day, index, MAX_MOVES, expected), daily = result.daily;
            if (result.reveal?.pending && daily.moves === 0 && daily.matched.length === 0)
                await safeRecordMetric(user.uid, "daily_first_flip", day, 0, day);
            let meta = null;
            if (daily.status === "completed") {
                await recordDailyResult(user.uid, day, daily);
                if (result.reveal && !result.reveal.pending)
                    await recordDailyCompletion(user.uid, day);
                meta = await getDailyMeta(user.uid, day);
            }
            if (result.reveal && !result.reveal.pending && daily.status === "completed")
                await safeRecordMetric(user.uid, "daily_completed", daily.completedAt || day, Math.max(1, Math.round((Date.parse(daily.completedAt) - Date.parse(daily.startedAt)) / 1000)), day);
            if (result.reveal && !result.reveal.pending && daily.status === "failed")
                await safeRecordMetric(user.uid, "daily_failed", daily.completedAt || day, 0, day);
            return res.status(200).json({ daily: publicDaily(daily), meta, reveal: result.reveal });
        }
        if (action === "pvp-status") {
            let match = await getUserPvpMatch(user.uid);
            if (match?.status === "waiting")
                match = await reconcileWaitingPvp(user, match);
            return res.status(200).json({ pvp: publicPvp(match, user.uid) });
        }
        if (action === "pvp-start") {
            const existing = await getUserPvpMatch(user.uid);
            if (existing?.status === "waiting")
                return res.status(200).json({ pvp: publicPvp(await reconcileWaitingPvp(user, existing), user.uid) });
            const existingPlayer = existing?.players?.find(player => player.uid === user.uid);
            if (existing?.status === "active" && existingPlayer?.status === "active")
                return res.status(200).json({ pvp: publicPvp(existing, user.uid) });
            if (existing) {
                if (existingPlayer?.rematchRequested) {
                    existingPlayer.rematchRequested = false;
                    await savePvpMatch(existing);
                }
                await clearUserPvpMatch(user.uid);
            }
            const lockId = await acquirePvpLock();
            try {
                const queued = await getPvpQueue();
                if (queued && queued.uid !== user.uid) {
                    const match = await getPvpMatch(queued.matchId);
                    if (match && match.status === "waiting") {
                        match.players.push(newPvpPlayer(user.uid, user.username));
                        match.status = "active";
                        match.matchedAt = new Date().toISOString();
                        await savePvpMatch(match);
                        await setUserPvpMatch(user.uid, match.id);
                        await clearPvpQueue(match.id);
                        await safeRecordMetric(user.uid, "pvp_started", match.id);
                        return res.status(200).json({ pvp: publicPvp(match, user.uid) });
                    }
                    await clearPvpQueue(queued.matchId);
                }
                const match = { id: crypto.randomUUID(), status: "waiting", deck: shuffle([...DAILY_SYMBOLS, ...DAILY_SYMBOLS]), players: [newPvpPlayer(user.uid, user.username)], createdAt: new Date().toISOString() };
                await savePvpMatch(match);
                await setUserPvpMatch(user.uid, match.id);
                await setPvpQueue({ uid: user.uid, matchId: match.id });
                await safeRecordMetric(user.uid, "pvp_started", match.id);
                return res.status(200).json({ pvp: publicPvp(match, user.uid) });
            }
            finally {
                await releasePvpLock(lockId);
            }
        }
        if (action === "pvp-rematch") {
            const existing = await getUserPvpMatch(user.uid);
            const own = existing?.players?.find(player => player.uid === user.uid), opponent = existing?.players?.find(player => player.uid !== user.uid);
            if (!existing || !own || own.status === "active")
                return res.status(409).json({ error: "Finish the current duel before requesting a rematch" });
            if (!opponent || opponent.bot)
                return res.status(409).json({ error: "Arena Bot rematches use a new duel" });
            const lockId = await acquirePvpMatchLock(existing.id);
            try {
                const fresh = await getPvpMatch(existing.id), freshOwn = fresh?.players?.find(player => player.uid === user.uid), freshOpponent = fresh?.players?.find(player => player.uid !== user.uid);
                if (!fresh || !freshOwn || !freshOpponent)
                    return res.status(404).json({ error: "PvP match not found" });
                freshOwn.rematchRequested = true;
                if (freshOpponent.rematchRequested && freshOpponent.status !== "active") {
                    const [ownCurrent, opponentCurrent] = await Promise.all([getUserPvpMatch(freshOwn.uid), getUserPvpMatch(freshOpponent.uid)]);
                    if (ownCurrent?.id !== fresh.id || opponentCurrent?.id !== fresh.id)
                        return res.status(409).json({ error: "The opponent is no longer available for a rematch" });
                    const match = { id: crypto.randomUUID(), status: "active", deck: shuffle([...DAILY_SYMBOLS, ...DAILY_SYMBOLS]), players: [newPvpPlayer(freshOwn.uid, freshOwn.username), newPvpPlayer(freshOpponent.uid, freshOpponent.username)], createdAt: new Date().toISOString(), matchedAt: new Date().toISOString(), rematchOf: fresh.id };
                    await savePvpMatch(match);
                    await Promise.all(match.players.map(player => setUserPvpMatch(player.uid, match.id)));
                    await safeRecordMetric(user.uid, "pvp_started", match.id);
                    return res.status(200).json({ pvp: publicPvp(match, user.uid), rematchStarted: true });
                }
                await savePvpMatch(fresh);
                return res.status(200).json({ pvp: publicPvp(fresh, user.uid), rematchStarted: false });
            }
            finally {
                await releasePvpMatchLock(existing.id, lockId);
            }
        }
        if (action === "pvp-bot") {
            const match = await getUserPvpMatch(user.uid);
            if (!match || match.status !== "waiting")
                return res.status(409).json({ error: "No waiting PvP match" });
            const lockId = await acquirePvpMatchLock(match.id);
            try {
                const fresh = await getPvpMatch(match.id);
                if (fresh.status !== "waiting")
                    return res.status(200).json({ pvp: publicPvp(fresh, user.uid) });
                const botMoves = 12 + crypto.randomInt(7), bot = newPvpPlayer(`bot:${fresh.id}`, "Arena Bot", true);
                bot.moves = botMoves;
                bot.score = Math.max(100, 900 - botMoves * 25);
                fresh.players.push(bot);
                fresh.status = "active";
                fresh.matchedAt = new Date().toISOString();
                await savePvpMatch(fresh);
                await clearPvpQueue(fresh.id);
                await safeRecordMetric(user.uid, "pvp_bot_started", fresh.id);
                return res.status(200).json({ pvp: publicPvp(fresh, user.uid) });
            }
            finally {
                await releasePvpMatchLock(match.id, lockId);
            }
        }
        if (action === "pvp-flip") {
            const index = Number(req.body?.index);
            if (!Number.isInteger(index) || index < 0 || index >= DAILY_SYMBOLS.length * 2)
                return res.status(400).json({ error: "Invalid card" });
            const result = await flipPvpCard(user.uid, index, MAX_MOVES);
            const own = result.match.players.find(p => p.uid === user.uid);
            if (result.reveal && !result.reveal.pending && own?.status !== "active")
                await safeRecordMetric(user.uid, "pvp_completed", result.match.id);
            return res.status(200).json({ pvp: publicPvp(result.match, user.uid), reveal: result.reveal });
        }
        return res.status(400).json({ error: "Unknown action" });
    }
    catch (error) {
        return res.status(error?.message === "Unauthorized" ? 401 : (error?.statusCode || 500)).json({ error: error?.message || "Request failed" });
    }
}
;

module.exports = exports.default;
