const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
let failed=false;for(const dir of ['.','functions','scripts','tests'])for(const file of fs.readdirSync(dir)){if(!/\.(js|cjs)$/.test(file))continue;const p=path.join(dir,file),r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0){failed=true;console.error(r.stderr);}}
for(const f of ['index.html','login.html','couple-connect.html','account-delete.html'])if(!fs.existsSync(f)){failed=true;console.error('Missing build entry:',f);}
if(!failed)console.log('JavaScript syntax and build entries OK');process.exitCode=failed?1:0;
