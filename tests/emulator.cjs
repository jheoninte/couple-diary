const {test}=require('node:test');const assert=require('node:assert/strict');
const serverRequire=require('node:module').createRequire(require('node:path').resolve('functions/package.json'));
const {initializeApp}=serverRequire('firebase-admin/app');const {getFirestore}=serverRequire('firebase-admin/firestore');
const project='demo-couple-diary',bucket=project+'.appspot.com';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Emulator-only test. Run npm run test:emulator.');
initializeApp({projectId:project,storageBucket:bucket});const db=getFirestore();
async function account(){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${crypto.randomUUID()}@example.test`,password:'test-only-12345',returnSecureToken:true})});assert.equal(r.status,200);return r.json();}
async function call(u,action,data={}){const r=await fetch(`http://127.0.0.1:5001/${project}/asia-northeast3/diary`,{method:'POST',headers:{'content-type':'application/json',...(u?{authorization:'Bearer '+u.idToken}:{})},body:JSON.stringify({data:{action,...data}})});return {status:r.status,...await r.json()};}
async function read(u,path){return fetch(`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/${path}`,{headers:{authorization:'Bearer '+u.idToken}});}
async function upload(u,path,bytes=100){return fetch(`http://127.0.0.1:9199/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`,{method:'POST',headers:{authorization:'Bearer '+u.idToken,'content-type':'image/jpeg'},body:Buffer.alloc(bytes)});}
async function photo(u,path){return fetch(`http://127.0.0.1:9199/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`,{headers:{authorization:'Bearer '+u.idToken}});}
test('two-account callable workflow enforces Firestore and Storage rules',async()=>{
 const a=await account(),b=await account(),eve=await account();assert.equal((await call(null,'initialize')).status,401);
 const created=await call(a,'createSpace',{startDate:'2026-11-01'});assert.equal(created.status,200,JSON.stringify(created));const cid=created.result.coupleId;
 assert.equal((await read(eve,'couples/'+cid)).status,403);
 const invite=await call(a,'invite',{coupleId:cid});assert.equal((await call(b,'join',{code:invite.result.code})).status,200);
 const body={coupleId:cid,date:'2026-11-14',content:'real emulator diary',mood:'😊',photos:[],revision:0};
 const writes=await Promise.all([call(a,'saveEntry',body),call(a,'saveEntry',{...body,content:'concurrent'})]);assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
 assert.equal((await read(b,`couples/${cid}/entries/${a.localId}_2026-11-14`)).status,200);
 const direct=await fetch(`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/couples/${cid}`,{method:'PATCH',headers:{authorization:'Bearer '+a.idToken,'content-type':'application/json'},body:JSON.stringify({fields:{premiumUntil:{integerValue:'9999999999999'}}})});assert.equal(direct.status,403);
 assert.equal((await call(a,'reservePhoto',{coupleId:cid})).status,403);
 await db.doc('couples/'+cid).update({premiumUntil:Date.now()+86400000});
 const reserve=await call(a,'reservePhoto',{coupleId:cid});assert.equal(reserve.status,200);const p=`couples/${cid}/${a.localId}/${reserve.result.filename}`;
 assert.equal((await upload(b,p)).status,403);assert.equal((await upload(a,p,512*1024+1)).status,403);assert.equal((await upload(a,p)).status,200);
 assert.equal((await upload(a,p)).status,403);assert.equal((await photo(b,p)).status,200);assert.equal((await photo(eve,p)).status,403);
 const saved=await call(a,'saveEntry',{...body,photos:[p],revision:1});assert.equal(saved.status,200,JSON.stringify(saved));
 await db.doc('couples/'+cid).update({premiumUntil:0});assert.equal((await photo(a,p)).status,200);
 assert.equal((await call(b,'disconnect',{coupleId:cid})).status,200);
 assert.equal((await read(b,`couples/${cid}/entries/${a.localId}_2026-11-14`)).status,403);
 assert.equal((await read(a,`couples/${cid}/entries/${a.localId}_2026-11-14`)).status,200);
 assert.equal((await photo(b,p)).status,403);assert.equal((await photo(a,p)).status,200);
 const storage=serverRequire('firebase-admin/storage').getStorage().bucket(bucket);
 const orphanId=crypto.randomUUID()+'.jpg',orphan=`couples/${cid}/${a.localId}/${orphanId}`;
 await storage.file(orphan).save(Buffer.alloc(100),{contentType:'image/jpeg'});
 await db.doc(`couples/${cid}/photoReservations/${orphanId}`).set({uid:a.localId,expiresAt:Date.now()-2*86400000,attached:false});
 const {cleanupPhotos}=require('../functions/index.cjs');await cleanupPhotos.run({scheduleTime:new Date().toISOString(),jobName:'local-test'});
 assert.equal((await storage.file(orphan).exists())[0],false);assert.equal((await storage.file(p).exists())[0],true);
});
async function deletion(u,action,data={}){const r=await fetch(`http://127.0.0.1:5001/${project}/asia-northeast3/accountDeletion`,{method:'POST',headers:{'content-type':'application/json',...(u?{authorization:'Bearer '+u.idToken}:{})},body:JSON.stringify({data:{action,...(action==='request'?{expectedUid:u?.localId}:{}),...data}})});return {status:r.status,...await r.json()};}
test('manual deletion resumes after failure and preserves the partner diary',async()=>{
 const a=await account(),b=await account(),outsider=await account(),uid=a.localId;
 const created=await call(a,'createSpace',{startDate:'2026-11-01'}),cid=created.result.coupleId;
 const invite=await call(a,'invite',{coupleId:cid});await call(b,'join',{code:invite.result.code});
 const entry={coupleId:cid,date:'2026-11-13',content:'my diary',mood:'😊',photos:[],revision:0};
 await call(a,'saveEntry',entry);await call(b,'saveEntry',{...entry,content:'partner diary'});
 await call(a,'commentAdd',{coupleId:cid,author:b.localId,date:entry.date,id:'comment-from-deleting-user',text:'delete my comment'});
 await call(a,'like',{coupleId:cid,author:b.localId,date:entry.date,liked:true});
 const storage=serverRequire('firebase-admin/storage').getStorage().bucket(bucket),photoPath=`couples/${cid}/${uid}/${crypto.randomUUID()}.jpg`,partnerPath=`couples/${cid}/${b.localId}/${crypto.randomUUID()}.jpg`;
 await storage.file(photoPath).save(Buffer.alloc(100));await storage.file(partnerPath).save(Buffer.alloc(100));await storage.file(`photos/${uid}/legacy.jpg`).save(Buffer.alloc(10));
 await db.doc(`billingAccounts/${uid}`).set({token:'test-token',chains:{}});await db.doc('billingTokens/test-token').set({uid});await db.doc('appleSubscriptions/test-subscription').set({uid});
 assert.equal((await deletion(null,'request')).status,401);
 assert.equal((await deletion(a,'request',{expectedUid:outsider.localId})).status,400);
 const request=await deletion(a,'request',{uid:outsider.localId});assert.equal(request.status,200,JSON.stringify(request));
 assert.equal((await deletion(null,'status',{receipt:request.result.receipt})).result.status,'pending');
 assert.equal((await read(a,`couples/${cid}/entries/${uid}_${entry.date}`)).status,403);
 assert.equal((await photo(a,photoPath)).status,403);assert.equal((await call(a,'initialize')).status,403);
 assert.equal((await read(b,`couples/${cid}/entries/${b.localId}_${entry.date}`)).status,200);
 assert.equal((await db.doc(`accountDeletions/${outsider.localId}`).get()).exists,false);
 const {advanceDeletion}=require('../functions/deletion-worker.cjs'),adminAuth=serverRequire('firebase-admin/auth').getAuth();
 let failedOnce=false,complete=false;
 const deps={db,bucket:storage,auth:{async deleteUser(id){if(!failedOnce){failedOnce=true;throw Object.assign(Error('simulated network outage'),{code:'network-unavailable'});}return adminAuth.deleteUser(id);}}};
 for(let i=0;i<60;i++){
  try{const result=await advanceDeletion(deps,uid,{batchSize:1});if(result.status==='complete'){complete=true;break;}}
  catch(e){assert.equal(e.code,'network-unavailable');assert.equal((await db.doc(`accountDeletions/${uid}`).get()).data().phase,'authentication');}
 }
 assert.equal(complete,true);assert.equal(failedOnce,true);await assert.rejects(adminAuth.getUser(uid),{code:'auth/user-not-found'});
 assert.equal((await db.doc(`couples/${cid}/entries/${uid}_${entry.date}`).get()).exists,false);
 const partner=(await db.doc(`couples/${cid}/entries/${b.localId}_${entry.date}`).get()).data();assert.equal(partner.content,'partner diary');assert.deepEqual(partner.comments,[]);assert.deepEqual(partner.likedBy,[]);
 assert.equal((await storage.file(photoPath).exists())[0],false);assert.equal((await storage.file(partnerPath).exists())[0],true);assert.equal((await storage.file(`photos/${uid}/legacy.jpg`).exists())[0],false);
 for(const p of [`users/${uid}`,`billingAccounts/${uid}`,'billingTokens/test-token','appleSubscriptions/test-subscription'])assert.equal((await db.doc(p).get()).exists,false);
 assert.equal((await deletion(null,'status',{receipt:request.result.receipt})).result.status,'complete');
 const state=(await db.doc(`couples/${cid}`).get()).data();assert.ok(![state.user1,state.user2].includes(uid));
});
test('scoped backup verifies photo bytes, restores into an empty project and migrates without overwriting',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
 const {exportCouple,readBackup,restoreCouple}=require('../scripts/backup-core.cjs'),{migrateCouple}=require('../scripts/migration-core.cjs');
 const cid='migration-'+crypto.randomUUID(),uid='backup-'+crypto.randomUUID(),partner='partner-'+crypto.randomUUID(),sourceBucket=serverRequire('firebase-admin/storage').getStorage().bucket(bucket);
 const photoPath=`photos/${uid}/old.jpg`,token=crypto.randomUUID(),source={user1:uid,user2:partner,startDate:'2026-01-01',createdAt:'2026-01-01T00:00:00.000Z',settings:{},anniversaries:[],myEntries:{[uid]:{'2026-11-14':{content:'original backup record',mood:'😊',photos:[`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(photoPath)}?alt=media&token=${token}`],comments:[]}},[partner]:{}}};
 await db.doc(`couples/${cid}`).set(source);await db.doc(`users/${uid}`).set({coupleId:cid});await db.doc(`users/${partner}`).set({coupleId:cid});
 const bytes=Buffer.from('fixture image bytes');await sourceBucket.file(photoPath).save(bytes,{metadata:{contentType:'image/jpeg',metadata:{firebaseStorageDownloadTokens:token}}});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'couple-migration-')),backupDir=path.join(dir,'original');
 const summary=await exportCouple({db,bucket:sourceBucket,projectId:project,coupleId:cid,dir:backupDir,maintenanceConfirmed:true});assert.equal(summary.objects,1);const manifest=await readBackup(backupDir);
 const targetProject='demo-couple-diary-restore',targetBucketName=targetProject+'.appspot.com',targetApp=initializeApp({projectId:targetProject,storageBucket:targetBucketName},'restore-'+crypto.randomUUID());
 const targetDB=getFirestore(targetApp),targetBucket=serverRequire('firebase-admin/storage').getStorage(targetApp).bucket();
 const preview=await restoreCouple({db:targetDB,bucket:targetBucket,projectId:targetProject,dir:backupDir});assert.equal(preview.dryRun,true);assert.equal((await targetDB.doc(`couples/${cid}`).get()).exists,false);
 let restoreFailed=false;
 const unreliableBucket={name:targetBucket.name,file(name){const file=targetBucket.file(name),save=file.save.bind(file);file.save=async(...args)=>{if(!restoreFailed){restoreFailed=true;throw Error('simulated restore interruption');}return save(...args);};return file;}};
 await assert.rejects(restoreCouple({db:targetDB,bucket:unreliableBucket,projectId:targetProject,dir:backupDir,execute:true}),/interruption/);
 await restoreCouple({db:targetDB,bucket:targetBucket,projectId:targetProject,dir:backupDir,execute:true});assert.deepEqual((await targetBucket.file(photoPath).download())[0],bytes);
 assert.equal((await restoreCouple({db:targetDB,bucket:targetBucket,projectId:targetProject,dir:backupDir,execute:true})).alreadyComplete,true);
 const restoredBackup=path.join(dir,'restored');await exportCouple({db:targetDB,bucket:targetBucket,projectId:targetProject,coupleId:cid,dir:restoredBackup,maintenanceConfirmed:true});
 const options={db:targetDB,bucket:targetBucket,projectId:targetProject,dir:restoredBackup};assert.equal((await migrateCouple(options)).entries,1);
 // Simulate a partial migration that copied an identical entry; it must be safely resumed.
 const {planLegacyCouple}=require('../functions/legacy-migration.cjs'),rootBefore=(await targetDB.doc(`couples/${cid}`).get()).data(),plan=planLegacyCouple(cid,rootBefore,targetBucketName);
 await targetDB.doc(`couples/${cid}/entries/${plan.entries[0].id}`).set(plan.entries[0].data);
 let tokenResponseLost=false;
 const unreliableMigrationBucket={name:targetBucket.name,file(name){const file=targetBucket.file(name),set=file.setMetadata.bind(file);file.setMetadata=async(...args)=>{const result=await set(...args);if(!tokenResponseLost){tokenResponseLost=true;throw Error('simulated token response lost');}return result;};return file;}};
 await assert.rejects(migrateCouple({...options,bucket:unreliableMigrationBucket,execute:true}),/response lost/);
 assert.equal((await targetDB.doc(`couples/${cid}`).get()).data().status,'migrating');
 const {createDeletionRequests}=require('../functions/deletion-requests.cjs');
 const requests=createDeletionRequests({transaction:fn=>targetDB.runTransaction(async native=>{const writes=[];const result=await fn({get:async p=>(await native.get(targetDB.doc(p))).data(),set:(p,v)=>writes.push(()=>native.set(targetDB.doc(p),v)),delete:p=>writes.push(()=>native.delete(targetDB.doc(p)))});writes.forEach(f=>f());return result;})});
 await assert.rejects(requests.request(uid,Math.floor(Date.now()/1000)),{code:'failed-precondition'});
 assert.equal((await targetDB.doc(`users/${uid}`).get()).data().coupleId,cid);
 const result=await migrateCouple({...options,execute:true});assert.equal(result.migrated,true);assert.equal((await targetDB.doc(`couples/${cid}`).get()).data().schemaVersion,2);
 assert.equal((await targetDB.doc(`couples/${cid}/entries/${uid}_2026-11-14`).get()).data().content,'original backup record');assert.equal((await migrateCouple({...options,execute:true})).alreadyComplete,true);
 assert.equal((await db.doc(`couples/${cid}`).get()).data().myEntries[uid]['2026-11-14'].content,'original backup record');
 // A modified file invalidates the backup before any target write can begin.
 await fs.writeFile(path.join(backupDir,manifest.objects[0].file),'corrupt');await assert.rejects(readBackup(backupDir),/integrity/);
});
