const crypto = require("crypto");
const { bearerFromRequest, arenaSessionFromRequest, verifyArenaSession, verifyAccessToken } = require("../lib/pi");
const { getGameState, saveGameState, getDailyChallenge, saveDailyChallenge, acquireDailyLock, releaseDailyLock, getReplayCredits, consumeReplayCredit, recordDailyAttempt, recordDailyResult, getDailyMeta, getDailyLeaderboard, getPvpMatch, savePvpMatch, getUserPvpMatch, setUserPvpMatch, clearUserPvpMatch, getPvpQueue, setPvpQueue, clearPvpQueue, acquirePvpLock, releasePvpLock, acquirePvpMatchLock, releasePvpMatchLock, flipPvpCard, isStoreConfigured } = require("../lib/store");

const DAILY_SYMBOLS=["⚔","🔥","🛡","🏹","👑","💎"];
const MAX_MOVES=18;
const today=()=>new Date().toISOString().slice(0,10);
function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function publicDaily(s){const matchedValues={};for(const i of s.matched)matchedValues[i]=s.deck[i];return{day:s.day,status:s.status,moves:s.moves,maxMoves:MAX_MOVES,matches:s.matched.length/2,matched:s.matched,matchedValues,firstIndex:s.firstIndex,firstValue:s.firstIndex===null?null:s.deck[s.firstIndex],score:s.score};}
function newPvpPlayer(uid,username,bot=false){return{uid,username:username||"Pioneer",bot,matched:[],firstIndex:null,moves:0,score:0,status:bot?"completed":"active"};}
function comparePvp(a,b){if(a.status==="completed"&&b.status!=="completed")return 1;if(b.status==="completed"&&a.status!=="completed")return-1;if(a.moves!==b.moves)return a.moves<b.moves?1:-1;if(a.score!==b.score)return a.score>b.score?1:-1;return 0;}
function publicPvp(match,uid){if(!match)return null;const own=match.players.find(p=>p.uid===uid),opponent=match.players.find(p=>p.uid!==uid);if(!own)return null;const matchedValues={};for(const i of own.matched)matchedValues[i]=match.deck[i];const bothDone=opponent&&own.status!=="active"&&opponent.status!=="active",comparison=bothDone?comparePvp(own,opponent):null;return{id:match.id,status:match.status,maxMoves:MAX_MOVES,own:{status:own.status,moves:own.moves,score:own.score,matched:own.matched,matchedValues,firstIndex:own.firstIndex,firstValue:own.firstIndex===null?null:match.deck[own.firstIndex]},opponent:opponent?{username:opponent.username,bot:Boolean(opponent.bot),status:opponent.status,moves:opponent.moves,score:opponent.score}:null,result:comparison===null?null:comparison>0?"win":comparison<0?"loss":"draw"};}

async function reconcileWaitingPvp(user,existing){
  let lockId;
  try{lockId=await acquirePvpLock();}
  catch(error){if(error?.message==="Matchmaking is busy. Retry shortly.")return existing;throw error;}
  try{
    const current=await getUserPvpMatch(user.uid);
    if(current&&current.status!=="waiting")return current;
    const own=current||existing;
    const queued=await getPvpQueue();
    if(queued&&queued.uid!==user.uid){
      const target=await getPvpMatch(queued.matchId);
      if(target&&target.status==="waiting"&&target.players.length===1&&target.players[0].uid!==user.uid){
        target.players.push(newPvpPlayer(user.uid,user.username));
        target.status="active";
        target.matchedAt=new Date().toISOString();
        await savePvpMatch(target);
        await setUserPvpMatch(user.uid,target.id);
        await clearPvpQueue(target.id);
        return target;
      }
      await clearPvpQueue(queued.matchId);
    }
    if(own&&own.status==="waiting"){
      await setPvpQueue({uid:user.uid,matchId:own.id});
      return own;
    }
    return null;
  }finally{await releasePvpLock(lockId);}
}

