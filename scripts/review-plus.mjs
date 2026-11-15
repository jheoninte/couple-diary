// Temporarily grants (or removes) Plus on the production App Review couple for QA, then can be reverted.
//   node scripts/review-plus.mjs grant 24   # hours
//   node scripts/review-plus.mjs revoke
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),project='couple-diary-75157',email='reviewer.20261114@comino.app';
const [mode,hours='24']=process.argv.slice(2);if(!['grant','revoke'].includes(mode))throw Error('grant <hours> | revoke');
const cli=require('../node_modules/firebase-tools/lib/auth.js'),api=require('../node_modules/firebase-tools/lib/api.js'),account=cli.getGlobalDefaultAccount();
const {UserRefreshClient}=createRequire(path.resolve('functions/package.json'))('google-auth-library');
const token=(await new UserRefreshClient(api.clientId(),api.clientSecret(),account.tokens.refresh_token).getAccessToken()).token;
const H={authorization:`Bearer ${token}`,'content-type':'application/json','x-goog-user-project':project};
const look=await (await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,{method:'POST',headers:H,body:JSON.stringify({email:[email]})})).json();
const uid=look.users[0].localId,doc=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const user=await (await fetch(`${doc}/users/${uid}`,{headers:H})).json(),cid=user.fields.coupleId.stringValue;
const until=mode==='grant'?Date.now()+Number(hours)*3600000:0;
const r=await fetch(`${doc}/couples/${cid}?updateMask.fieldPaths=premiumUntil`,{method:'PATCH',headers:H,body:JSON.stringify({fields:{premiumUntil:{integerValue:String(until)}}})});
console.log(mode,r.status,until?new Date(until).toISOString():'off');
