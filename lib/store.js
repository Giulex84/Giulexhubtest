"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStoreConfigured = isStoreConfigured;
exports.hasPremium = hasPremium;
exports.claimPayment = claimPayment;
exports.grantPremium = grantPremium;
exports.getGameState = getGameState;
exports.saveGameState = saveGameState;
exports.getClassicLeaderboard = getClassicLeaderboard;
exports.recordClassicResult = recordClassicResult;
exports.getDailyChallenge = getDailyChallenge;
exports.saveDailyChallenge = saveDailyChallenge;
exports.acquireDailyLock = acquireDailyLock;
exports.releaseDailyLock = releaseDailyLock;
exports.flipDailyCard = flipDailyCard;
exports.getReplayCredits = getReplayCredits;
exports.grantReplayCredit = grantReplayCredit;
exports.consumeReplayCredit = consumeReplayCredit;
exports.startDailyChallenge = startDailyChallenge;
exports.resetDailyChallenge = resetDailyChallenge;
exports.saveProfile = saveProfile;
exports.recordDailyAttempt = recordDailyAttempt;
exports.getDailyBest = getDailyBest;
exports.recordDailyResult = recordDailyResult;
exports.recordDailyCompletion = recordDailyCompletion;
exports.getDailyMeta = getDailyMeta;
exports.getDailyLeaderboard = getDailyLeaderboard;
exports.getPvpMatch = getPvpMatch;
exports.savePvpMatch = savePvpMatch;
exports.getUserPvpMatch = getUserPvpMatch;
exports.setUserPvpMatch = setUserPvpMatch;
exports.clearUserPvpMatch = clearUserPvpMatch;
exports.getPvpQueue = getPvpQueue;
exports.setPvpQueue = setPvpQueue;
exports.clearPvpQueue = clearPvpQueue;
exports.acquirePvpLock = acquirePvpLock;
exports.releasePvpLock = releasePvpLock;
exports.acquirePvpMatchLock = acquirePvpMatchLock;
exports.releasePvpMatchLock = releasePvpMatchLock;
exports.flipPvpCard = flipPvpCard;
exports.markPaymentPending = markPaymentPending;
exports.recordMetric = recordMetric;
exports.getMetricsReport = getMetricsReport;
// @ts-nocheck
function config() {
    const url = process.env.ARENA_KV_KV_REST_API_URL || process.env.ARENA_KV_REDIS_URL || process.env.ARENA_KV_REST_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.ARENA_KV_KV_REST_API_TOKEN || process.env.ARENA_KV_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token)
        return null;
    return { url: url.replace(/\/$/, ""), token };
}
function isStoreConfigured() { return Boolean(config()); }
async function command(parts) {
    const cfg = config();
    if (!cfg)
        throw new Error("Persistent store is not configured");
    const response = await fetch(cfg.url, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: JSON.stringify(parts), cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error)
        throw new Error(payload?.error || "Store request failed");
    return payload?.result;
}
const premiumKey = (uid) => `arena:test:premium:${uid}`;
const paymentKey = (paymentId) => `arena:test:payment:${paymentId}`;
const gameStateKey = (uid) => `arena:test:game:${uid}`;
const dailyKey = (uid, day) => `arena:test:daily:${day}:${uid}`;
const dailyLockKey = (uid, day) => `arena:test:daily-lock:${day}:${uid}`;
const replayCreditsKey = (uid) => `arena:test:daily-replay-credits:${uid}`;
const replayFulfilledKey = (paymentId) => `arena:test:daily-replay-fulfilled:${paymentId}`;
const profileKey = (uid) => `arena:test:profile:${uid}`;
const classicBestKey = (uid, week) => `arena:test:classic-best:${week}:${uid}`;
const classicCompletionKey = (uid, week, level) => `arena:test:classic-complete:${week}:${level}:${uid}`;
const classicLeaderboardKey = (week) => `arena:test:classic-leaderboard:${week}`;
const dailyAttemptsKey = (uid, day) => `arena:test:daily-attempts:${day}:${uid}`;
const dailyBestKey = (uid, day) => `arena:test:daily-best:${day}:${uid}`;
const dailyLeaderboardKey = (day) => `arena:test:daily-leaderboard:${day}`;
const dailyStreakKey = (uid) => `arena:test:daily-streak:${uid}`;
const pvpMatchKey = (id) => `arena:test:pvp:match:${id}`;
const pvpUserKey = (uid) => `arena:test:pvp:user:${uid}`;
const pvpQueueKey = "arena:test:pvp:queue";
const pvpLockKey = "arena:test:pvp:matchmaking-lock";
const pvpMatchLockKey = (id) => `arena:test:pvp:lock:${id}`;
const metricsUniqueKey = (day) => `arena:test:metrics:unique:${day}`;
const metricsEventsKey = (day) => `arena:test:metrics:events:${day}`;
const metricsDedupeKey = (id) => `arena:test:metrics:dedupe:${id}`;
const metricsEventUsersKey = (day, event) => `arena:test:metrics:event-users:${day}:${event}`;
const metricsNewUsersKey = (day) => `arena:test:metrics:new-users:${day}`;
const metricsReturningUsersKey = (day) => `arena:test:metrics:returning-users:${day}`;
const metricsFirstSeenKey = (subject) => `arena:test:metrics:first-seen:${subject}`;
const metricsTimingsKey = (day) => `arena:test:metrics:timings:${day}`;
async function hasPremium(uid) { if (!isStoreConfigured())
    return false; return (await command(["GET", premiumKey(uid)])) === "1"; }
