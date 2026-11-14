const {randomUUID}=require('node:crypto');
const {readBackup,unpack,hashValue}=require('./backup-core.cjs');
const {planLegacyCouple}=require('../functions/legacy-migration.cjs');
async function migrateCouple({db,bucket,projectId,dir,execute=false}){
 const backup=await readBackup(dir);
 if(backup.consistency!=='quiesced')throw Error('Migration requires a maintenance-confirmed backup');
 if(backup.sourceProject!==projectId||backup.bucket!==bucket.name)throw Error('Migration backup project/bucket mismatch');
 const cid=backup.coupleId,root=db.doc(`couples/${cid}`),original=unpack(backup.documents.find(d=>d.path===root.path).data,db),sourceDigest=hashValue(original),plan=planLegacyCouple(cid,original,bucket.name),jobRef=db.doc(`migrations/${cid}`);
 const staged={...plan.couple,status:'migrating'},stagedDigest=hashValue(staged);
 async function verify(tx){
  const source=tx?await tx.get(root):await root.get(),fingerprint=source.exists?hashValue(source.data()):null;
  if(fingerprint!==sourceDigest&&fingerprint!==stagedDigest)throw Error('Source changed since backup');
  if(fingerprint===stagedDigest){const job=tx?(await tx.get(jobRef)).data():(await jobRef.get()).data();if(job?.sourceDigest!==sourceDigest)throw Error('Unrecognized staged migration');}
  for(const uid of backup.members){const deleted=tx?await tx.get(db.doc(`accountDeletions/${uid}`)):await db.doc(`accountDeletions/${uid}`).get();if(deleted.exists)throw Error('Account deletion in progress');const user=tx?await tx.get(db.doc(`users/${uid}`)):await db.doc(`users/${uid}`).get();if(user.data()?.coupleId!==cid)throw Error('User space pointer changed');}
 }
 const existing=(await jobRef.get()).data();if(existing?.status==='complete'&&existing.sourceDigest===sourceDigest&&(await root.get()).data()?.schemaVersion===2)return {alreadyComplete:true};
 await verify();
 for(const photo of plan.photos){const row=backup.objects.find(o=>o.path===photo);if(!row)throw Error('Photo missing from backup');const [metadata]=await bucket.file(photo).getMetadata();if(metadata.generation!==row.generation)throw Error('Photo changed since backup');}
 for(const entry of plan.entries){const snapshot=await db.doc(`${root.path}/entries/${entry.id}`).get();if(snapshot.exists&&hashValue(snapshot.data())!==hashValue(entry.data))throw Error('Existing entry conflicts with migration');}
 if(!execute)return {dryRun:true,entries:plan.entries.length,photos:plan.photos.length,warnings:['Ambiguous comment authors remain read-only.','Old boolean likes are preserved as legacyLiked.']};
 const runId=randomUUID();
 await db.runTransaction(async tx=>{await verify(tx);const job=(await tx.get(jobRef)).data();if(job&&job.sourceDigest!==sourceDigest)throw Error('Different migration exists');if(job?.leaseUntil>Date.now())throw Error('Migration already running');tx.set(jobRef,{...job,sourceDigest,status:'copying',runId,retiredPhotoCount:job?.retiredPhotoCount||0,leaseUntil:Date.now()+10*60000});});
 try{
  for(let i=0;i<plan.entries.length;i+=100){const batch=plan.entries.slice(i,i+100);await db.runTransaction(async tx=>{await verify(tx);const rows=await tx.getAll(...batch.map(e=>db.doc(`${root.path}/entries/${e.id}`)));rows.forEach((row,n)=>{if(row.exists){if(hashValue(row.data())!==hashValue(batch[n].data))throw Error('Entry conflict');}else tx.create(row.ref,batch[n].data);});});}
  // Commit canonical paths in a non-readable state before invalidating legacy URLs.
  // Any failure from this point is resumable; the original backup remains unchanged.
  await db.runTransaction(async tx=>{await verify(tx);const job=(await tx.get(jobRef)).data();if(job?.runId!==runId)throw Error('Migration lease changed');tx.set(root,staged);tx.update(jobRef,{status:'retiring-tokens'});});
  const progress=(await jobRef.get()).data().retiredPhotoCount||0;
  for(let i=progress;i<plan.photos.length;i++){
   const photo=plan.photos[i];await verify();const file=bucket.file(photo),[metadata]=await file.getMetadata(),expected=backup.objects.find(o=>o.path===photo);if(metadata.generation!==expected.generation)throw Error('Photo changed during migration');
   await file.setMetadata({metadata:{...(metadata.metadata||{}),firebaseStorageDownloadTokens:randomUUID()}},{ifMetagenerationMatch:Number(metadata.metageneration)});
   await db.runTransaction(async tx=>{const job=(await tx.get(jobRef)).data();if(job?.runId!==runId)throw Error('Migration lease changed');tx.update(jobRef,{retiredPhotoCount:i+1});});
  }
  await db.runTransaction(async tx=>{await verify(tx);const job=(await tx.get(jobRef)).data();if(job?.runId!==runId||job.retiredPhotoCount!==plan.photos.length)throw Error('Migration not ready');tx.set(root,plan.couple);tx.update(jobRef,{status:'complete',completedAt:Date.now(),leaseUntil:0});});
  return {migrated:true,entries:plan.entries.length,photos:plan.photos.length};
 }catch(error){await db.runTransaction(async tx=>{const job=(await tx.get(jobRef)).data();if(job?.runId===runId)tx.update(jobRef,{leaseUntil:0,status:'retry-required',lastError:'migration-failed'});});throw error;}
}
module.exports={migrateCouple};
