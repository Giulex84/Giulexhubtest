const fs=require('fs'),vm=require('vm'),{execFileSync}=require('child_process');
for(const file of ['index.html','admin.html','privacy.html','terms.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc=/.test(m[1])&&m[2].trim())new vm.Script(m[2],{filename:file});
for(const dir of ['api','lib'])for(const file of fs.readdirSync(dir))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',dir+'/'+file]);
JSON.parse(fs.readFileSync('package.json','utf8'));console.log('Static Testnet build syntax checks passed.');
