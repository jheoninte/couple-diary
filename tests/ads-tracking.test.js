import {test} from 'node:test';import assert from 'node:assert/strict';import {ensureTrackingDecision} from '../ads-tracking.js';
const visible={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
const noWait=()=>Promise.resolve();
function fakeAdMob(statuses,{grantOnRequest='authorized'}={}){let status=statuses;const calls={request:0};return {calls,
 async trackingAuthorizationStatus(){return {status};},
 async requestTrackingAuthorization(){calls.request++;if(Array.isArray(grantOnRequest))status=grantOnRequest.shift();else status=grantOnRequest;}};}
test('asks for tracking once when the user has not decided yet',async()=>{const ad=fakeAdMob('notDetermined');assert.equal(await ensureTrackingDecision(ad,{doc:visible,wait:noWait}),'authorized');assert.equal(ad.calls.request,1);});
test('never prompts again after a decision (including one made by the UMP IDFA message)',async()=>{for(const s of ['authorized','denied','restricted']){const ad=fakeAdMob(s);assert.equal(await ensureTrackingDecision(ad,{doc:visible,wait:noWait}),s);assert.equal(ad.calls.request,0,s);}});
test('retries once when iOS ignored the request because the app was not active',async()=>{const ad=fakeAdMob('notDetermined',{grantOnRequest:['notDetermined','denied']});assert.equal(await ensureTrackingDecision(ad,{doc:visible,wait:noWait}),'denied');assert.equal(ad.calls.request,2);});
test('waits for the app to be visible before prompting',async()=>{let listener;const doc={visibilityState:'hidden',addEventListener(n,f){if(n==='visibilitychange')listener=f;},removeEventListener(){}};const ad=fakeAdMob('notDetermined');const done=ensureTrackingDecision(ad,{doc,wait:noWait});await new Promise(r=>setTimeout(r,5));assert.equal(ad.calls.request,0);doc.visibilityState='visible';listener();assert.equal(await done,'authorized');assert.equal(ad.calls.request,1);});
test('a plugin failure never blocks ads or the diary',async()=>{const ad={async trackingAuthorizationStatus(){throw Error('unavailable');},async requestTrackingAuthorization(){throw Error('x');}};assert.equal(await ensureTrackingDecision(ad,{doc:visible,wait:noWait}),'unknown');});
