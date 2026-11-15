import {test} from 'node:test';
import assert from 'node:assert/strict';
const calls=[];
// diary-api.js talks to Firebase; the client only needs call/getUser, so the module is loaded with a stub.
const {createPushClient,targetFor}=await import('data:text/javascript,'+encodeURIComponent(
  (await import('node:fs')).readFileSync(new URL('../push-client.js',import.meta.url),'utf8')
   .replace("import { call, getUser } from './diary-api.js';","const call=async(a,d)=>{globalThis.__calls.push([a,d]);};const getUser=async()=>({notify:{diary:false}});")
   .replace("import { validDate } from './web-core.js';",`import { validDate } from '${new URL('../web-core.js',import.meta.url)}';`)));
globalThis.__calls=calls;
function plugin(initial='prompt'){let status=initial;return {asked:0,status:async()=>({status}),register:async function(){this.asked++;if(status==='prompt')status='granted';return status==='granted'?{status,token:'f'.repeat(64),environment:'production'}:{status};},openSettings:async function(){this.settings=true;},set(v){status=v;}};}
const session={uid:'alice',coupleId:'space'};
test('a tapped notification opens only entries of the current space',()=>{
 assert.deepEqual(targetFor({kind:'comment',coupleId:'space',date:'2026-11-15'},session),{date:'2026-11-15'});
 assert.equal(targetFor({kind:'comment',coupleId:'old',date:'2026-11-15'},session),null);
 assert.equal(targetFor({kind:'connected',coupleId:'space'},session),null);
 assert.equal(targetFor({kind:'diary',coupleId:'space',date:'../x'},session),null);
 assert.equal(targetFor({kind:'diary',coupleId:'space',date:'2026-11-15'},{...session,archive:true}),null);
});
test('launch never shows the system prompt; the first saved diary offers it once',async()=>{
 calls.length=0;const p=plugin(),confirms=[];let accepted;
 const c=createPushClient({plugin:p,locale:()=>'ja',status:()=>{},confirm:fn=>{confirms.push(fn);accepted=fn;},open:()=>{}});
 await c.context(session);assert.equal(p.asked,0);assert.equal(calls.length,0);
 assert.equal(await c.context({...session}),false);
 await c.offer();await c.offer();assert.equal(confirms.length,1);
 await accepted();assert.equal(p.asked,1);assert.deepEqual(calls[0],['pushRegister',{token:'f'.repeat(64),environment:'production',locale:'ja'}]);
 await c.signOut();assert.deepEqual(calls.at(-1),['pushUnregister',{token:'f'.repeat(64)}]);
});
test('granted devices refresh silently and denied ones are sent to Settings',async()=>{
 calls.length=0;const granted=plugin('granted');await createPushClient({plugin:granted,locale:()=>'ko',status(){},confirm(){},open(){}}).context(session);assert.equal(calls[0][0],'pushRegister');
 const denied=plugin('denied'),c=createPushClient({plugin:denied,locale:()=>'ko',status(){},confirm(){},open(){}});await c.context(session);
 assert.equal(await c.enable(),'denied');assert.equal(denied.settings,true);
});
test('taps wait until the diary is loaded',async()=>{
 const opened=[],c=createPushClient({plugin:plugin('denied'),locale:()=>'ko',status(){},confirm(){},open:t=>opened.push(t)});
 c.opened({kind:'like',coupleId:'space',date:'2026-11-14'});await c.context(session);assert.equal(opened.length,0);
 c.ready();assert.deepEqual(opened,[{date:'2026-11-14'}]);
 assert.deepEqual(await c.preferences(),{diary:false,reactions:true});
});
