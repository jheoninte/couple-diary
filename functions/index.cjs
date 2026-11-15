const {initializeApp,getApps}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const {setGlobalOptions}=require('firebase-functions/v2');
const {defineSecret}=require('firebase-functions/params');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');const path=require('node:path');
const {createService,DomainError}=require('./service.cjs');
const {validateTransaction,mergeEntitlements,acceptedEnvironments,decodeSigned}=require('./billing.cjs');
const {createPush,createApnsSender}=require('./push.cjs');
if(!getApps().length)initializeApp();const db=getFirestore();
setGlobalOptions({region:'asia-northeast3',minInstances:0,maxInstances:2,memory:'256MiB',cpu:'gcf_gen1',concurrency:1,timeoutSeconds:60});
const minimalTestflight=process.env.DIARY_TESTFLIGHT_BACKEND==='true';
const privateKey=minimalTestflight?{value(){throw Error('Billing disabled in internal TestFlight');}}:defineSecret('APPLE_PRIVATE_KEY');
// Stage writes until all reads finish: Firestore transactions require read-before-write.
const store={transaction:fn=>db.runTransaction(async native=>{const writes=[];const result=await fn({get:async p=>(await native.get(db.doc(p))).data(),set:(p,v)=>writes.push(()=>native.set(db.doc(p),v)),delete:p=>writes.push(()=>native.delete(db.doc(p)))});writes.forEach(write=>write());return result;}),async photoExists(p){try{const [m]=await getStorage().bucket().file(p).getMetadata();return Number(m.size)<=512*1024&&m.contentType==='image/jpeg';}catch{return false;}},async savePhoto(p,buffer){await getStorage().bucket().file(p).save(buffer,{contentType:'image/jpeg',resumable:false});},async readPhoto(p){const [buffer]=await getStorage().bucket().file(p).download();return buffer;}};
// Push is off until PUSH_ENABLED=true and the APNs key secret exist, so deploys keep working without them.
const pushEnabled=process.env.PUSH_ENABLED==='true';
const apnsKey=pushEnabled?defineSecret('APNS_AUTH_KEY'):null;
let apns=null;
function apnsSender(){
 if(!apns)apns=createApnsSender({keyId:process.env.APNS_KEY_ID,teamId:process.env.APNS_TEAM_ID||'79978S7426',bundleId:'com.interest.couplediary',key:apnsKey.value()});
 return apns;
}
const notify=pushEnabled?createPush({
 read:async p=>(await db.doc(p).get()).data(),
 removeDevices:(uid,ids)=>db.runTransaction(async tx=>{const ref=db.doc(`pushDevices/${uid}`),row=(await tx.get(ref)).data();if(!row)return;tx.set(ref,{devices:(row.devices||[]).filter(d=>!ids.includes(d.id))});ids.forEach(id=>tx.delete(db.doc(`pushTokens/${id}`)));}),
 send:(device,message)=>apnsSender()(device,message)
}):null;
const service=createService(store,{notify});
const deletionRequests=require('./deletion-requests.cjs').createDeletionRequests(store);
async function callable(fn){try{return await fn();}catch(e){if(e instanceof HttpsError)throw e;if(e instanceof DomainError)throw new HttpsError(e.code,e.message,e.details);console.error('Server operation failed',e.code||e.name);throw new HttpsError('internal','요청 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');}}
exports.diary=onCall({timeoutSeconds:540,secrets:apnsKey?[apnsKey]:[]},req=>callable(()=>{
 if(process.env.DIARY_WRITES_ENABLED==='false'&&!['initialize','membership','readPhoto','pushUnregister'].includes(req.data?.action))throw new HttpsError('unavailable','서버 점검 중입니다. 작성 중인 초안을 보관하고 잠시 후 다시 시도해주세요.');
 if(process.env.PHOTO_UPLOADS_ENABLED==='false'&&(req.data?.action==='reservePhoto'||req.data?.action==='uploadPhoto'))throw new HttpsError('unavailable','사진 업로드를 점검 중입니다. 잠시 후 다시 시도해주세요.');
 return service.execute(req.auth?.uid,req.data);
}));
exports.accountDeletion=onCall(req=>callable(async()=>{
 if(req.data?.action==='status')return deletionRequests.status(req.data.receipt);
 if(req.data?.action==='request'){
  if(!req.auth)throw new HttpsError('unauthenticated','로그인해주세요.');
  if(req.data.expectedUid!==req.auth.uid)throw new HttpsError('failed-precondition','로그인 계정이 변경되었습니다. 다시 확인해주세요.');
  return deletionRequests.request(req.auth.uid,req.auth.token.auth_time,req.auth.token.email||'');
 }
 if(req.data?.action==='state'){
  if(!req.auth)throw new HttpsError('unauthenticated','로그인해주세요.');
  const row=(await db.doc(`accountDeletions/${req.auth.uid}`).get()).data();return {requested:!!row,status:row?.status||null};
 }
 throw new HttpsError('invalid-argument','지원하지 않는 작업입니다.');
}));
function appleConfig(){return {bundleId:'com.interest.couplediary',environment:process.env.APPLE_ENVIRONMENT||'Sandbox',appAppleId:Number(process.env.APPLE_APP_ID),issuer:process.env.APPLE_ISSUER_ID,keyId:process.env.APPLE_KEY_ID};}
function verifier(environment=appleConfig().environment){const {SignedDataVerifier,Environment}=require('@apple/app-store-server-library');const c=appleConfig();if(!['Sandbox','Production'].includes(c.environment)||!acceptedEnvironments(c).includes(environment))throw new Error('Invalid Apple environment');const root=path.join(__dirname,'certs/AppleRootCA-G3.cer');return new SignedDataVerifier([fs.readFileSync(root)],true,environment==='Production'?Environment.PRODUCTION:Environment.SANDBOX,c.bundleId,environment==='Production'?c.appAppleId:undefined);}
// Production first, then Sandbox only when Apple reports an environment mismatch (App Review / TestFlight purchases).
function decode(method,signed){return decodeSigned(acceptedEnvironments(appleConfig()),verifier,method,signed);}
function api(environment=appleConfig().environment){const {AppStoreServerAPIClient,Environment}=require('@apple/app-store-server-library');const c=appleConfig();if(!acceptedEnvironments(c).includes(environment))throw new Error('Invalid Apple environment');return new AppStoreServerAPIClient(privateKey.value(),c.keyId,c.issuer,c.bundleId,environment==='Production'?Environment.PRODUCTION:Environment.SANDBOX);}
function enabled(){const c=appleConfig();return process.env.APPLE_BILLING_ENABLED==='true'&&!!c.keyId&&!!c.issuer&&fs.existsSync(path.join(__dirname,'certs/AppleRootCA-G3.cer'))&&(c.environment!=='Production'||Number.isSafeInteger(c.appAppleId));}
async function tokenFor(uid){return db.runTransaction(async tx=>{const deleted=await tx.get(db.doc(`accountDeletions/${uid}`));if(deleted.exists)throw new DomainError('permission-denied','계정 삭제 요청을 처리 중입니다.',{accountDeletion:true});const ref=db.doc(`billingAccounts/${uid}`),s=await tx.get(ref);if(s.exists)return s.data().token;const token=randomUUID();tx.set(ref,{token});tx.set(db.doc(`billingTokens/${token}`),{uid});return token;});}
async function applyTransaction(uid,row){
 const token=await tokenFor(uid),value=validateTransaction(row,token,appleConfig());
 return db.runTransaction(async tx=>{
  if((await tx.get(db.doc(`accountDeletions/${uid}`))).exists)return {transactionId:value.transactionId,deleted:true};
  const accountRef=db.doc(`billingAccounts/${uid}`),account=(await tx.get(accountRef)).data();const boundRef=db.doc(`appleSubscriptions/${value.originalTransactionId}`),bound=(await tx.get(boundRef)).data();
  if(bound&&bound.uid!==uid)throw new DomainError('permission-denied','다른 계정에 연결된 구독입니다.');
  if(bound&&bound.signedDate>value.signedDate)return {superseded:true,transactionId:value.transactionId};
  const merged=mergeEntitlements(account.chains||{},value);
  const ur=db.doc(`users/${uid}`),u=(await tx.get(ur)).data()||{};const cr=u.coupleId?db.doc(`couples/${u.coupleId}`):null,c=cr?(await tx.get(cr)).data():null;
  const partner=c?[c.user1,c.user2].find(v=>v&&v!==uid):null,p=partner?(await tx.get(db.doc(`users/${partner}`))).data():null;
  tx.set(boundRef,{...value,uid});tx.set(accountRef,{...account,chains:merged.chains});tx.set(ur,{...u,billingUntil:merged.premiumUntil});
  if(c?.status==='active'&&[c.user1,c.user2].includes(uid))tx.update(cr,{premiumUntil:Math.max(merged.premiumUntil,p?.billingUntil||0)});
  return {transactionId:value.transactionId};
 });
}
exports.appleBilling=onCall({secrets:minimalTestflight?[]:[privateKey]},req=>callable(async()=>{
 if(!req.auth)throw new HttpsError('unauthenticated','먼저 로그인해주세요.');const uid=req.auth.uid,action=req.data?.action;
 if((await db.doc(`accountDeletions/${uid}`).get()).exists)throw new HttpsError('permission-denied','계정 삭제 요청을 처리 중입니다.');
 if(action==='availability')return {available:enabled()};if(!enabled())throw new HttpsError('failed-precondition','Apple 결제 서버를 준비 중입니다.');
 if(action==='accountToken')return {appAccountToken:await tokenFor(uid)};
 if(action==='verify'){
  if(typeof req.data.signedTransaction!=='string'||req.data.signedTransaction.length>30000)throw new HttpsError('invalid-argument','결제 정보를 확인해주세요.');
  const submitted=await decode('verifyAndDecodeTransaction',req.data.signedTransaction);validateTransaction(submitted,await tokenFor(uid),appleConfig());
  // Query Apple for the latest status rather than trusting an old, valid purchase JWS.
  const statuses=await api(submitted.environment).getAllSubscriptionStatuses(submitted.originalTransactionId);let result;
  for(const group of statuses.data||[])for(const last of group.lastTransactions||[])if(last.originalTransactionId===submitted.originalTransactionId&&last.signedTransactionInfo)result=await applyTransaction(uid,await decode('verifyAndDecodeTransaction',last.signedTransactionInfo));
  if(!result)throw new HttpsError('failed-precondition','현재 구독 상태를 확인할 수 없습니다.');return {...result,transactionId:submitted.transactionId};
 }
 if(action==='refresh'){
  const account=(await db.doc(`billingAccounts/${uid}`).get()).data();
  for(const [chain,info] of Object.entries(account?.chains||{})){
   const response=await api(info?.environment||appleConfig().environment).getAllSubscriptionStatuses(chain);
   for(const group of response.data||[])for(const last of group.lastTransactions||[])if(last.originalTransactionId===chain&&last.signedTransactionInfo)await applyTransaction(uid,await decode('verifyAndDecodeTransaction',last.signedTransactionInfo));
  }return {};
 }
 throw new HttpsError('invalid-argument','지원하지 않는 작업입니다.');
}));
exports.appleNotifications=onRequest({maxInstances:1},async(req,res)=>{
 if(req.method!=='POST'){res.sendStatus(405);return;}if(!enabled()){res.sendStatus(503);return;}
 try{if(typeof req.body?.signedPayload!=='string'||req.body.signedPayload.length>100000){res.sendStatus(400);return;}
  const notification=await decode('verifyAndDecodeNotification',req.body.signedPayload);const signed=notification.data?.signedTransactionInfo;if(!signed){res.sendStatus(200);return;}
  const row=await decode('verifyAndDecodeTransaction',signed);const owner=row.appAccountToken?(await db.doc(`billingTokens/${row.appAccountToken}`).get()).data():null;
  if(owner)await applyTransaction(owner.uid,row);res.sendStatus(200);
 }catch(e){console.error('Apple notification rejected',e.code||e.name);res.sendStatus(e instanceof DomainError?400:500);}
});

