const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{startRedis}=require('./redis-helper.cjs');
function moduleIn(file,requireFn,extra={}){const m={exports:{}},ctx={module:m,exports:m.exports,require:requireFn,process:{env:{}},Date,Math,console,Set,Map,...extra};vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);return m.exports;}
function response(){return{setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}}
(async()=>{
const r=await startRedis();assert(r,'Set REDIS_TEST_SERVER for UX persistence tests');
try{
const store=moduleIn('lib/store.js',require,{process:{env:{UPSTASH_REDIS_REST_URL:'https://redis.test.invalid',UPSTASH_REDIS_REST_TOKEN:'test'}},fetch:r.fetch});
const board={level:2,combo:1,cards:['⚔','⚔','🔥','🔥','🛡','🛡','🏹','🏹'].map((value,i)=>({value,matched:i<2,flipped:i<3}))};
await r.command(['SET','arena:test:game:ux-user',JSON.stringify({level:2,score:60,lives:5})]);
await store.saveGameState('ux-user',{level:2,score:70,lives:6,board});
assert.deepEqual(JSON.parse(JSON.stringify((await store.getGameState('ux-user')).board)),board,'board, combo and first revealed card survive a separate load');
await assert.rejects(()=>store.saveGameState('ux-user',{level:2,score:70,lives:6,board:{...board,cards:board.cards.map(c=>({...c,flipped:true}))}}),/Invalid Classic board/);
assert.equal((await store.getGameState('ux-user')).score,70,'invalid snapshot cannot overwrite stored progress');
await store.saveGameState('ux-user',{level:2,score:60,lives:1,board:{...board,combo:0}});assert.equal((await store.getGameState('ux-user')).board.combo,1,'stale lower-score save preserves newer board');
await store.recordClassicResult('ux-user',3,200,7);assert.equal((await store.getGameState('ux-user')).board,null,'completed-level snapshot cannot restore old cards into new level');
let verifyError=false,storeError=false;
const auth=moduleIn('api/auth.js',name=>name.endsWith('/pi')?{bearerFromRequest:()=> 'test',verifyAccessToken:async()=>{if(verifyError)throw Error('invalid');return{uid:'u'}},issueArenaSession:()=> 'session'}:name.endsWith('/metrics')?{safeRecordMetric:async()=>{}}:{isStoreConfigured:()=>true,saveProfile:async()=>{if(storeError)throw Error('quota')},hasPremium:async()=>false,getReplayCredits:async()=>2});
let res=response();await auth({method:'POST',body:{}},res);assert.equal(res.code,200);storeError=true;res=response();await auth({method:'POST',body:{}},res);assert.equal(res.code,503);verifyError=true;res=response();await auth({method:'POST',body:{}},res);assert.equal(res.code,401);
// Real Redis routes: waiting cancellation is idempotent, cannot erase a joined match,
// and a late status request cannot put a cancelled player back into matchmaking.
let uid='cancel-user';const api=moduleIn('api/game-state.js',name=>name==='crypto'?require('crypto'):name.endsWith('/pi')?{arenaSessionFromRequest:()=>'',bearerFromRequest:()=> 't',verifyAccessToken:async()=>({uid,username:uid})}:name.endsWith('/metrics')?{safeRecordMetric:async()=>{}}:store);
async function call(action){const res=response();await api({method:'POST',body:{action}},res);assert.equal(res.code,200,JSON.stringify(res.body));return res.body;}
let started=await call('pvp-start');assert.equal(started.pvp.status,'waiting');assert.equal((await call('pvp-cancel')).cancelled,true);assert.equal((await call('pvp-status')).pvp,null);assert.equal((await call('pvp-cancel')).cancelled,true);
await call('pvp-start');uid='opponent';await call('pvp-start');uid='cancel-user';const joined=await call('pvp-cancel');assert.equal(joined.cancelled,false);assert.equal(joined.pvp.status,'active');assert(await store.getUserPvpMatch(uid));
console.log('UX: saved Classic board/first card/combo, invalid and stale snapshots, level transition, auth 401 vs service 503, cancellation and joined-duel protection passed.');
}finally{await r.stop()}
})().catch(e=>{console.error(e);process.exitCode=1});
