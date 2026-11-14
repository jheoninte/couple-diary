const {test}=require('node:test'),assert=require('node:assert/strict');
test('password reset permits new password, rejects old password and invalid reset links',async()=>{
 const email=`recovery-ux-${Date.now()}@example.invalid`,base='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:';
 const call=async(action,data)=>{const r=await fetch(base+action+'?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
 const created=await call('signUp',{email,password:'Original-Password-2026!',returnSecureToken:true});assert.equal(created.status,200);
 const duplicate=await call('signUp',{email,password:'Original-Password-2026!',returnSecureToken:true});assert.equal(duplicate.status,400);
 assert.equal((await call('sendOobCode',{email,requestType:'PASSWORD_RESET'})).status,200);
 const actions=await (await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-couple-diary/oobCodes')).json();const row=actions.oobCodes.find(v=>v.email===email&&v.requestType==='PASSWORD_RESET');assert.ok(row);
 assert.equal((await call('resetPassword',{oobCode:'invalid-link',newPassword:'Updated-Password-2026!'})).status,400);
 assert.equal((await call('resetPassword',{oobCode:row.oobCode,newPassword:'Updated-Password-2026!'})).status,200);
 assert.equal((await call('signInWithPassword',{email,password:'Original-Password-2026!',returnSecureToken:true})).status,400);
 assert.equal((await call('signInWithPassword',{email,password:'Updated-Password-2026!',returnSecureToken:true})).status,200);
});