// Bounded hourly cleanup: abandoned reservations and detached photos are retained for 24h
// before removal, avoiding any deletion on an ambiguous client network failure.
const {onSchedule}=require('firebase-functions/v2/scheduler');
exports.cleanupPhotos=onSchedule({schedule:'every 1 hours',timeZone:'Asia/Seoul',maxInstances:1},async()=>{
 const rows=await db.collectionGroup('photoReservations').where('expiresAt','<',Date.now()-86400000).limit(200).get();
 for(const row of rows.docs){
  const r=row.data(),cid=row.ref.parent.parent.id,filename=row.id;
  if(!/^[A-Za-z0-9_-]+$/.test(r.uid)||!/^[a-f0-9-]+\.jpg$/.test(filename))continue;
  try{await getStorage().bucket().file(`couples/${cid}/${r.uid}/${filename}`).delete({ignoreNotFound:true});await row.ref.delete();}
  catch(e){console.error('Photo cleanup will retry',e.code||e.name);}
 }
 if(rows.size===200)console.warn('Photo cleanup batch full: check backlog age and adjust capacity.');
 // Expire deletion receipts and anti-recreation markers after old ID tokens are long expired.
 const expiredReceipts=await db.collection('deletionReceipts').where('expiresAt','<',Date.now()).limit(100).get();
 if(!expiredReceipts.empty){const batch=db.batch();expiredReceipts.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
 const expiredJobs=await db.collection('accountDeletions').where('completedAt','<',Date.now()-30*86400000).limit(100).get();
 for(const row of expiredJobs.docs){if(row.data().status!=='complete')continue;if(row.data().noticePending)console.warn('Deletion completion notification overdue.');await row.ref.delete();}
 const expiredLimits=await db.collection('operationLimits').where('expiresAt','<',Date.now()).limit(200).get();
 if(!expiredLimits.empty){const batch=db.batch();expiredLimits.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
 const invites=await db.collection('invitations').where('expiresAt','<',Date.now()).limit(200).get();
 if(!invites.empty){const batch=db.batch();invites.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
});
