const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createService}=require('../functions/service.cjs');
const {createPush,createApnsSender,tokenId}=require('../functions/push.cjs');
const {render,resolveLanguage,LANGUAGES,KEYS}=require('../functions/push-messages.cjs');
const TOKEN='a'.repeat(64),TOKEN2='b'.repeat(64);
function fixture(){
 const docs=new Map(),events=[];
 const store={async transaction(fn){const staged=new Map(docs);const result=await fn({get:async p=>structuredClone(staged.get(p)),set:(p,v)=>staged.set(p,structuredClone(v)),delete:p=>staged.delete(p)});docs.clear();for(const [k,v] of staged)docs.set(k,v);return result;}};
 return {docs,events,run:createService(store,{now:()=>Date.UTC(2026,10,15),notify:async e=>{events.push(...e);}}).execute};
}
async function couple(f){
 const cid=(await f.run('alice',{action:'createSpace',startDate:'2026-11-01'})).coupleId;const {code}=await f.run('alice',{action:'invite',coupleId:cid});
 await f.run('bob',{action:'join',code});await f.run('alice',{action:'settings',coupleId:cid,startDate:'2026-11-01',settings:{displayName:'지수',appTitle:'우리',icon:'🐶',theme:'pink'}});
 f.events.length=0;return cid;
}
const entry=(cid,extra={})=>({action:'saveEntry',coupleId:cid,date:'2026-11-15',content:'오늘',mood:'😊',photos:[],revision:0,...extra});

