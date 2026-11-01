const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('      function visibleDailyStreak('),html.indexOf('      function renderDaily()'));
const context=vm.createContext({});vm.runInContext(source,context);
const visible=context.visibleDailyStreak;
for(const [today,lastDay,count,expected] of [
 ['2026-11-01','2026-11-01',3,3],
 ['2026-11-01','2026-10-31',2,2],
 ['2026-11-01','2026-10-30',2,0],
 ['2026-11-01','2026-11-02',2,0],
 ['2027-01-01','2026-12-31',4,4],
 ['2024-03-01','2024-02-29',4,4],
 ['2026-11-01',null,2,0],
 ['2026-11-01','2026-11-01',-2,0]
]){const streak={lastDay,count};assert.equal(visible(streak,today),expected);assert.deepEqual(streak,{lastDay,count});}
assert.equal(visible(undefined,'2026-11-01'),0);
assert(html.includes('const streakCount = visibleDailyStreak(dailyMeta.streak);'));
console.log('Streak display: today/yesterday, interrupted/future/missing, year boundary, leap day and unchanged input passed.');
