const {FieldPath}=require('firebase-admin/firestore');
const {DomainError}=require('./service.cjs');

// Administrator-only operation. This module is deliberately not exposed as a callable.
async function advanceDeletion({db,bucket,auth},uid,{now=Date.now,batchSize=100}={}){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw new DomainError('invalid-argument','잘못된 UID입니다.');
 const ref=db.doc(`accountDeletions/${uid}`),time=now();
 const job=await db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref),row=snapshot.data();
  if(!row)throw new DomainError('not-found','앱에서 접수한 삭제 요청이 없습니다.');
  if(row.status==='complete')return row;
  if(row.leaseUntil>time)throw new DomainError('aborted','다른 삭제 작업이 실행 중입니다.');
  tx.update(ref,{leaseUntil:time+10*60000});return row;
 });
 if(job.status==='complete')return {status:'complete'};
 const patch=async values=>ref.update({...values,leaseUntil:0,lastError:null,updatedAt:now()});
 const removeDocs=async docs=>{if(!docs.length)return;const batch=db.batch();docs.forEach(d=>batch.delete(d.ref));await batch.commit();};
 const removeFiles=async prefix=>{const [files]=await bucket.getFiles({prefix,autoPaginate:false,maxResults:batchSize});for(let i=0;i<files.length;i+=10)await Promise.all(files.slice(i,i+10).map(f=>f.delete({ignoreNotFound:true})));return files.length;};
 try{
  if(job.phase==='spaces'){
   let found=await db.collection('couples').where('user1','==',uid).limit(1).get();
   if(found.empty)found=await db.collection('couples').where('user2','==',uid).limit(1).get();
   if(found.empty){await patch({phase:'legacyPhotos'});return {status:'pending'};}
   const coupleRef=found.docs[0].ref;
   await db.runTransaction(async tx=>{
    const c=(await tx.get(coupleRef)).data();
    if(c.schemaVersion!==2)throw new DomainError('failed-precondition','기존 스키마는 관리자 이전 검토가 필요합니다.');
    const partner=[c.user1,c.user2].find(u=>u&&u!==uid),pr=partner?db.doc(`users/${partner}`):null,p=pr?(await tx.get(pr)).data():null;
    if(pr&&p?.coupleId===coupleRef.id)tx.update(pr,{coupleId:null});
    if(partner)tx.set(db.doc(`users/${partner}/archives/${coupleRef.id}`),{coupleId:coupleRef.id,closedAt:c.closedAt||time});
    if(c.inviteCode)tx.delete(db.doc(`invitations/${c.inviteCode}`));
    tx.update(coupleRef,{status:'closed',closedAt:c.closedAt||time,premiumUntil:0,inviteCode:null,photoPermits:{}});
   });
   await patch({phase:'entries',coupleId:coupleRef.id,cursor:null});
  }else if(job.phase==='entries'){
   let query=db.collection(`couples/${job.coupleId}/entries`).orderBy(FieldPath.documentId()).limit(batchSize);
   if(job.cursor)query=query.startAfter(job.cursor);
   const rows=await query.get();
   if(!rows.empty)await db.runTransaction(async tx=>{
    const fresh=await tx.getAll(...rows.docs.map(d=>d.ref));
    for(const row of fresh){const e=row.data();if(!e)continue;
     if(e.author===uid)tx.delete(row.ref);
     else{const comments=(e.comments||[]).filter(c=>c.author!==uid),likedBy=(e.likedBy||[]).filter(u=>u!==uid);
      if(comments.length!==(e.comments||[]).length||likedBy.length!==(e.likedBy||[]).length)tx.update(row.ref,{comments,likedBy});}
    }
   });
   await patch({cursor:rows.docs.at(-1)?.id||job.cursor||null,...(rows.size<batchSize?{phase:'photos'}:{})});
  }else if(job.phase==='photos'){
   const count=await removeFiles(`couples/${job.coupleId}/${uid}/`);
   await patch(count<batchSize?{phase:'spaceMetadata'}:{});
  }else if(job.phase==='spaceMetadata'){
   const reservations=await db.collection(`couples/${job.coupleId}/photoReservations`).where('uid','==',uid).limit(batchSize).get();
   if(!reservations.empty){await removeDocs(reservations.docs);await patch({});return {status:'pending'};}
   const cr=db.doc(`couples/${job.coupleId}`);
   await db.runTransaction(async tx=>{
    const c=(await tx.get(cr)).data();if(!c)return;
    const settings={...(c.settings||{})};delete settings[uid];
    const user1=c.user1===uid?null:c.user1,user2=c.user2===uid?null:c.user2;
    // Shared relationship metadata has no reliable per-author attribution in v2.
    if(!user1&&!user2)tx.delete(cr);
    else tx.update(cr,{user1,user2,settings,anniversaries:[],startDate:null,inviteCode:null,inviteExpiresAt:0});
   });
   await patch({phase:'spaces',coupleId:null,cursor:null});
  }else if(job.phase==='legacyPhotos'){
   const count=await removeFiles(`photos/${uid}/`);await patch(count<batchSize?{phase:'archives'}:{});
  }else if(job.phase==='archives'){
   const rows=await db.collection(`users/${uid}/archives`).limit(batchSize).get();await removeDocs(rows.docs);await patch(rows.size<batchSize?{phase:'billing'}:{});
  }else if(job.phase==='billing'){
   const rows=await db.collection('appleSubscriptions').where('uid','==',uid).limit(batchSize).get();
   if(!rows.empty){await removeDocs(rows.docs);await patch({});return {status:'pending'};}
   const account=(await db.doc(`billingAccounts/${uid}`).get()).data(),batch=db.batch();
   if(account?.token)batch.delete(db.doc(`billingTokens/${account.token}`));
   const push=(await db.doc(`pushDevices/${uid}`).get()).data();
   for(const device of push?.devices||[])batch.delete(db.doc(`pushTokens/${device.id}`));
   batch.delete(db.doc(`pushDevices/${uid}`));
   for(const p of [`billingAccounts/${uid}`,`uploadQuotas/${uid}`,`operationLimits/${uid}`,`users/${uid}`])batch.delete(db.doc(p));
   await batch.commit();await patch({phase:'authentication'});
  }else if(job.phase==='authentication'){
   try{await auth.deleteUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
   await db.runTransaction(async tx=>{
    const latest=(await tx.get(ref)).data(),completedAt=now();
    tx.set(db.doc(`deletionReceipts/${latest.receiptHash}`),{status:'complete',requestedAt:latest.requestedAt,completedAt,expiresAt:completedAt+30*86400000});
    tx.update(ref,{status:'complete',phase:'complete',completedAt,leaseUntil:0,lastError:null,noticePending:true});
   });
   return {status:'complete',noticePending:true};
  }else throw new DomainError('failed-precondition','알 수 없는 삭제 단계입니다.');
  return {status:'pending'};
 }catch(error){await ref.update({leaseUntil:0,lastError:error.code||'internal',updatedAt:now()});throw error;}
}
module.exports={advanceDeletion};