async function claimPayment(uid, paymentId) { const key = paymentKey(paymentId), created = await command(["SET", key, uid, "NX"]); if (created === "OK")
    return true; const existing = await command(["GET", key]); if (existing !== uid)
    throw new Error("Payment already belongs to another user"); return false; }
async function grantPremium(uid, paymentId) { await claimPayment(uid, paymentId); await command(["SET", premiumKey(uid), "1"]); }
async function getGameState(uid) { if (!isStoreConfigured())
    return null; const raw = await command(["GET", gameStateKey(uid)]); if (!raw)
    return null; try {
    const p = JSON.parse(raw);
    return { level: Number(p.level) || 1, lives: Number.isFinite(Number(p.lives)) ? Number(p.lives) : 5, score: Number(p.score) || 0, updatedAt: p.updatedAt || null };
}
catch {
    return null;
} }
async function saveGameState(uid,state){return commitClassicProgress(uid,state,false);}

function matchedIndices(value) {
    if (Array.isArray(value))
        return value;
    if (value && typeof value === "object" && Object.keys(value).length === 0)
        return [];
    const error = new Error("Stored matched cards require review");
    error.statusCode = 503;
    throw error;
}
function normalizeDaily(state) { state.matched = matchedIndices(state.matched); return state; }
function normalizePvp(match) { for (const player of match.players)
    player.matched = matchedIndices(player.matched); return match; }
async function getDailyChallenge(uid, day) { const raw = await command(["GET", dailyKey(uid, day)]); if (raw === null || raw === undefined)
    return null; try {
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object" || !Array.isArray(state.deck))
        throw new Error("Invalid Daily state");
    return normalizeDaily(state);
}
catch {
    const error = new Error("Stored Daily data requires review");
    error.statusCode = 503;
    throw error;
} }
async function saveDailyChallenge(uid, day, state) { await command(["SET", dailyKey(uid, day), JSON.stringify(state), "EX", 259200]); return state; }
async function acquireDailyLock(uid, day) { const id = `${Date.now()}:${Math.random().toString(36).slice(2)}`; const ok = await command(["SET", dailyLockKey(uid, day), id, "NX", "EX", 10]); if (ok !== "OK")
    throw new Error("Daily challenge request already in progress"); return id; }
