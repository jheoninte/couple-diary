const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'dist';
if(!fs.existsSync(path.join(root,'assets')))throw Error('Build assets are missing');
const external=[];
for(const name of fs.readdirSync(path.join(root,'assets'))){if(!name.endsWith('.js'))continue;const source=fs.readFileSync(path.join(root,'assets',name),'utf8');if(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-/.test(source))external.push(name);}
if(external.length){console.error('Firebase must be bundled locally; external SDK modules found: '+external.join(', '));process.exitCode=1;}else console.log('Web bundle verified: no external Firebase SDK modules');
