const assert=require('assert/strict'),fs=require('fs'),pi=require('../lib/pi');
assert.equal(pi.validateStorePayment({identifier:'test',user_uid:'u',direction:'user_to_app',network:'Pi Testnet',amount:0.1,memo:'Arena Test Daily Replay Ticket',metadata:{product:'arena_test_daily_replay_v1'}},'u'),null);
assert(pi.validateStorePayment({identifier:'test',user_uid:'u',direction:'user_to_app',network:'Pi Network',amount:0.5,memo:'Arena Daily Replay Ticket',metadata:{product:'arena_daily_replay_v1'}},'u'));
const html=fs.readFileSync('index.html','utf8');assert(html.includes('sandbox: true'));assert(html.includes('amount: 0.1'));assert(!html.includes('arena_daily_replay_v1'));
const store=fs.readFileSync('lib/store.js','utf8');assert(!/`arena:(?!test:)/.test(store));console.log('Testnet SDK, payment product/price/network and Redis namespace boundaries passed.');