async function releaseDailyLock(uid, day, id) { const script = 'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end'; await command(["EVAL", script, 1, dailyLockKey(uid, day), id]); }
async function flipDailyCard(uid, day, index, maxMoves, expected = null) {
    const script = `
local raw=redis.call("GET",KEYS[1])
if not raw then return cjson.encode({error="Start today's challenge first",code=409}) end
local daily=cjson.decode(raw)
if daily.status~="active" then return cjson.encode({daily=daily}) end
if ARGV[4]~="" then
  local expectedFirst=ARGV[5]
  local currentFirst=daily.firstIndex==cjson.null and "null" or tostring(daily.firstIndex)
  if tonumber(daily.moves)~=tonumber(ARGV[4]) or currentFirst~=expectedFirst then return cjson.encode({error="Daily state changed. Reload saved progress.",code=409}) end
end
if ARGV[6]~="" and (daily.attemptId or daily.startedAt)~=ARGV[6] then return cjson.encode({error="Daily attempt changed. Reload saved progress.",code=409}) end
local idx=tonumber(ARGV[1])
if not idx or idx<0 or idx>=#daily.deck then return cjson.encode({error="Invalid card",code=400}) end
for _,matchedIndex in ipairs(daily.matched) do if tonumber(matchedIndex)==idx then return cjson.encode({error="Card is already visible",code=409}) end end
if daily.firstIndex~=cjson.null and tonumber(daily.firstIndex)==idx then return cjson.encode({error="Card is already visible",code=409}) end
local value=daily.deck[idx+1]
local reveal={index=idx,value=value,pending=true}
if daily.firstIndex==cjson.null then
  daily.firstIndex=idx
else
  local firstIndex=tonumber(daily.firstIndex)
  local firstValue=daily.deck[firstIndex+1]
  local isMatch=firstValue==value
  daily.firstIndex=cjson.null
  daily.moves=(tonumber(daily.moves) or 0)+1
  if isMatch then
    table.insert(daily.matched,firstIndex)
    table.insert(daily.matched,idx)
    daily.score=(tonumber(daily.score) or 0)+math.max(20,120-daily.moves*4)
  end
  if #daily.matched==#daily.deck then
    daily.status="completed"
    daily.score=daily.score+math.max(0,(tonumber(ARGV[2])-daily.moves)*25)
    daily.completedAt=ARGV[3]
  elseif daily.moves>=tonumber(ARGV[2]) then
    daily.status="failed"
    daily.completedAt=ARGV[3]
  end
  reveal={index=idx,value=value,firstIndex=firstIndex,firstValue=firstValue,matched=isMatch,pending=false}
end
redis.call("SET",KEYS[1],cjson.encode(daily),"EX",259200)
return cjson.encode({daily=daily,reveal=reveal})`;
    const raw = await command(["EVAL", script, 1, dailyKey(uid, day), index, maxMoves, new Date().toISOString(), expected ? String(expected.moves) : "", expected ? String(expected.firstIndex) : "", expected?.attemptId || ""]);
    const result = JSON.parse(raw);
    if (result?.error) {
        const error = new Error(result.error);
        error.statusCode = Number(result.code) || 409;
        throw error;
    }
    result.daily = normalizeDaily(result.daily);
    return result;
}
async function getReplayCredits(uid) { return Math.max(0, Number((await command(["GET", replayCreditsKey(uid)])) || 0)); }
async function grantReplayCredit(uid, paymentId) {
    const script = `
local owner=redis.call("GET",KEYS[1])
if owner and owner~=ARGV[1] then return redis.error_reply("Payment already belongs to another user") end
local fulfilled=redis.call("GET",KEYS[2])
if fulfilled and fulfilled~=ARGV[1] then return redis.error_reply("Replay fulfillment belongs to another user") end
local balance=redis.call("GET",KEYS[3])
if balance and (not tonumber(balance) or tonumber(balance)<0 or tonumber(balance)>=9007199254740991 or tonumber(balance)%1~=0) then return redis.error_reply("Replay balance requires review") end
redis.call("SET",KEYS[1],ARGV[1])
if not fulfilled then
  redis.call("SET",KEYS[2],ARGV[1])
  redis.call("INCR",KEYS[3])
end
return tonumber(redis.call("GET",KEYS[3]) or "0")`;
    return Number(await command(["EVAL", script, 3, paymentKey(paymentId), replayFulfilledKey(paymentId), replayCreditsKey(uid), uid]));
}
async function startDailyChallenge(uid, day, state, lockId) {
    const script = `
if redis.call("GET",KEYS[3])~=ARGV[2] then return redis.error_reply("Daily lock expired. Reload saved progress.") end
local current=redis.call("GET",KEYS[1])
if current then return current end
local attempts=redis.call("GET",KEYS[2])
if attempts and (not tonumber(attempts) or tonumber(attempts)<0 or tonumber(attempts)>=9007199254740991 or tonumber(attempts)%1~=0) then return redis.error_reply("Daily attempts require review") end
redis.call("SET",KEYS[1],ARGV[1],"EX",259200)
redis.call("INCR",KEYS[2])
redis.call("EXPIRE",KEYS[2],259200)
return ARGV[1]`;
    return JSON.parse(await command(["EVAL", script, 3, dailyKey(uid, day), dailyAttemptsKey(uid, day), dailyLockKey(uid, day), JSON.stringify(state), lockId]));
}
async function resetDailyChallenge(uid, day, state, lockId, expectedAttemptId = "") {
    const script = `
if redis.call("GET",KEYS[4])~=ARGV[2] then return redis.error_reply("Daily lock expired. Reload saved progress.") end
if ARGV[3]~="" then
  local raw=redis.call("GET",KEYS[2])
  if not raw then return redis.error_reply("Daily attempt changed. Reload saved progress.") end
  local old=cjson.decode(raw)
  if (old.attemptId or old.startedAt)~=ARGV[3] then return redis.error_reply("Daily attempt changed. Reload saved progress.") end
end
local credits=tonumber(redis.call("GET",KEYS[1]) or "0")
if not credits or credits<1 then return redis.error_reply("A Daily Replay Ticket is required") end
local attempts=redis.call("GET",KEYS[3])
if attempts and (not tonumber(attempts) or tonumber(attempts)<0 or tonumber(attempts)>=9007199254740991 or tonumber(attempts)%1~=0) then return redis.error_reply("Daily attempts require review") end
redis.call("DECR",KEYS[1])
redis.call("SET",KEYS[2],ARGV[1],"EX",259200)
redis.call("INCR",KEYS[3])
redis.call("EXPIRE",KEYS[3],259200)
return credits-1`;
    return Number(await command(["EVAL", script, 4, replayCreditsKey(uid), dailyKey(uid, day), dailyAttemptsKey(uid, day), dailyLockKey(uid, day), JSON.stringify(state), lockId, expectedAttemptId]));
}
async function consumeReplayCredit(uid) { const count = await getReplayCredits(uid); if (count < 1)
    throw new Error("A Daily Replay Ticket is required"); await command(["DECR", replayCreditsKey(uid)]); return count - 1; }