module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  const sessionToken=arenaSessionFromRequest(req),token=bearerFromRequest(req);if(!sessionToken&&!token)return res.status(401).json({error:"Missing Arena session"});
  if(!isStoreConfigured())return res.status(503).json({error:"Persistent store is not configured"});
  try{
    const user=sessionToken?verifyArenaSession(sessionToken):await verifyAccessToken(token),action=req.body?.action||"load";
    if(action==="load")return res.status(200).json({state:await getGameState(user.uid)});
    if(action==="save")return res.status(200).json({ok:true,state:await saveGameState(user.uid,req.body?.state||{})});
    const day=today();
    if(action==="daily-leaderboard")return res.status(200).json(await getDailyLeaderboard(user.uid,day));
    if(action==="daily-start"||action==="daily-status"){
      let daily=await getDailyChallenge(user.uid,day);
      if(!daily){daily={day,deck:shuffle([...DAILY_SYMBOLS,...DAILY_SYMBOLS]),matched:[],firstIndex:null,moves:0,score:0,status:"active",startedAt:new Date().toISOString()};await saveDailyChallenge(user.uid,day,daily);await recordDailyAttempt(user.uid,day);}
      let meta=await getDailyMeta(user.uid,day);if(meta.attempts<1){await recordDailyAttempt(user.uid,day);meta=await getDailyMeta(user.uid,day);}if(daily.status==="completed"&&!meta.best){meta.best=await recordDailyResult(user.uid,day,daily);}
      return res.status(200).json({daily:publicDaily(daily),meta});
    }
    if(action==="daily-reset"){
      const lockId=await acquireDailyLock(user.uid,day);
      try{const replayCredits=await consumeReplayCredit(user.uid),daily={day,deck:shuffle([...DAILY_SYMBOLS,...DAILY_SYMBOLS]),matched:[],firstIndex:null,moves:0,score:0,status:"active",startedAt:new Date().toISOString(),replay:true};await saveDailyChallenge(user.uid,day,daily);await recordDailyAttempt(user.uid,day);return res.status(200).json({daily:publicDaily(daily),replayCredits,meta:await getDailyMeta(user.uid,day)});}finally{await releaseDailyLock(user.uid,day,lockId);}
    }
    if(action==="daily-flip"){
      const lockId=await acquireDailyLock(user.uid,day);
      try{
      const daily=await getDailyChallenge(user.uid,day);
      if(!daily)return res.status(409).json({error:"Start today's challenge first"});
      if(daily.status!=="active")return res.status(200).json({daily:publicDaily(daily)});
      const index=Number(req.body?.index);
      if(!Number.isInteger(index)||index<0||index>=daily.deck.length)return res.status(400).json({error:"Invalid card"});
      if(daily.matched.includes(index)||daily.firstIndex===index)return res.status(409).json({error:"Card is already visible"});
      const value=daily.deck[index];
      if(daily.firstIndex===null){daily.firstIndex=index;await saveDailyChallenge(user.uid,day,daily);return res.status(200).json({daily:publicDaily(daily),reveal:{index,value,pending:true}});}
      const firstIndex=daily.firstIndex,firstValue=daily.deck[firstIndex],matched=firstValue===value;daily.firstIndex=null;daily.moves+=1;
      if(matched){daily.matched.push(firstIndex,index);daily.score+=Math.max(20,120-daily.moves*4);}
      if(daily.matched.length===daily.deck.length){daily.status="completed";daily.score+=Math.max(0,(MAX_MOVES-daily.moves)*25);daily.completedAt=new Date().toISOString();}
      else if(daily.moves>=MAX_MOVES){daily.status="failed";daily.completedAt=new Date().toISOString();}
      await saveDailyChallenge(user.uid,day,daily);
      const meta=daily.status==="completed"?{attempts:(await getDailyMeta(user.uid,day)).attempts,best:await recordDailyResult(user.uid,day,daily)}:null;
      return res.status(200).json({daily:publicDaily(daily),meta,reveal:{index,value,firstIndex,firstValue,matched,pending:false}});
      }finally{await releaseDailyLock(user.uid,day,lockId);}
    }
    if(action==="pvp-status"){
      let match=await getUserPvpMatch(user.uid);
      if(match?.status==="waiting")match=await reconcileWaitingPvp(user,match);
      return res.status(200).json({pvp:publicPvp(match,user.uid)});
    }
    if(action==="pvp-start"){
      const existing=await getUserPvpMatch(user.uid);
      if(existing?.status==="waiting")return res.status(200).json({pvp:publicPvp(await reconcileWaitingPvp(user,existing),user.uid)});
      if(existing?.status==="active")return res.status(200).json({pvp:publicPvp(existing,user.uid)});
      if(existing)await clearUserPvpMatch(user.uid);
      const lockId=await acquirePvpLock();
      try{
        const queued=await getPvpQueue();
        if(queued&&queued.uid!==user.uid){const match=await getPvpMatch(queued.matchId);if(match&&match.status==="waiting"){match.players.push(newPvpPlayer(user.uid,user.username));match.status="active";match.matchedAt=new Date().toISOString();await savePvpMatch(match);await setUserPvpMatch(user.uid,match.id);await clearPvpQueue(match.id);return res.status(200).json({pvp:publicPvp(match,user.uid)});}await clearPvpQueue(queued.matchId);}
        const match={id:crypto.randomUUID(),status:"waiting",deck:shuffle([...DAILY_SYMBOLS,...DAILY_SYMBOLS]),players:[newPvpPlayer(user.uid,user.username)],createdAt:new Date().toISOString()};await savePvpMatch(match);await setUserPvpMatch(user.uid,match.id);await setPvpQueue({uid:user.uid,matchId:match.id});return res.status(200).json({pvp:publicPvp(match,user.uid)});
      }finally{await releasePvpLock(lockId);}
    }
    if(action==="pvp-bot"){
      const match=await getUserPvpMatch(user.uid);if(!match||match.status!=="waiting")return res.status(409).json({error:"No waiting PvP match"});const lockId=await acquirePvpMatchLock(match.id);try{const fresh=await getPvpMatch(match.id);if(fresh.status!=="waiting")return res.status(200).json({pvp:publicPvp(fresh,user.uid)});const botMoves=12+crypto.randomInt(7),bot=newPvpPlayer(`bot:${fresh.id}`,"Arena Bot",true);bot.moves=botMoves;bot.score=Math.max(100,900-botMoves*25);fresh.players.push(bot);fresh.status="active";fresh.matchedAt=new Date().toISOString();await savePvpMatch(fresh);await clearPvpQueue(fresh.id);return res.status(200).json({pvp:publicPvp(fresh,user.uid)});}finally{await releasePvpMatchLock(match.id,lockId);}
    }
    if(action==="pvp-flip"){
      const index=Number(req.body?.index);
      if(!Number.isInteger(index)||index<0||index>=DAILY_SYMBOLS.length*2)return res.status(400).json({error:"Invalid card"});
      const result=await flipPvpCard(user.uid,index,MAX_MOVES);
      return res.status(200).json({pvp:publicPvp(result.match,user.uid),reveal:result.reveal});
    }
    return res.status(400).json({error:"Unknown action"});
  }catch(error){return res.status(error?.message==="Unauthorized"?401:(error?.statusCode||500)).json({error:error?.message||"Request failed"});}
};