test('joining notifies the inviter that the partner connected',async()=>{
 const f=fixture(),cid=(await f.run('alice',{action:'createSpace',startDate:'2026-11-01'})).coupleId,{code}=await f.run('alice',{action:'invite',coupleId:cid});
 await f.run('bob',{action:'join',code});assert.deepEqual(f.events.map(e=>[e.kind,e.to]),[['connected','alice']]);
});
test('a new diary is announced to the partner once, never on edits',async()=>{
 const f=fixture(),cid=await couple(f);await f.run('alice',entry(cid));
 assert.equal(f.events.length,1);assert.deepEqual([f.events[0].kind,f.events[0].to,f.events[0].name,f.events[0].date],['diary','bob','지수','2026-11-15']);
 await f.run('alice',entry(cid,{revision:1,content:'수정'}));await f.run('alice',{action:'deleteEntry',coupleId:cid,date:'2026-11-15',revision:2});
 await f.run('alice',entry(cid,{revision:3}));assert.equal(f.events.length,1);
});
test('a diary written before the partner joins is not announced',async()=>{
 const f=fixture(),cid=(await f.run('alice',{action:'createSpace',startDate:'2026-11-01'})).coupleId;await f.run('alice',entry(cid));assert.equal(f.events.length,0);
});
test('hearts notify the author once per person and never for your own entry',async()=>{
 const f=fixture(),cid=await couple(f);await f.run('alice',entry(cid));f.events.length=0;
 const like=liked=>f.run('bob',{action:'like',coupleId:cid,author:'alice',date:'2026-11-15',liked});
 await like(true);await like(false);await like(true);
 assert.deepEqual(f.events.map(e=>[e.kind,e.to]),[['like','alice']]);
 await f.run('alice',{action:'like',coupleId:cid,author:'alice',date:'2026-11-15',liked:true});assert.equal(f.events.length,1);
});
test('comments go to the author, and the author reply goes back to the partner',async()=>{
 const f=fixture(),cid=await couple(f);await f.run('alice',entry(cid));f.events.length=0;
 const comment=(uid,id,text)=>f.run(uid,{action:'commentAdd',coupleId:cid,author:'alice',date:'2026-11-15',id,text});
 await comment('alice','c0','혼잣말');assert.equal(f.events.length,0);
 await comment('bob','c1','  좋았겠다  ');await comment('alice','c2','응 최고였어');await comment('bob','c1','  좋았겠다  ');
 assert.deepEqual(f.events.map(e=>[e.kind,e.to,e.text]),[['comment','alice','좋았겠다'],['reply','bob','응 최고였어']]);
});
test('tokens move between accounts on the same device and are capped per user',async()=>{
 const f=fixture();await f.run('alice',{action:'initialize'});await f.run('bob',{action:'initialize'});
 await f.run('alice',{action:'pushRegister',token:TOKEN,environment:'production',locale:'ko'});
 await f.run('bob',{action:'pushRegister',token:TOKEN,environment:'production',locale:'ja'});
 assert.equal(f.docs.get('pushDevices/alice').devices.length,0);assert.equal(f.docs.get('pushTokens/'+tokenId(TOKEN)).uid,'bob');
 for(let i=0;i<7;i++)await f.run('bob',{action:'pushRegister',token:String(i).repeat(64),locale:'ja'});
 assert.equal(f.docs.get('pushDevices/bob').devices.length,5);assert.equal([...f.docs.keys()].filter(k=>k.startsWith('pushTokens/')).length,5);
 await assert.rejects(f.run('bob',{action:'pushRegister',token:'not-a-token'}),{code:'invalid-argument'});
 await f.run('bob',{action:'pushUnregister',token:'6'.repeat(64)});assert.equal(f.docs.get('pushDevices/bob').devices.length,4);
});
test('preferences are validated and stored on the user',async()=>{
 const f=fixture();await f.run('alice',{action:'initialize'});
 await assert.rejects(f.run('alice',{action:'pushPrefs',notify:{diary:'no'}}),{code:'invalid-argument'});
 await f.run('alice',{action:'pushPrefs',notify:{diary:false,reactions:true}});assert.deepEqual(f.docs.get('users/alice').notify,{diary:false,reactions:true});
});
test('delivery respects preferences, the current space and removes dead tokens',async()=>{
 const docs={'pushDevices/alice':{devices:[{id:'1',token:TOKEN,locale:'ko'},{id:'2',token:TOKEN2,locale:'en'}]},'users/alice':{coupleId:'c',notify:{diary:true,reactions:false}}};
 const sent=[],removed=[];
 const deliver=createPush({read:async p=>docs[p],removeDevices:async(uid,ids)=>removed.push([uid,ids]),send:async(d,m)=>{sent.push([d.id,m]);return d.id==='2'?'invalid':'sent';},log:{error(){}}});
 await deliver([{kind:'like',to:'alice',coupleId:'c',name:'민준',date:'2026-11-15'},{kind:'diary',to:'alice',coupleId:'other',date:'2026-11-15'}]);
 assert.equal(sent.length,0);
 await deliver([{kind:'diary',to:'alice',coupleId:'c',author:'bob',name:'민준',date:'2026-11-15',thread:'diary-c'}]);
 assert.equal(sent[0][1].title,'💌 민준님의 일기가 도착했어요');assert.equal(sent[0][1].body,'11월 15일, 어떤 하루였는지 읽어보세요.');
 assert.equal(sent[1][1].title,'💌 민준 wrote a new diary entry');assert.deepEqual(sent[0][1].data,{kind:'diary',coupleId:'c',author:'bob',date:'2026-11-15'});
 assert.deepEqual(removed,[['alice',['2']]]);
});
test('every language has every message and keeps placeholders',()=>{
 assert.equal(LANGUAGES.length,18);
 for(const lang of LANGUAGES)for(const kind of ['diary','like','comment','reply','connected']){
  const named=render(kind,{name:'Ana',date:'2026-11-15',text:'hi'},lang),anonymous=render(kind,{date:'2026-11-15',text:'hi'},lang);
  for(const m of [named,anonymous]){assert.ok(m.title&&m.body,`${lang} ${kind}`);assert.doesNotMatch(m.title+m.body,/[{}]/,`${lang} ${kind}`);}
  assert.match(named.title,/Ana/,`${lang} ${kind}`);
 }
 assert.equal(KEYS.length,10);assert.equal(resolveLanguage('zh-TW'),'zh-Hant');assert.equal(resolveLanguage('pt-PT'),'pt-BR');assert.equal(resolveLanguage('xx'),'en');
 assert.equal(render('connected',{},'ko').title,'🎉 연인과 연결되었어요');
 assert.equal(render('comment',{text:'가'.repeat(150)},'ko').body.length,100);
});
test('APNs sender signs an ES256 token and maps invalid tokens',async()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});const requests=[];
 const fake={connect(){const s=new (require('node:events'))();s.request=headers=>{const r=new (require('node:events'))();r.setTimeout=()=>{};r.setEncoding=()=>{};r.close=()=>{};
  r.end=body=>{requests.push({headers,body:JSON.parse(body)});const bad=headers[':path'].includes(TOKEN2);setImmediate(()=>{r.emit('response',{':status':bad?400:200});if(bad)r.emit('data',JSON.stringify({reason:'BadDeviceToken'}));r.emit('end');});};return r;};return s;}};
 const send=createApnsSender({keyId:'KEY123',teamId:'TEAM',bundleId:'com.interest.couplediary',key:privateKey.export({type:'pkcs8',format:'pem'}),http2:fake,now:()=>Date.UTC(2026,10,15)});
 assert.equal(await send({token:TOKEN,environment:'production'},{title:'t',body:'b',thread:'x',collapse:'like-1',data:{kind:'like'}}),'sent');
 assert.equal(await send({token:TOKEN2,environment:'development'},{title:'t',body:'b',data:{}}),'invalid');
 const {headers,body}=requests[0],[h,c,sig]=headers.authorization.slice(7).split('.');
 assert.ok(crypto.verify('sha256',Buffer.from(`${h}.${c}`),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')));
 assert.equal(headers['apns-topic'],'com.interest.couplediary');assert.equal(headers['apns-collapse-id'],'like-1');
 assert.deepEqual(body,{aps:{alert:{title:'t',body:'b'},sound:'default','thread-id':'x'},kind:'like'});
});
