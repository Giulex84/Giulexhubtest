function config() {
  const url = process.env.ARENA_KV_KV_REST_API_URL || process.env.ARENA_KV_REDIS_URL || process.env.ARENA_KV_REST_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.ARENA_KV_KV_REST_API_TOKEN || process.env.ARENA_KV_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function isStoreConfigured() { return Boolean(config()); }

async function command(parts) {
  const cfg = config();
  if (!cfg) throw new Error("Persistent store is not configured");
  const response = await fetch(cfg.url, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: JSON.stringify(parts), cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || "Store request failed");
  return payload?.result;
}

const premiumKey = (uid) => `arena:test:premium:${uid}`;
const paymentKey = (paymentId) => `arena:test:payment:${paymentId}`;
const rewardCooldownKey = (uid) => `arena:test:reward-cooldown:${uid}`;
const rewardProcessKey = (uid) => `arena:test:reward-process:${uid}`;
const rewardDayKey = (uid, day) => `arena:test:reward-day:${day}:${uid}`;
const rewardReceiptKey = (paymentId) => `arena:test:reward:${paymentId}`;
const rewardLastKey = (uid) => `arena:test:reward-last:${uid}`;
const gameStateKey = (uid) => `arena:test:game:${uid}`;
const dailyKey = (uid, day) => `arena:test:daily:${day}:${uid}`;
const dailyLockKey = (uid, day) => `arena:test:daily-lock:${day}:${uid}`;
const replayCreditsKey = (uid) => `arena:test:daily-replay-credits:${uid}`;
const replayFulfilledKey = (paymentId) => `arena:test:daily-replay-fulfilled:${paymentId}`;
const profileKey = (uid) => `arena:test:profile:${uid}`;
const dailyAttemptsKey = (uid,day) => `arena:test:daily-attempts:${day}:${uid}`;
const dailyBestKey = (uid,day) => `arena:test:daily-best:${day}:${uid}`;
const dailyLeaderboardKey = (day) => `arena:test:daily-leaderboard:${day}`;
const pvpMatchKey = (id) => `arena:test:pvp:match:${id}`;
const pvpUserKey = (uid) => `arena:test:pvp:user:${uid}`;
const pvpQueueKey = "arena:test:pvp:queue";
const pvpLockKey = "arena:test:pvp:matchmaking-lock";
const pvpMatchLockKey = (id) => `arena:test:pvp:lock:${id}`;

async function hasPremium(uid) { if (!isStoreConfigured()) return false; return (await command(["GET", premiumKey(uid)])) === "1"; }
async function claimPayment(uid, paymentId) { const key=paymentKey(paymentId), created=await command(["SET",key,uid,"NX"]); if(created==="OK")return true; const existing=await command(["GET",key]); if(existing!==uid)throw new Error("Payment already belongs to another user"); return false; }
async function grantPremium(uid,paymentId){await claimPayment(uid,paymentId);await command(["SET",premiumKey(uid),"1"]);}

async function getGameState(uid){if(!isStoreConfigured())return null;const raw=await command(["GET",gameStateKey(uid)]);if(!raw)return null;try{const p=JSON.parse(raw);return{level:Number(p.level)||1,lives:Number.isFinite(Number(p.lives))?Number(p.lives):5,score:Number(p.score)||0,updatedAt:p.updatedAt||null};}catch{return null;}}
async function saveGameState(uid,state){const level=Math.max(1,Math.min(100,Math.trunc(Number(state?.level)||1))),lives=Math.max(0,Math.min(999,Math.trunc(Number(state?.lives)||0))),score=Math.max(0,Math.min(1000000000,Math.trunc(Number(state?.score)||0)));const value=JSON.stringify({level,lives,score,updatedAt:new Date().toISOString()});await command(["SET",gameStateKey(uid),value]);return{level,lives,score};}

async function getDailyChallenge(uid,day){const raw=await command(["GET",dailyKey(uid,day)]);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}
async function saveDailyChallenge(uid,day,state){await command(["SET",dailyKey(uid,day),JSON.stringify(state),"EX",259200]);return state;}
async function acquireDailyLock(uid,day){const id=`${Date.now()}:${Math.random().toString(36).slice(2)}`;const ok=await command(["SET",dailyLockKey(uid,day),id,"NX","EX",10]);if(ok!=="OK")throw new Error("Daily challenge request already in progress");return id;}
async function releaseDailyLock(uid,day,id){const script='if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';await command(["EVAL",script,1,dailyLockKey(uid,day),id]);}
async function getReplayCredits(uid){return Math.max(0,Number((await command(["GET",replayCreditsKey(uid)]))||0));}
async function grantReplayCredit(uid,paymentId){await claimPayment(uid,paymentId);const created=await command(["SET",replayFulfilledKey(paymentId),uid,"NX"]);if(created==="OK")await command(["INCR",replayCreditsKey(uid)]);else{const owner=await command(["GET",replayFulfilledKey(paymentId)]);if(owner!==uid)throw new Error("Replay fulfillment belongs to another user");}return getReplayCredits(uid);}
async function consumeReplayCredit(uid){const count=await getReplayCredits(uid);if(count<1)throw new Error("A Daily Replay Ticket is required");await command(["DECR",replayCreditsKey(uid)]);return count-1;}
async function saveProfile(uid,username){const value=JSON.stringify({uid,username:typeof username==="string"?username.slice(0,64):null});await command(["SET",profileKey(uid),value]);}
async function recordDailyAttempt(uid,day){const count=Number(await command(["INCR",dailyAttemptsKey(uid,day)]));if(count===1)await command(["EXPIRE",dailyAttemptsKey(uid,day),259200]);return count;}
async function getDailyBest(uid,day){const raw=await command(["GET",dailyBestKey(uid,day)]);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}
function isBetterDailyResult(next,current){return!current||next.moves<current.moves||(next.moves===current.moves&&next.score>current.score);}
async function recordDailyResult(uid,day,result){const next={moves:Math.max(0,Math.trunc(Number(result.moves)||0)),score:Math.max(0,Math.trunc(Number(result.score)||0)),completedAt:new Date().toISOString()};const current=await getDailyBest(uid,day),best=isBetterDailyResult(next,current)?next:current;if(best===next)await command(["SET",dailyBestKey(uid,day),JSON.stringify(best),"EX",259200]);const rank=best.moves*1000000-best.score;await command(["ZADD",dailyLeaderboardKey(day),rank,uid]);await command(["EXPIRE",dailyLeaderboardKey(day),259200]);return best;}
async function getDailyMeta(uid,day){const[attempts,best]=await Promise.all([command(["GET",dailyAttemptsKey(uid,day)]),getDailyBest(uid,day)]);return{attempts:Math.max(0,Number(attempts)||0),best};}
async function getDailyLeaderboard(uid,day){const ids=await command(["ZRANGE",dailyLeaderboardKey(day),0,9]),list=Array.isArray(ids)?ids:[];if(!list.length)return{leaders:[],position:null};const keys=[];for(const id of list)keys.push(profileKey(id),dailyBestKey(id,day));const values=await command(["MGET",...keys]);const leaders=list.map((id,index)=>{let profile=null,best=null;try{profile=values?.[index*2]?JSON.parse(values[index*2]):null;}catch{}try{best=values?.[index*2+1]?JSON.parse(values[index*2+1]):null;}catch{}return{rank:index+1,username:profile?.username||"Pioneer",moves:best?.moves||0,score:best?.score||0};});const ownRank=await command(["ZRANK",dailyLeaderboardKey(day),uid]);return{leaders,position:ownRank===null?null:Number(ownRank)+1};}
async function getPvpMatch(id){if(!id)return null;const raw=await command(["GET",pvpMatchKey(id)]);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}
async function savePvpMatch(match){await command(["SET",pvpMatchKey(match.id),JSON.stringify(match),"EX",172800]);return match;}
async function getUserPvpMatch(uid){const id=await command(["GET",pvpUserKey(uid)]);return id?getPvpMatch(id):null;}
async function setUserPvpMatch(uid,id){await command(["SET",pvpUserKey(uid),id,"EX",172800]);}
async function clearUserPvpMatch(uid){await command(["DEL",pvpUserKey(uid)]);}
async function getPvpQueue(){const raw=await command(["GET",pvpQueueKey]);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}
async function setPvpQueue(value){await command(["SET",pvpQueueKey,JSON.stringify(value),"EX",3600]);}
async function clearPvpQueue(id){const script='local v=redis.call("GET",KEYS[1]); if not v then return 0 end; local ok,obj=pcall(cjson.decode,v); if ok and obj["matchId"]==ARGV[1] then return redis.call("DEL",KEYS[1]) end; return 0';await command(["EVAL",script,1,pvpQueueKey,id]);}
async function acquirePvpLock(){const id=`${Date.now()}:${Math.random().toString(36).slice(2)}`,ok=await command(["SET",pvpLockKey,id,"NX","EX",10]);if(ok!=="OK")throw new Error("Matchmaking is busy. Retry shortly.");return id;}
async function releasePvpLock(id){const script='if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end';await command(["EVAL",script,1,pvpLockKey,id]);}
async function acquirePvpMatchLock(matchId){const id=`${Date.now()}:${Math.random().toString(36).slice(2)}`,ok=await command(["SET",pvpMatchLockKey(matchId),id,"NX","EX",10]);if(ok!=="OK")throw new Error("PvP move already in progress");return id;}
async function releasePvpMatchLock(matchId,id){const script='if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end';await command(["EVAL",script,1,pvpMatchLockKey(matchId),id]);}

async function beginRewardAttempt(uid){const cooldown=await command(["GET",rewardCooldownKey(uid)]);if(cooldown)throw new Error("Reward cooldown active");const processId=`${Date.now()}:${Math.random().toString(36).slice(2)}`;const locked=await command(["SET",rewardProcessKey(uid),processId,"NX","EX",180]);if(locked!=="OK")throw new Error("Reward processing already in progress");try{const day=new Date().toISOString().slice(0,10),count=Number((await command(["GET",rewardDayKey(uid,day)]))||0);if(count>=20)throw new Error("Daily Test-Pi reward limit reached");return{processId,day};}catch(error){await releaseRewardAttempt(uid,processId);throw error;}}
async function releaseRewardAttempt(uid,processId){const key=rewardProcessKey(uid),current=await command(["GET",key]);if(current===processId)await command(["DEL",key]);}
async function commitRewardAttempt(uid,processId,day){const key=rewardProcessKey(uid),current=await command(["GET",key]);if(current!==processId)throw new Error("Reward processing lock expired");const dayKey=rewardDayKey(uid,day),count=Number(await command(["INCR",dayKey]));if(count===1)await command(["EXPIRE",dayKey,172800]);if(count>20){await command(["DECR",dayKey]);throw new Error("Daily Test-Pi reward limit reached");}await command(["SET",rewardCooldownKey(uid),"1","EX",60]);await command(["DEL",key]);return count;}
async function recordReward(uid,paymentId,txid,extra={}){const receipt={uid,paymentId,txid,amount:extra.amount??null,recovered:Boolean(extra.recovered),at:new Date().toISOString()},encoded=JSON.stringify(receipt);await command(["SET",rewardReceiptKey(paymentId),encoded]);await command(["SET",rewardLastKey(uid),encoded,"EX",2592000]);return receipt;}
async function getRewardReceipt(paymentId){const raw=await command(["GET",rewardReceiptKey(paymentId)]);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}
async function getLastReward(uid){const raw=await command(["GET",rewardLastKey(uid)]);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}

module.exports={isStoreConfigured,hasPremium,claimPayment,grantPremium,getGameState,saveGameState,getDailyChallenge,saveDailyChallenge,acquireDailyLock,releaseDailyLock,getReplayCredits,grantReplayCredit,consumeReplayCredit,saveProfile,recordDailyAttempt,getDailyBest,recordDailyResult,getDailyMeta,getDailyLeaderboard,getPvpMatch,savePvpMatch,getUserPvpMatch,setUserPvpMatch,clearUserPvpMatch,getPvpQueue,setPvpQueue,clearPvpQueue,acquirePvpLock,releasePvpLock,acquirePvpMatchLock,releasePvpMatchLock,beginRewardAttempt,releaseRewardAttempt,commitRewardAttempt,recordReward,getRewardReceipt,getLastReward};