async function saveProfile(uid, username) { const value = JSON.stringify({ uid, username: typeof username === "string" ? username.slice(0, 64) : null }); await command(["SET", profileKey(uid), value]); }
function classicWeekStart(now=new Date()){const date=new Date(now),offset=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-offset);return date.toISOString().slice(0,10);}
function maxClassicScore(levelReached){const completed=Math.max(0,Math.trunc(Number(levelReached)||1)-1);return (completed>=1?60:0)+Math.min(2,Math.max(0,completed-1))*770+Math.max(0,completed-3)*1150;}
const classicAwardKey=week=>`arena:test:classic-awards-v1:${week}`;
const classicBadgesKey=uid=>`arena:test:classic-badges-v1:${uid}`;
const classicAwardWeeksKey="arena:test:classic-award-weeks-v1";
async function closeClassicWeeks(currentWeek=classicWeekStart()){
  const weeks=await command(["SMEMBERS",classicAwardWeeksKey]);
  for(const week of weeks||[]){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||week<CLASSIC_WEEKLY_EFFECTIVE||week>=currentWeek)continue;
    const script=`
if redis.call("EXISTS",KEYS[2])==1 then return 0 end
local rows=redis.call("ZREVRANGE",KEYS[1],0,-1,"WITHSCORES")
local winners={}; local previous=nil; local rank=0
for i=1,#rows,2 do
 local score=math.floor(tonumber(rows[i+1])/1000)
 if score~=previous then rank=(i+1)/2; previous=score end
 if rank>3 then break end
 if score>0 then
  local uid=rows[i]; local name="Pioneer"; local profile=redis.call("GET",ARGV[2]..uid)
  if profile then local ok,p=pcall(cjson.decode,profile); if not ok then return redis.error_reply("Winner profile requires review") end; name=p.username or name end
  local badge={week=ARGV[1],rank=rank,score=score,username=name,awardedAt=ARGV[4]}
  local kind=redis.call("TYPE",ARGV[3]..uid).ok
  if kind~="none" and kind~="hash" then return redis.error_reply("Badges require review") end
  table.insert(winners,{uid=uid,badge=badge})
 end
end
for _,winner in ipairs(winners) do redis.call("HSET",ARGV[3]..winner.uid,ARGV[1],cjson.encode(winner.badge)) end
redis.call("SET",KEYS[2],cjson.encode({week=ARGV[1],winners=winners,closedAt=ARGV[4]}))
return #winners`;
    await command(["EVAL",script,2,activeClassicLeaderboardKey(week),classicAwardKey(week),week,"arena:test:profile:","arena:test:classic-badges-v1:",new Date().toISOString()]);
  }
}
async function getClassicAwards(uid){
  const raw=await command(["HVALS",classicBadgesKey(uid)]);
  const badges=(raw||[]).map(x=>JSON.parse(x)).sort((a,b)=>b.week.localeCompare(a.week));
  const weeks=(await command(["SMEMBERS",classicAwardWeeksKey])||[]).filter(w=>w<classicWeekStart()).sort().reverse().slice(0,8);
  const hall=[];for(const week of weeks){const raw=await command(["GET",classicAwardKey(week)]);if(raw){const a=JSON.parse(raw);hall.push({week,winners:(Array.isArray(a.winners)?a.winners:[]).map(w=>({rank:w.badge.rank,score:w.badge.score,username:w.badge.username}))});}}
  return {badges,hall};
}
async function getClassicLeaderboard(uid,week=classicWeekStart()){
  if(week>=CLASSIC_WEEKLY_EFFECTIVE){
    const register=`if redis.call("EXISTS",KEYS[1])==1 then local ids=redis.call("ZRANGE",KEYS[1],0,-1); redis.call("PERSIST",KEYS[1]);for _,id in ipairs(ids) do redis.call("PERSIST",ARGV[2]..id) end;redis.call("SADD",KEYS[2],ARGV[1]) end;return 1`;
    await command(["EVAL",register,2,activeClassicLeaderboardKey(week),classicAwardWeeksKey,week,"arena:test:classic-weekly-v2:"+week+":"]);
  }
  await closeClassicWeeks();
  const script=`
local rows=redis.call("ZREVRANGE",KEYS[1],0,9,"WITHSCORES"); local entries={}
for i=1,#rows,2 do
 local score=math.floor(tonumber(rows[i+1])/1000)
 local rank=redis.call("ZCOUNT",KEYS[1],"("..tostring(score*1000+999),"+inf")+1
 table.insert(entries,{uid=rows[i],rank=rank})
end
local own=redis.call("ZSCORE",KEYS[1],ARGV[1]);local position=cjson.null
if own then position=redis.call("ZCOUNT",KEYS[1],"("..tostring(math.floor(tonumber(own)/1000)*1000+999),"+inf")+1 end
return cjson.encode({entries=entries,position=position})`;
  const result=JSON.parse(await command(["EVAL",script,1,activeClassicLeaderboardKey(week),uid]));
  const list=Array.isArray(result.entries)?result.entries:[],keys=[];
  for(const e of list)keys.push(profileKey(e.uid),activeClassicBestKey(e.uid,week));
  const values=keys.length?await command(["MGET",...keys]):[];
  const leaders=list.map((e,index)=>{const profile=values?.[index*2]?JSON.parse(values[index*2]):null,best=values?.[index*2+1]?JSON.parse(values[index*2+1]):null;return{rank:e.rank,username:profile?.username||"Pioneer",score:best?.score||0,level:best?.level||1};});
  const ownRaw=await command(["GET",activeClassicBestKey(uid,week)]),ownBest=ownRaw?JSON.parse(ownRaw):null;
  return{week,leaders,position:result.position,ownBest,...await getClassicAwards(uid)};
}
// New keys preserve historical rankings and prevent legacy lifetime totals entering new weeks.
const CLASSIC_WEEKLY_EFFECTIVE = "2026-10-12";
const activeClassicBestKey=(uid,week)=>week>=CLASSIC_WEEKLY_EFFECTIVE?`arena:test:classic-weekly-v2:${week}:${uid}`:classicBestKey(uid,week);
const activeClassicLeaderboardKey=week=>week>=CLASSIC_WEEKLY_EFFECTIVE?`arena:test:classic-weekly-board-v2:${week}`:classicLeaderboardKey(week);
const classicWeeklyPointsKey=(uid,week)=>`arena:test:classic-weekly-points-v2:${week}:${uid}`;
async function commitClassicProgress(uid,state,completed=false){
  const level=Number(state?.level),lives=Number(state?.lives),score=Number(state?.score);
  if(!Number.isSafeInteger(level)||level<1||level>=Number.MAX_SAFE_INTEGER||!Number.isInteger(lives)||lives<0||lives>999||!Number.isInteger(score)||score<0||score>1000000000){const e=new Error("Invalid Classic state");e.statusCode=400;throw e;}
  const now=new Date(),week=classicWeekStart(now);
  const script=`
if redis.call("EXISTS",KEYS[6])==1 then return redis.error_reply("Weekly period changed. Retry saved progress.") end
local raw=redis.call("GET",KEYS[1])
local old={level=1,lives=5,score=0}
if raw then local ok,value=pcall(cjson.decode,raw); if not ok or type(value)~="table" or not tonumber(value.score) or not tonumber(value.level) then return redis.error_reply("Stored Classic progress requires review") end; old=value end
local score=tonumber(ARGV[1]); local level=tonumber(ARGV[2]); local oldScore=tonumber(old.score); local oldLevel=tonumber(old.level)
local stale=score<oldScore
if stale then
 if ARGV[6]~="1" or level>oldLevel then return cjson.encode(old) end
 score=oldScore; level=oldLevel
end
local delta=score-oldScore
if level>oldLevel+1 then
 -- One-time catch-up for sessions rejected by the former level-100 cap.
 -- Keep ordinary progression strict; bound both completed-level count and score.
 local gap=level-oldLevel
 if oldLevel~=100 or delta<100*(gap-1) or delta>1150*(gap+1) then return redis.error_reply("Invalid Classic progression") end
end
if delta>tonumber(ARGV[5]) then return redis.error_reply("Classic score is outside the valid range") end
local points=tonumber(redis.call("GET",KEYS[2]) or "0")
if not points or points<0 then return redis.error_reply("Weekly points require review") end
points=points+delta
local bestRaw=redis.call("GET",KEYS[3]); local best=nil
if bestRaw then local ok,value=pcall(cjson.decode,bestRaw); if not ok or type(value)~="table" then return redis.error_reply("Weekly ranking requires review") end; best=value end
local next={level=math.max(level,oldLevel),lives=tonumber(ARGV[3]),score=score,updatedAt=ARGV[4]}
if stale then next=old end
if score==oldScore and level<oldLevel then return cjson.encode(old) end
local boardType=redis.call("TYPE",KEYS[4]).ok
if boardType~="none" and boardType~="zset" then return redis.error_reply("Weekly ranking requires review") end
local publish=ARGV[6]=="1" or best~=nil
local encoded=cjson.encode(next)
redis.call("SET",KEYS[1],encoded)
redis.call("SET",KEYS[2],tostring(points),"EX",1209600)
if publish and points>0 then
 local entry={level=next.level,score=points,completedAt=ARGV[4],scoring="weekly-earned-v2"}
 redis.call("SET",KEYS[3],cjson.encode(entry))
 redis.call("ZADD",KEYS[4],points*1000+math.min(next.level,999),ARGV[7])
 redis.call("PERSIST",KEYS[4])
 redis.call("SADD",KEYS[5],ARGV[8])
end
return encoded`;
  return JSON.parse(await command(["EVAL",script,6,gameStateKey(uid),classicWeeklyPointsKey(uid,week),activeClassicBestKey(uid,week),activeClassicLeaderboardKey(week),classicAwardWeeksKey,classicAwardKey(week),score,level,lives,now.toISOString(),maxClassicScore(level+1),completed?"1":"0",uid,week]));
}
async function recordClassicResult(uid,levelReached,scoreValue,lives=5){
  await commitClassicProgress(uid,{level:Number(levelReached),score:Number(scoreValue),lives:Number(lives)},true);
  return getClassicLeaderboard(uid);
}
async function recordDailyAttempt(uid, day) { const count = Number(await command(["INCR", dailyAttemptsKey(uid, day)])); if (count === 1)
    await command(["EXPIRE", dailyAttemptsKey(uid, day), 259200]); return count; }
