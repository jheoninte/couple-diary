const {spawn}=require('node:child_process');
const args=['node_modules/firebase-tools/lib/bin/firebase.js',process.argv.includes('--test')?'emulators:exec':'emulators:start','--project','demo-couple-diary','--only','auth,firestore,storage,functions,hosting'];
if(process.argv.includes('--test'))args.push('node --test --test-timeout=120000 tests/emulator.cjs');
const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,GCLOUD_PROJECT:'demo-couple-diary'}});child.on('exit',code=>process.exit(code??1));
