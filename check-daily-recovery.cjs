const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const events=new Set();let state,streak=0;
const store={isStoreConfigured:()=>true,getDailyChallenge:async()=>state,recordDailyResult:async()=>({moves:6,score:100}),recordDailyCompletion:async()=>{streak=1},getDailyMeta:async()=>({streak:{count:streak}}),getReplayCredits:async()=>2};
const ctx={require:p=>p==='crypto'?require('crypto'):p.endsWith('/pi')?{arenaSessionFromRequest:()=>null,bearerFromRequest:()=> 'token',verifyAccessToken:async()=>({uid:'tester'})}:p.endsWith('/metrics')?{safeRecordMetric:async(uid,event,id)=>events.add(event+':'+id)}:store,Date,Math,Set};ctx.module={exports:{}};ctx.exports=ctx.module.exports;vm.createContext(ctx);vm.runInContext(fs.readFileSync('api/game-state.js','utf8').replace('export default async function handler','async function handler'),ctx);
async function status(){const res={setHeader(){},status(n){this.code=n;return this},json(d){this.data=d;return this}};await ctx.handler({method:'POST',body:{action:'daily-status'}},res);assert.equal(res.code,200);return res.data}
(async()=>{state={day:'2026-10-07',status:'completed',deck:['a','a'],matched:[0,1],firstIndex:null,moves:6,score:100,startedAt:'2026-10-07T07:00:00Z',completedAt:'2026-10-07T07:01:00Z'};let d=await status();assert.equal(d.meta.streak.count,1);assert.equal(events.size,1);await status();assert.equal(events.size,1);state={...state,status:'failed'};await status();assert.equal(events.size,2);state={...state,status:'active'};await status();assert.equal(events.size,2);console.log('Daily recovery: reconciled streak, stable dedupe ID, completed/failed/active passed.');
for(const p of ['index.html','admin.html'])new Function(fs.readFileSync(p,'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1]);
const html=fs.readFileSync('index.html','utf8'),els=new Map();function el(id){if(!els.has(id))els.set(id,{style:{},textContent:'',classList:{add(){},remove(){},toggle(){}},appendChild(){}});return els.get(id)}
const ui={document:{getElementById:el,querySelectorAll:()=>[],createElement:()=>el(Math.random()),querySelector:()=>el('query')},URLSearchParams,location:{search:''},window:{},console,Pi:{init(){}},navigator:{},setTimeout,clearTimeout,AbortController};vm.createContext(ui);const script=[...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].at(-1)[1];vm.runInContext(script+';globalThis.test={set:s=>{dailyState=s},spot:updateDailySpotlight};',ui);ui.test.set({status:'completed',score:100});ui.test.spot(1);assert.equal(el('openDaily').textContent,'PLAY CLASSIC');ui.test.set({status:'failed'});ui.test.spot();assert.match(el('dailySpotlightTitle').textContent,/limit/);ui.test.set({status:'active',matches:2});ui.test.spot();assert.equal(el('openDaily').textContent,'CONTINUE');console.log('Daily next actions passed.');

const realApi=ui.api;ui.test.set(null);vm.runInContext('api=async()=>{throw new Error("offline")};',ui);
await ui.restoreDailyAfterError(new Error('lost response'));
assert.equal(vm.runInContext('dailyNeedsSync',ui),true);
vm.runInContext('api=async(path,body)=>body.action==="daily-status"?{daily:null,meta:{}}:{leaders:[]};',ui);
await ui.restoreDailyAfterError(new Error('lost response'));
assert.equal(vm.runInContext('dailyNeedsSync',ui),false);
console.log('Uncertain response: failed recovery blocks moves; successful reload clears the block.');
// A real timeout uses AbortController; the transport must honour abort like fetch.
ui.fetch=async(path,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const e=Error('aborted');e.name='AbortError';reject(e)}));ui.setTimeout=f=>setTimeout(f,0);
await assert.rejects(()=>realApi('/test',{}),e=>e.timedOut===true);ui.fetch=async(path,options)=>({ok:true,json:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const e=Error('body aborted');e.name='AbortError';reject(e)}))});await assert.rejects(()=>realApi('/test',{}),e=>e.timedOut===true);ui.setTimeout=setTimeout;
const day=new Date().toISOString().slice(0,10),active={day,status:'active',moves:0,firstIndex:null,matched:[],matchedValues:{},matches:0,score:0};ui.test.set(active);
vm.runInContext('dailyNeedsSync=false;dailyLoading=false;dailyBusy=false;',ui);
let release,flips=0;ui.hold=()=>new Promise(r=>release=r);vm.runInContext('api=async(path,body)=>{if(body.action==="daily-flip")return hold();return {daily:null,meta:{},leaders:[]}};',ui);
const first=ui.dailyFlip(0);assert.equal(vm.runInContext('dailyBusy',ui),true);await ui.dailyFlip(1);release({daily:{...active,firstIndex:0,firstValue:'a'},reveal:{index:0,value:'a',pending:true}});await first;assert.equal(vm.runInContext('dailyState.firstIndex',ui),0);
// The synchronization guard blocks both flips and paid reset until status succeeds.
ui.calls=[];vm.runInContext('dailyNeedsSync=true;replayCredits=2;api=async(path,body)=>{calls.push(body);return {}};',ui);await ui.dailyFlip(1);await el('useReplay').onclick();assert.equal(ui.calls.length,0);
// An obsolete status response cannot overwrite a newer response.
vm.runInContext('dailyNeedsSync=false;',ui);const pending=[];ui.statusHold=()=>new Promise(r=>pending.push(r));vm.runInContext('api=async(path,body)=>body.action==="daily-status"?statusHold():{leaders:[]};',ui);const old=ui.loadDaily(),fresh=ui.loadDaily();pending[1]({daily:{...active,moves:4},meta:{},replayCredits:3});await fresh;pending[0]({daily:{...active,moves:0},meta:{},replayCredits:1});await old;assert.equal(vm.runInContext('dailyState.moves',ui),4);assert.equal(vm.runInContext('replayCredits',ui),3);
// Crossing UTC midnight refreshes the board and never submits an old-board flip.
ui.test.set({...active,day:'2000-01-01'});ui.calls=[];vm.runInContext('api=async(path,body)=>{calls.push(body);return {daily:null,meta:{},leaders:[]}};',ui);await ui.dailyFlip(0);assert.equal(ui.calls[0].action,'daily-status');assert(!ui.calls.some(x=>x.action==='daily-flip'));
console.log('Daily UI: abort, double tap, sync guards, late status and UTC boundary passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
