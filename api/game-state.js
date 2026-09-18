const crypto = require("crypto");
const { bearerFromRequest, verifyAccessToken } = require("../lib/pi");
const { getGameState, saveGameState, getDailyChallenge, saveDailyChallenge, isStoreConfigured } = require("../lib/store");

const DAILY_SYMBOLS=["⚔","🔥","🛡","🏹","👑","💎"];
const MAX_MOVES=18;
const today=()=>new Date().toISOString().slice(0,10);
function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function publicDaily(s){const matchedValues={};for(const i of s.matched)matchedValues[i]=s.deck[i];return{day:s.day,status:s.status,moves:s.moves,maxMoves:MAX_MOVES,matches:s.matched.length/2,matched:s.matched,matchedValues,firstIndex:s.firstIndex,firstValue:s.firstIndex===null?null:s.deck[s.firstIndex],score:s.score};}

module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  const token=bearerFromRequest(req);if(!token)return res.status(401).json({error:"Missing Pi access token"});
  if(!isStoreConfigured())return res.status(503).json({error:"Persistent store is not configured"});
  try{
    const user=await verifyAccessToken(token),action=req.body?.action||"load";
    if(action==="load")return res.status(200).json({state:await getGameState(user.uid)});
    if(action==="save")return res.status(200).json({ok:true,state:await saveGameState(user.uid,req.body?.state||{})});
    const day=today();let daily=await getDailyChallenge(user.uid,day);
    if(action==="daily-start"||action==="daily-status"){
      if(!daily){daily={day,deck:shuffle([...DAILY_SYMBOLS,...DAILY_SYMBOLS]),matched:[],firstIndex:null,moves:0,score:0,status:"active",startedAt:new Date().toISOString()};await saveDailyChallenge(user.uid,day,daily);}
      return res.status(200).json({daily:publicDaily(daily)});
    }
    if(action==="daily-flip"){
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
      return res.status(200).json({daily:publicDaily(daily),reveal:{index,value,firstIndex,firstValue,matched,pending:false}});
    }
    return res.status(400).json({error:"Unknown action"});
  }catch(error){return res.status(error?.message==="Unauthorized"?401:500).json({error:error?.message||"Request failed"});}
};
