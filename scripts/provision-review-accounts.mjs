// Creates (or repairs) the two linked App Review accounts with sample entries, through the real server API.
// Passwords come from the environment only and are never written or printed.
//
//   REVIEW_PASSWORD_A=... REVIEW_PASSWORD_B=... node scripts/provision-review-accounts.mjs --project couple-diary-75157
//
// Uses the existing Firebase CLI login (same as firebase-operations --firebase-cli-auth) only to mark the two
// review emails as verified. Re-running is safe: existing accounts are reused and sample data is not duplicated.
import {createRequire} from 'node:module';
import path from 'node:path';
import {initializeApp} from 'firebase/app';
import {getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {resolveFirebaseEnvironment} from '../firebase-environment.js';

const require=createRequire(import.meta.url);
const args=process.argv.slice(2),project=args[args.indexOf('--project')+1];
if(project!=='couple-diary-75157')throw Error('--project couple-diary-75157 is required (production review accounts).');
const accounts=[
 {key:'A',email:'reviewer.20261114@comino.app',name:'민서',password:process.env.REVIEW_PASSWORD_A},
 {key:'B',email:'reviewer.partner.20261114@comino.app',name:'지우',password:process.env.REVIEW_PASSWORD_B}
];
if(accounts.some(a=>!a.password))throw Error('Set REVIEW_PASSWORD_A and REVIEW_PASSWORD_B.');

const {config}=resolveFirebaseEnvironment({native:true});
if(config.projectId!==project)throw Error('Production config mismatch.');
const app=initializeApp(config),auth=getAuth(app),functions=getFunctions(app,'asia-northeast3');
const diary=(action,data={})=>httpsCallable(functions,'diary',{timeout:60000})({action,...data}).then(r=>r.data);

async function cliAccessToken(){
 const cli=require('../node_modules/firebase-tools/lib/auth.js'),api=require('../node_modules/firebase-tools/lib/api.js'),account=cli.getGlobalDefaultAccount();
 if(!account)throw Error('Run npx firebase login first.');
 const load=createRequire(path.resolve('functions/package.json')),{UserRefreshClient}=load('google-auth-library');
 return (await new UserRefreshClient(api.clientId(),api.clientSecret(),account.tokens.refresh_token).getAccessToken()).token;
}
async function markVerified(uid){
 const res=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`,{method:'POST',headers:{authorization:`Bearer ${await cliAccessToken()}`,'content-type':'application/json','x-goog-user-project':project},body:JSON.stringify({localId:uid,emailVerified:true})});
 if(!res.ok)throw Error(`verify email failed: ${res.status}`);
}
async function signIn(a){
 try{return (await signInWithEmailAndPassword(auth,a.email,a.password)).user;}
 catch(e){if(!['auth/user-not-found','auth/invalid-credential'].includes(e.code))throw e;}
 return (await createUserWithEmailAndPassword(auth,a.email,a.password)).user;
}
const day=offset=>{const d=new Date(Date.now()-offset*86400000);return d.toISOString().slice(0,10);};

const uid={},state={};
for(const a of accounts){const user=await signIn(a);uid[a.key]=user.uid;if(!user.emailVerified)await markVerified(user.uid);state[a.key]=await diary('initialize');await signOut(auth);}

// Link: A creates the journal and invites, B joins. Skipped when they already share one.
let coupleId=state.A.coupleId;
if(!coupleId||state.B.coupleId!==coupleId){
 if(state.B.coupleId&&state.B.coupleId!==coupleId)throw Error('Partner account is linked to a different journal; resolve manually.');
 await signIn(accounts[0]);
 if(!coupleId)coupleId=(await diary('createSpace',{startDate:'2025-03-14'})).coupleId;
 const invite=await diary('invite',{coupleId});const code=invite.code||invite.inviteCode;await signOut(auth);
 if(!code)throw Error('Invite code missing from response.');
 await signIn(accounts[1]);await diary('join',{code});await signOut(auth);
}

const samples={
 A:{date:day(2),mood:'😊',content:'오늘은 퇴근길에 둘이 좋아하는 카페에 들렀다. 창가 자리에서 다음 여행 이야기를 한참 했다.'},
 B:{date:day(1),mood:'🥰',content:'비가 와서 집에서 영화를 봤다. 같이 만든 파스타가 생각보다 맛있었다.'}
};
for(const a of accounts){
 await signIn(a);
 await diary('settings',{coupleId,startDate:'2025-03-14',settings:{displayName:a.name,appTitle:'우리의 공간',icon:a.key==='A'?'🐶':'🐱',theme:'pink'}});
 try{await diary('saveEntry',{coupleId,...samples[a.key],photos:[],revision:0});}
 catch(e){if(!/aborted/.test(e.code||''))throw e;} // already written earlier
 await signOut(auth);
}
await signIn(accounts[1]);
try{await diary('commentAdd',{coupleId,author:uid.A,date:samples.A.date,id:'review-sample-comment',text:'다음엔 그 창가 자리 예약하자!'});}finally{await signOut(auth);}

console.log(JSON.stringify({project,linked:true,accounts:accounts.map(a=>a.email),entries:2,comment:true}));
process.exit(0);
