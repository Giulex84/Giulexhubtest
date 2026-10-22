const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{startRedis}=require('./redis-helper.cjs');
(async()=>{const r=await startRedis();assert(r,'Real Redis is required');try{
let now='2026-10-19T12:00:00Z';class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return Date.parse(now)}}
const m={exports:{}},ctx={module:m,exports:m.exports,process:{env:{UPSTASH_REDIS_REST_URL:'https://redis.test.invalid',UPSTASH_REDIS_REST_TOKEN:'test'}},fetch:r.fetch,Date:Clock,Math,Map,Set,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('lib/store.js','utf8'),ctx);const s=m.exports;
await r.command(['SET','arena:test:daily-replay-credits:loyal','5']);
for(let d=19;d<=24;d++){now=`2026-10-${d}T12:00:00Z`;await Promise.all([s.recordLoginReward('loyal'),s.recordLoginReward('loyal')]);}
assert.equal(await s.getReplayCredits('loyal'),5);
now='2026-10-25T12:00:00Z';const concurrent=await Promise.all(Array.from({length:8},()=>s.recordLoginReward('loyal')));assert.equal(concurrent.filter(x=>x.awarded).length,1);assert.equal(await s.getReplayCredits('loyal'),6);assert.equal((await s.getLoginReward('loyal')).count,7);
// A lost success response must not grant a duplicate ticket.
await s.recordLoginReward('loss','2026-10-19');for(let d=20;d<=24;d++)await s.recordLoginReward('loss',`2026-10-${d}`);
let lost=true;ctx.fetch=async(url,o)=>{const value=await r.fetch(url,o);if(lost&&JSON.parse(o.body)[1]?.includes('ticketsEarned')){lost=false;throw Error('lost reply')}return value};await assert.rejects(()=>s.recordLoginReward('loss'),/lost reply/);ctx.fetch=r.fetch;await s.recordLoginReward('loss');assert.equal(await s.getReplayCredits('loss'),1);
now='2026-10-27T12:00:00Z';assert.equal((await s.recordLoginReward('loyal')).count,1,'a missed UTC day resets the run');assert.equal(await s.getReplayCredits('loyal'),6,'earned and bought tickets survive reset');
now='2026-10-19T12:00:00Z';
for(const u of ['a','b','c','d'])await s.saveProfile(u,u+'User');
async function finish(uid,day,moves,score=400,replay=false){now=day+'T15:00:00Z';await s.recordDailyResult(uid,day,{day,status:'completed',moves,score,replay,completedAt:now});}
await finish('a','2026-10-19',10);await finish('a','2026-10-19',6,800,true);await finish('a','2026-10-20',9);await finish('b','2026-10-19',8);await finish('b','2026-10-20',9);await finish('c','2026-10-19',6);await finish('d','2026-10-19',6,1000,true);
const weekly=await s.getDailyWeeklyLeaderboard('a');assert.equal(weekly.leaders[0].username,'bUser');assert.equal(weekly.leaders[1].username,'aUser');assert.equal(weekly.leaders[1].moves,19);assert.equal(weekly.leaders.length,3);assert.equal(weekly.position,2);assert.equal(weekly.leaders.reduce((n,x)=>n+x.simulatedTestPi,0),3);assert(weekly.simulation);assert(!JSON.stringify(weekly.leaders).includes('uid'));
// Freeze results on Monday, without making any payout or adding any replay credits.
now='2026-10-26T00:00:00Z';const next=await s.getDailyWeeklyLeaderboard('a');assert.equal(next.leaders.length,0);assert.equal(next.lastWeek.winners[0].username,'bUser');const frozen=await r.command(['GET','arena:test:daily-weekly-pilot-awards-v1:2026-10-19']);await finish('d','2026-10-19',6,1000);now='2026-10-26T01:00:00Z';await s.getDailyWeeklyLeaderboard('a');assert.equal(await r.command(['GET','arena:test:daily-weekly-pilot-awards-v1:2026-10-19']),frozen);
// A previous-week Classic medal follows its winner into the next Top 10 only.
now='2026-10-19T12:00:00Z';for(const u of ['champ','silver','bronze'])await s.saveProfile(u,u);await s.recordClassicResult('champ',2,50,5);await s.recordClassicResult('silver',2,40,5);await s.recordClassicResult('bronze',2,30,5);
now='2026-10-26T12:00:00Z';await s.recordClassicResult('champ',3,60,5);await s.recordClassicResult('silver',3,50,5);await s.recordClassicResult('bronze',3,40,5);let classic=await s.getClassicLeaderboard('champ');assert.deepEqual(Object.fromEntries(classic.leaders.map(x=>[x.username,x.previousWeekBadge.rank])),{champ:1,silver:2,bronze:3});assert(classic.leaders.every(x=>x.previousWeekBadge.week==='2026-10-19'));
now='2026-11-02T12:00:00Z';await s.getClassicLeaderboard('champ');await s.recordClassicResult('champ',4,70,5);classic=await s.getClassicLeaderboard('champ');assert.equal(classic.leaders[0].previousWeekBadge.week,'2026-10-26');assert.equal(classic.leaders[0].previousWeekBadge.rank,1,'shared rank from tied prior week is preserved');
assert.equal(await r.command(['EXISTS','arena:login-reward-v1:loyal']),0);console.log('Rewards: UTC login streak, concurrent and lost-response idempotence, earned balances, first-free Daily only, weekly order/budget/freeze, previous-week medals and Testnet isolation passed.');
}finally{await r.stop()}})().catch(e=>{console.error(e);process.exitCode=1});