async function getDailyBest(uid, day) { const raw = await command(["GET", dailyBestKey(uid, day)]); if (!raw)
    return null; try {
    return JSON.parse(raw);
}
catch {
    return null;
} }
function isBetterDailyResult(next, current) { return !current || next.moves < current.moves || (next.moves === current.moves && next.score > current.score); }
async function recordDailyResult(uid, day, result) {
    const next = { moves: Math.max(0, Math.trunc(Number(result.moves) || 0)), score: Math.max(0, Math.trunc(Number(result.score) || 0)), completedAt: result.completedAt || new Date().toISOString() };
    const script = `
local raw=redis.call("GET",KEYS[1])
local next=cjson.decode(ARGV[1])
local best=next
if raw then
  local current=cjson.decode(raw)
  if current.moves<next.moves or (current.moves==next.moves and current.score>=next.score) then best=current end
end
local value=cjson.encode(best)
redis.call("SET",KEYS[1],value,"EX",259200)
redis.call("ZADD",KEYS[2],best.moves*1000000-best.score,ARGV[2])
redis.call("EXPIRE",KEYS[2],259200)
return value`;
    return JSON.parse(await command(["EVAL", script, 2, dailyBestKey(uid, day), dailyLeaderboardKey(day), JSON.stringify(next), uid]));
}
async function getDailyStreak(uid) { const raw = await command(["GET", dailyStreakKey(uid)]); if (!raw)
    return { count: 0, lastDay: null }; try {
    const value = JSON.parse(raw);
    return { count: Math.max(0, Number(value?.count) || 0), lastDay: typeof value?.lastDay === "string" ? value.lastDay : null };
}
catch {
    return { count: 0, lastDay: null };
} }
async function recordDailyCompletion(uid, day) { const previousDay = new Date(`${day}T00:00:00.000Z`); previousDay.setUTCDate(previousDay.getUTCDate() - 1); const yesterday = previousDay.toISOString().slice(0, 10); const script = 'local raw=redis.call("GET",KEYS[1]); local count=0; local last=nil; if raw then local ok,obj=pcall(cjson.decode,raw); if ok then count=tonumber(obj["count"]) or 0; last=obj["lastDay"] end end; if last and last>=ARGV[1] then return cjson.encode({count=count,lastDay=last}) end; if last==ARGV[2] then count=count+1 else count=1 end; local next=cjson.encode({count=count,lastDay=ARGV[1]}); redis.call("SET",KEYS[1],next,"EX",ARGV[3]); return next'; const raw = await command(["EVAL", script, 1, dailyStreakKey(uid), day, yesterday, 34560000]); try {
    return JSON.parse(raw);
}
catch {
    return { count: 1, lastDay: day };
} }
async function getDailyMeta(uid, day) { const [attempts, best, streak] = await Promise.all([command(["GET", dailyAttemptsKey(uid, day)]), getDailyBest(uid, day), getDailyStreak(uid)]); return { attempts: Math.max(0, Number(attempts) || 0), best, streak }; }
async function getDailyLeaderboard(uid, day) { const ids = await command(["ZRANGE", dailyLeaderboardKey(day), 0, 9]), list = Array.isArray(ids) ? ids : []; if (!list.length)
    return { leaders: [], position: null }; const keys = []; for (const id of list)
    keys.push(profileKey(id), dailyBestKey(id, day)); const values = await command(["MGET", ...keys]); const leaders = list.map((id, index) => { let profile = null, best = null; try {
    profile = values?.[index * 2] ? JSON.parse(values[index * 2]) : null;
}
catch { } try {
    best = values?.[index * 2 + 1] ? JSON.parse(values[index * 2 + 1]) : null;
}
catch { } return { rank: index + 1, username: profile?.username || "Pioneer", moves: best?.moves || 0, score: best?.score || 0 }; }); const ownRank = await command(["ZRANK", dailyLeaderboardKey(day), uid]); return { leaders, position: ownRank === null ? null : Number(ownRank) + 1 }; }
async function getPvpMatch(id) { if (!id)
    return null; const raw = await command(["GET", pvpMatchKey(id)]); if (!raw)
    return null; try {
    return normalizePvp(JSON.parse(raw));
}
catch {
    const error = new Error("Stored PvP data requires review");
    error.statusCode = 503;
    throw error;
} }
async function savePvpMatch(match) { await command(["SET", pvpMatchKey(match.id), JSON.stringify(match), "EX", 172800]); return match; }
async function getUserPvpMatch(uid) { const id = await command(["GET", pvpUserKey(uid)]); return id ? getPvpMatch(id) : null; }
async function setUserPvpMatch(uid, id) { await command(["SET", pvpUserKey(uid), id, "EX", 172800]); }
async function clearUserPvpMatch(uid) { await command(["DEL", pvpUserKey(uid)]); }
async function getPvpQueue() { const raw = await command(["GET", pvpQueueKey]); if (!raw)
    return null; try {
    return JSON.parse(raw);
}
catch {
    return null;
} }
async function setPvpQueue(value) { await command(["SET", pvpQueueKey, JSON.stringify(value), "EX", 3600]); }
async function clearPvpQueue(id) { const script = 'local v=redis.call("GET",KEYS[1]); if not v then return 0 end; local ok,obj=pcall(cjson.decode,v); if ok and obj["matchId"]==ARGV[1] then return redis.call("DEL",KEYS[1]) end; return 0'; await command(["EVAL", script, 1, pvpQueueKey, id]); }
async function acquirePvpLock() { const id = `${Date.now()}:${Math.random().toString(36).slice(2)}`, ok = await command(["SET", pvpLockKey, id, "NX", "EX", 10]); if (ok !== "OK")
    throw new Error("Matchmaking is busy. Retry shortly."); return id; }
