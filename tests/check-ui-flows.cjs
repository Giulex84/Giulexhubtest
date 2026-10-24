const {JSDOM}=require(process.env.JSDOM_MODULE_PATH||'jsdom'),fs=require('fs'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8'),translations=fs.readFileSync('ux-i18n.js','utf8'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function make({incomplete=false}={}){
 const dom=new JSDOM(html,{url:'https://arena.test.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 let premium=false,failRecovery=incomplete,authenticated=false,recovers=0,walletCalls=0,lastSaved,daily=null,calls=[];
 const day=new Date().toISOString().slice(0,10);
 w.Pi={init(config){assert.equal(config.sandbox,true)},authenticate:async(scopes,onIncomplete)=>{if(incomplete)await onIncomplete({identifier:'unfinished',transaction:{txid:'tx'}});authenticated=true;return{accessToken:'verified-token'}},createPayment:(payment,callbacks)=>{walletCalls++;w.testWallet={payment,callbacks};}};
 w.fetch=async(path,options)=>{const body=JSON.parse(options.body||'{}');calls.push({path,body});let value={};
 if(path==='/api/pi-payment'&&body.action==='recover'){assert(authenticated);assert.equal(options.headers.Authorization,'Bearer verified-token');recovers++;if(failRecovery){failRecovery=false;return{ok:false,status:503,json:async()=>({error:'temporary'})}}premium=true;value={premium:true,recovered:true};}
 else if(path==='/api/auth')value={uid:'u',username:'tester',premium,storeReady:true,replayCredits:1,arenaSession:'session',loginReward:{count:7,ticketsEarned:1}};
 else if(body.action==='load')value={state:lastSaved||{level:2,lives:5,score:60}};
 else if(body.action==='save'){lastSaved=JSON.parse(JSON.stringify(body.state));value={state:lastSaved,ok:true};}
 else if(body.action==='daily-start'){daily={day,attemptId:'attempt',status:'active',moves:0,matches:0,matched:[],matchedValues:{},firstIndex:null,score:0,maxMoves:18};value={daily,meta:{}};}
 else if(body.action==='daily-status')value={daily,meta:{},replayCredits:1};
 else if(body.action==='daily-flip'){assert.equal(body.day,day);assert.equal(body.expectedAttemptId,'attempt');assert.equal(body.expectedMoves,daily.moves);assert.equal(body.expectedFirstIndex,daily.firstIndex);daily={...daily,firstIndex:body.index,firstValue:'⚔'};value={daily,reveal:{index:body.index,value:'⚔',pending:true}};}
 else if(body.action==='daily-weekly')value={leaders:[{rank:1,username:'winner',days:3,moves:20,score:1200,simulatedTestPi:1.5}],position:4};
 else if(body.action==='pvp-status')value={pvp:null};
 else if(body.action==='pvp-start')value={pvp:{status:'waiting',maxMoves:18,own:{status:'active',matched:[],matchedValues:{},moves:0,firstIndex:null}}};
 else if(body.action==='pvp-cancel')value={pvp:null,cancelled:true};
 else value={leaders:[]};return{ok:true,status:200,json:async()=>value};};
 for(const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!script[1].includes('src='))w.eval(script[2]);w.eval(translations);await pause(5);
 return{dom,w,d,stats:()=>({recovers,walletCalls,lastSaved,calls})};
}
(async()=>{
let x=await make({incomplete:true});assert(!x.d.querySelector('#service-notice'));await x.d.getElementById('login').onclick();await pause(5);assert(x.d.getElementById('app').classList.contains('hidden'));assert(!x.d.getElementById('status').closest('.hidden'));await x.d.getElementById('login').onclick();await pause(5);assert(!x.d.getElementById('app').classList.contains('hidden'));assert(!x.d.getElementById('premiumActive').classList.contains('hidden'));assert.equal(x.stats().recovers,2);x.dom.window.close();
x=await make();await x.d.getElementById('login').onclick();await pause(5);x.d.querySelector('#grid button').click();await pause(10);assert.equal(x.stats().lastSaved.board.cards.filter(c=>c.flipped&&!c.matched).length,1);
x.d.getElementById('premium').click();await pause(5);assert.equal(x.stats().walletCalls,0);x.d.getElementById('purchaseConfirm').click();assert.equal(x.w.testWallet.payment.amount,1);x.w.testWallet.callbacks.onCancel();x.d.getElementById('buyReplay').click();x.d.getElementById('purchaseConfirm').click();assert.equal(x.w.testWallet.payment.amount,.1);x.w.testWallet.callbacks.onCancel();
x.d.getElementById('dailyTab').click();await pause(10);await x.d.getElementById('startDaily').onclick();await x.w.dailyFlip(0);assert(x.stats().calls.some(c=>c.body.action==='daily-flip'));assert(x.d.getElementById('weeklyDailyLeaders').textContent.includes('winner'));
for(const language of ['en','it','es','fr','pt','de','id','zh']){x.w.ArenaUI.setLanguage(language);await pause(5);assert.equal(x.d.documentElement.lang,language);assert(![...x.d.querySelectorAll('button,p,small,span')].some(el=>el.textContent.includes('undefined')));}
x.w.ArenaUI.setLanguage('it');x.w.renderClassicLeaderboard({leaders:[{rank:1,username:'winner',score:100,level:2,previousWeekBadge:{rank:1,week:'2026-10-19'}}]});await pause(5);assert.equal(x.d.querySelector('#classicLeaders [role=img]').getAttribute('aria-label'),'Oro della settimana scorsa');
x.d.getElementById('pvpTab').click();await pause(5);await x.d.getElementById('startPvp').onclick();await x.d.getElementById('cancelPvp').onclick();assert(x.d.getElementById('cancelPvp').classList.contains('hidden'));assert(!x.d.querySelector('meta[name=viewport]').content.includes('user-scalable=no'));x.dom.window.close();
console.log('DOM flow PASS: no outage notice; authenticated SDK recovery queue and retry; restored entitlements; saved board; wallet confirmation/test prices; Daily expectations; weekly simulation; 8 languages; medals; PvP cancellation; zoom. No real wallet or Pi API was used.');
})().catch(e=>{console.error(e);process.exitCode=1});
