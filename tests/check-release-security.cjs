const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function load(file,req,extra={}){const m={exports:{}},ctx={module:m,exports:m.exports,require:req,process:{env:{PI_API_KEY:'unit-test-not-a-real-key'}},Date,console,Buffer,...extra};vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);return m.exports;}
const real=load('lib/pi.js',require);
const base={identifier:'receipt',user_uid:'owner',direction:'user_to_app',network:'Pi Testnet',amount:.1,memo:real.REPLAY_MEMO,metadata:{product:real.REPLAY_PRODUCT},status:{developer_approved:true,developer_completed:true,transaction_verified:true},transaction:{txid:'tx',verified:true}};
async function run({action='recover',token=true,auth=true,receipts=[base,base],txid='tx',postOk=true}={}){let lookups=0,grants=0,posts=0;const p={...real,bearerFromRequest:()=>token?'test':null,verifyAccessToken:async()=>{if(!auth)throw Error('bad');return{uid:'owner'}},getPayment:async()=>structuredClone(receipts[Math.min(lookups++,receipts.length-1)]),piPost:async()=>{posts++;return{response:{ok:postOk,status:postOk?200:503},data:{error:'temporary'}}}};const store={isStoreConfigured:()=>true,claimPayment:async()=>{},grantReplayCredit:async()=>{grants++;return 1},grantPremium:async()=>{grants++}};const handler=load('api/pi-payment.js',name=>name.endsWith('/pi')?p:name.endsWith('/store')?store:{safeRecordMetric:async()=>{}});const res={setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};await handler({method:'POST',body:{action,paymentId:'receipt',txid}},res);return{code:res.code,lookups,grants,posts};}
(async()=>{
for(const action of ['recover','approve','complete']){const r=await run({action,token:false});assert.equal(r.code,401);assert.equal(r.lookups+r.posts+r.grants,0)}
assert.equal((await run({auth:false})).lookups,0);
for(const change of [{identifier:'other'},{user_uid:'other'},{network:'Pi Network'},{direction:'app_to_user'},{amount:.5},{memo:'wrong'},{metadata:{product:'bad'}},{status:{cancelled:true}},{status:{user_cancelled:true}}]){const r=await run({receipts:[{...base,...change}]});assert.equal(r.grants,0);assert.equal(r.code,400);}
for(const action of ['complete','recover']){
assert.equal((await run({action})).grants,1);
assert.equal((await run({action,txid:'other'})).grants,0);
for(const change of [{identifier:'other'},{user_uid:'other'},{transaction:{txid:'other',verified:true}},{transaction:{txid:'tx',verified:false}},{status:{developer_completed:true,transaction_verified:false}},{status:{developer_completed:false,transaction_verified:true}}]){const r=await run({action,receipts:[base,{...base,...change}]});assert.equal(r.grants,0);assert([400,409].includes(r.code));}
const swapped={...base,amount:1,memo:real.PREMIUM_MEMO,metadata:{product:real.PREMIUM_PRODUCT}};assert.equal((await run({action,receipts:[base,swapped]})).grants,0);
const pending={...base,status:{developer_approved:true,developer_completed:false,transaction_verified:true}};let r=await run({action,receipts:[pending,base]});assert.equal(r.grants,1);assert.equal(r.posts,1);r=await run({action,receipts:[pending],postOk:false});assert.equal(r.grants,0);
}
assert.equal((await run({action:'unsupported'})).lookups,0);
const session=real.issueArenaSession('owner','tester');assert.equal(real.verifyArenaSession(session).uid,'owner');assert.throws(()=>real.verifyArenaSession(session.slice(0,-4)+'abcd'),/session/);const payload=Buffer.from(JSON.stringify({uid:'attacker',exp:Date.now()+999999})).toString('base64url');assert.throws(()=>real.verifyArenaSession(payload+'.'+session.split('.')[1]),/session/);
// Daily mutations must carry the current attempt/day/version, and expired sessions are 401.
let flips=0;
const game=load('api/game-state.js',name=>name==='crypto'?require('crypto'):name.endsWith('/pi')?{arenaSessionFromRequest:req=>req.expired?'bad':'',bearerFromRequest:()=> 'test',verifyArenaSession:()=>{throw Error('Arena session expired')},verifyAccessToken:async()=>({uid:'owner'})}:name.endsWith('/metrics')?{safeRecordMetric:async()=>{}}:{isStoreConfigured:()=>true,flipDailyCard:async()=>{flips++;return{daily:{day:new Date().toISOString().slice(0,10),attemptId:'attempt',status:'active',moves:0,matched:[],deck:['⚔'],firstIndex:0,score:0},reveal:{pending:true,index:0,value:'⚔'}}}});
async function gameCall(body,expired=false){const res={setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};await game({method:'POST',body,expired},res);return res;}
assert.equal((await gameCall({action:'load'},true)).code,401);
assert.equal((await gameCall({action:'daily-flip',index:0})).code,409);
assert.equal((await gameCall({action:'daily-reset'})).code,409);assert.equal(flips,0);
const expected={action:'daily-flip',day:new Date().toISOString().slice(0,10),index:0,expectedMoves:0,expectedFirstIndex:null,expectedAttemptId:'attempt'};
assert.equal((await gameCall({...expected,expectedMoves:'0'})).code,400);assert.equal(flips,0);
assert.equal((await gameCall(expected)).code,200);assert.equal(flips,1);
// No API in this release is allowed to pay out a reward.
const a2u=load('api/a2u.js',()=>{throw Error('Unexpected payment dependency')});const res={setHeader(){},status(n){this.code=n;return this},json(){return this}};await a2u({method:'POST',body:{amount:3,uid:'attacker'}},res);assert.equal(res.code,410);
console.log('Release security: authenticated recovery, identity/network/product/amount, final ID/tx/product tampering, unverified settlement, upstream failure, signed-session forgery and disabled payouts passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