async function releasePvpLock(id) { const script = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end'; await command(["EVAL", script, 1, pvpLockKey, id]); }
async function acquirePvpMatchLock(matchId) { const id = `${Date.now()}:${Math.random().toString(36).slice(2)}`, ok = await command(["SET", pvpMatchLockKey(matchId), id, "NX", "EX", 10]); if (ok !== "OK")
    throw new Error("PvP move already in progress"); return id; }
async function releasePvpMatchLock(matchId, id) { const script = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end'; await command(["EVAL", script, 1, pvpMatchLockKey(matchId), id]); }
async function flipPvpCard(uid, index, maxMoves) {
    const script = `
local matchId=redis.call("GET",KEYS[1])
if not matchId then return cjson.encode({error="Start a PvP match first",code=409}) end
local matchKey=ARGV[1]..matchId
local raw=redis.call("GET",matchKey)
if not raw then return cjson.encode({error="PvP match not found",code=404}) end
local match=cjson.decode(raw)
if match.status=="waiting" then return cjson.encode({error="Waiting for an opponent or choose Arena Bot",code=409}) end
local player=nil
for _,candidate in ipairs(match.players) do if candidate.uid==ARGV[2] then player=candidate break end end
if not player then return cjson.encode({error="PvP player not found",code=404}) end
if player.status~="active" then return cjson.encode({match=match}) end
local idx=tonumber(ARGV[3])
if not idx or idx<0 or idx>=#match.deck then return cjson.encode({error="Invalid card",code=400}) end
for _,matchedIndex in ipairs(player.matched) do if tonumber(matchedIndex)==idx then return cjson.encode({error="Card is already visible",code=409}) end end
if player.firstIndex~=cjson.null and tonumber(player.firstIndex)==idx then return cjson.encode({error="Card is already visible",code=409}) end
local value=match.deck[idx+1]
local reveal={index=idx,value=value,pending=true}
if player.firstIndex==cjson.null then
  player.firstIndex=idx
else
  local firstIndex=tonumber(player.firstIndex)
  local firstValue=match.deck[firstIndex+1]
  local isMatch=firstValue==value
  player.firstIndex=cjson.null
  player.moves=(tonumber(player.moves) or 0)+1
  if isMatch then
    table.insert(player.matched,firstIndex)
    table.insert(player.matched,idx)
    player.score=(tonumber(player.score) or 0)+math.max(20,120-player.moves*4)
  end
  if #player.matched==#match.deck then
    player.status="completed"
    player.score=player.score+math.max(0,(tonumber(ARGV[4])-player.moves)*25)
  elseif player.moves>=tonumber(ARGV[4]) then player.status="failed" end
  if #match.players==2 and match.players[1].status~="active" and match.players[2].status~="active" then match.status="completed" end
  reveal={index=idx,value=value,firstIndex=firstIndex,firstValue=firstValue,matched=isMatch,pending=false}
end
redis.call("SET",matchKey,cjson.encode(match),"EX",172800)
return cjson.encode({match=match,reveal=reveal})`;
    const raw = await command(["EVAL", script, 1, pvpUserKey(uid), "arena:test:pvp:match:", uid, index, maxMoves]);
    const result = JSON.parse(raw);
    if (result?.error) {
        const error = new Error(result.error);
        error.statusCode = Number(result.code) || 409;
        throw error;
    }
    result.match = normalizePvp(result.match);
    return result;
}
async function markPaymentPending(uid, paymentId) { await claimPayment(uid, paymentId); }
async function recordMetric(){return false;}
async function getMetricsReport(days) {
    const count = Math.max(1, Math.min(90, Math.trunc(Number(days) || 30))), keys = [], labels = [];
    const dateAt = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    for (let offset = 0; offset < count; offset++) {
        const date = dateAt(offset);
        labels.push(date);
        keys.push(metricsUniqueKey(date), metricsEventsKey(date), metricsNewUsersKey(date), metricsReturningUsersKey(date), metricsEventUsersKey(date, "daily_started"), metricsEventUsersKey(date, "daily_completed"), metricsEventUsersKey(date, "pvp_started"), metricsEventUsersKey(date, "pvp_completed"), metricsTimingsKey(date), metricsEventUsersKey(dateAt(offset - 1), "login"), metricsEventUsersKey(dateAt(offset - 3), "login"), metricsEventUsersKey(dateAt(offset - 7), "login"));
    }
    const script = `local out={}; for i=1,#KEYS,12 do local unique=redis.call("PFCOUNT",KEYS[i]); local events=redis.call("HGETALL",KEYS[i+1]); local timings=redis.call("HGETALL",KEYS[i+8]); table.insert(out,{unique=unique,events=events,newUsers=redis.call("SCARD",KEYS[i+2]),returningUsers=redis.call("SCARD",KEYS[i+3]),dailyStarters=redis.call("SCARD",KEYS[i+4]),dailyCompleters=redis.call("SCARD",KEYS[i+5]),pvpStarters=redis.call("SCARD",KEYS[i+6]),pvpCompleters=redis.call("SCARD",KEYS[i+7]),timings=timings,d1=#redis.call("SINTER",KEYS[i+2],KEYS[i+9]),d3=#redis.call("SINTER",KEYS[i+2],KEYS[i+10]),d7=#redis.call("SINTER",KEYS[i+2],KEYS[i+11])}) end; return cjson.encode(out)`;
    const rows = JSON.parse(await command(["EVAL", script, keys.length, ...keys]));
    return labels.map((day, index) => { const row = rows[index] || {}, pairs = row.events || [], timingPairs = row.timings || [], events = {}, timings = {}; for (let i = 0; i < pairs.length; i += 2)
        events[pairs[i]] = Number(pairs[i + 1]) || 0; for (let i = 0; i < timingPairs.length; i += 2)
        timings[timingPairs[i]] = Number(timingPairs[i + 1]) || 0; const durationCount = timings["daily_completed:count"] || 0; return { day, uniqueUsers: Number(row.unique) || 0, newUsers: Number(row.newUsers) || 0, returningUsers: Number(row.returningUsers) || 0, dailyStarters: Number(row.dailyStarters) || 0, dailyCompleters: Number(row.dailyCompleters) || 0, pvpStarters: Number(row.pvpStarters) || 0, pvpCompleters: Number(row.pvpCompleters) || 0, dailyDurationCount: durationCount, dailyDurationSum: timings["daily_completed:sum"] || 0, averageDailySeconds: durationCount ? Math.round((timings["daily_completed:sum"] || 0) / durationCount) : 0, d1: Number(row.d1) || 0, d3: Number(row.d3) || 0, d7: Number(row.d7) || 0, events }; });
}



