const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const load=require('node:module').createRequire(path.resolve(__dirname,'../functions/package.json'));
const {Timestamp,GeoPoint,FieldPath}=load('firebase-admin/firestore');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function pack(v){
 if(v===null)return ['null'];if(v instanceof Timestamp)return ['timestamp',[v.seconds,v.nanoseconds]];
 if(v instanceof GeoPoint)return ['geo',[v.latitude,v.longitude]];if(Buffer.isBuffer(v)||v instanceof Uint8Array)return ['bytes',Buffer.from(v).toString('base64')];
 if(v instanceof Date)return ['date',v.toISOString()];if(typeof v?.path==='string'&&typeof v?.get==='function')return ['reference',v.path];
 if(Array.isArray(v))return ['array',v.map(pack)];if(typeof v==='object')return ['object',Object.keys(v).sort().map(k=>[k,pack(v[k])])];
 if(typeof v==='number')return ['number',Number.isFinite(v)?v:String(v)];if(typeof v==='string'||typeof v==='boolean')return [typeof v,v];throw Error('Unsupported backup value');
}
function unpack(v,db){
 if(!Array.isArray(v))throw Error('Invalid encoded value');const [type,data]=v;
 switch(type){case 'null':return null;case 'timestamp':return new Timestamp(...data);case 'geo':return new GeoPoint(...data);case 'bytes':return Buffer.from(data,'base64');case 'date':return new Date(data);case 'reference':if(!db)throw Error('Reference needs target database');return db.doc(data);case 'array':return data.map(x=>unpack(x,db));case 'object':return Object.fromEntries(data.map(([k,x])=>[k,unpack(x,db)]));case 'number':return typeof data==='number'?data:Number(data);case 'string':case 'boolean':return data;default:throw Error('Unknown backup type');}
}
const hashValue=v=>hash(JSON.stringify(pack(v)));
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function allowedObject(p,m){const parts=p.split('/');return (parts.length===3&&parts[0]==='photos'&&m.members.includes(parts[1])||parts.length===4&&parts[0]==='couples'&&parts[1]===m.coupleId&&m.members.includes(parts[2]))&&parts.every(s=>s&&!['.','..'].includes(s)&&!/[\\\x00-\x1f]/.test(s));}
function validateManifest(m){
 if(m?.format!=='couple-diary-backup-v1'||!id(m.coupleId)||!id(m.sourceProject)||typeof m.bucket!=='string'||!Array.isArray(m.members)||!m.members.length||m.members.length>2||!m.members.every(id)||new Set(m.members).size!==m.members.length||!Array.isArray(m.documents)||m.documents.length>5000||!Array.isArray(m.objects)||m.objects.length>2000)throw Error('Invalid backup manifest');
 const docs=new Set(),files=new Set();
 for(const row of m.documents){const parts=row.path?.split('/')||[];const valid=parts[0]==='couples'&&parts[1]===m.coupleId&&parts.length%2===0&&parts.every(id)||m.members.some(uid=>row.path===`users/${uid}`||row.path===`users/${uid}/archives/${m.coupleId}`);
  if(!valid||docs.has(row.path)||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('Unsafe/duplicate backup document');docs.add(row.path);if(hash(JSON.stringify(row.data))!==row.sha256)throw Error('Backup document hash mismatch');}
 if(!docs.has(`couples/${m.coupleId}`))throw Error('Backup root missing');
 for(const row of m.objects){if(!allowedObject(row.path,m)||files.has(row.path)||!/^objects\/[a-f0-9]{64}\.bin$/.test(row.file)||!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.size)||row.size<0||row.size>30*1024*1024)throw Error('Unsafe backup object');files.add(row.path);}
 return m;
}
function validateBackupDestination(dir){
 const repo=path.resolve(__dirname,'..'),destination=path.resolve(dir),relative=path.relative(repo,destination);
 if(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)&&relative!=='.backups'&&!relative.startsWith('.backups'+path.sep))throw Error('Backup needs a private .backups folder outside served project files');
 return destination;
}
async function exportCouple({db,bucket,projectId,coupleId,dir,maintenanceConfirmed=false,maxDocuments=2000,maxBytes=128*1024*1024}){
 dir=validateBackupDestination(dir);
 if(!id(projectId)||!id(coupleId))throw Error('Invalid project/couple');
 const root=db.doc(`couples/${coupleId}`),snapshot=await root.get();if(!snapshot.exists)throw Error('Couple missing');const source=snapshot.data(),members=[source.user1,source.user2].filter(Boolean);
 if(!members.length||!members.every(id))throw Error('Unknown members');
 const m={format:'couple-diary-backup-v1',consistency:maintenanceConfirmed?'quiesced':'online-diagnostic',sourceProject:projectId,bucket:bucket.name,coupleId,members,createdAt:new Date().toISOString(),documents:[],objects:[],scope:'couple + member profiles + this archive + referenced legacy/member space photos; excludes Auth/global billing'};
 let total=0;const snapshots=[];
 async function add(doc){if(!doc.exists)return;if(m.documents.length>=maxDocuments)throw Error('Document backup limit exceeded');const data=pack(doc.data());total+=Buffer.byteLength(JSON.stringify(data));if(total>maxBytes)throw Error('Backup byte limit exceeded');m.documents.push({path:doc.ref.path,data,sha256:hash(JSON.stringify(data)),updateTime:doc.updateTime.toDate().toISOString()});snapshots.push(doc);}
 async function walk(ref){for(const collection of await ref.listCollections()){let cursor;do{let q=collection.orderBy(FieldPath.documentId()).limit(100);if(cursor)q=q.startAfter(cursor);const rows=await q.get();for(const d of rows.docs){await add(d);await walk(d.ref);}cursor=rows.size===100?rows.docs.at(-1):null;}while(cursor);}}
 await add(snapshot);await walk(root);
 for(const uid of members){if((await db.doc(`accountDeletions/${uid}`).get()).exists)throw Error('Account deletion in progress');await add(await db.doc(`users/${uid}`).get());await add(await db.doc(`users/${uid}/archives/${coupleId}`).get());}
 const objects=new Set();
 if(source.schemaVersion!==2){const plan=require('../functions/legacy-migration.cjs').planLegacyCouple(coupleId,source,bucket.name);plan.photos.forEach(p=>objects.add(p));}
 else for(const row of m.documents.filter(r=>r.path.startsWith(`couples/${coupleId}/entries/`)))for(const p of unpack(row.data,db).photos||[]){if(!allowedObject(p,m))throw Error('Foreign photo reference');objects.add(p);}
 // Include unattached objects in this space so the backup scope is explicit and complete.
 for(const uid of members){let pageToken;do{const [files,next]=await bucket.getFiles({prefix:`couples/${coupleId}/${uid}/`,autoPaginate:false,maxResults:100,pageToken});files.forEach(f=>objects.add(f.name));if(objects.size>2000)throw Error('Object count limit exceeded');pageToken=next?.pageToken;}while(pageToken);}
 await fs.mkdir(dir,{mode:0o700});await fs.mkdir(path.join(dir,'objects'),{mode:0o700});
 for(const object of objects){if(!allowedObject(object,m))throw Error('Unexpected object path');const file=bucket.file(object),[metadata]=await file.getMetadata();const size=Number(metadata.size);if(!Number.isSafeInteger(size)||size>30*1024*1024||total+size>maxBytes)throw Error('Photo backup limit exceeded');const [bytes]=await file.download();if(bytes.length!==size)throw Error('Object size changed');total+=bytes.length;const name=`objects/${hash(object)}.bin`;await fs.writeFile(path.join(dir,name),bytes,{mode:0o600,flag:'wx'});
  m.objects.push({path:object,file:name,size,sha256:hash(bytes),generation:metadata.generation,contentType:metadata.contentType||'application/octet-stream'});
 }
 // This detects changed documents, but callers must still stop writes for a consistent snapshot.
 for(const old of snapshots){const fresh=await old.ref.get();if(!fresh.exists||!fresh.updateTime.isEqual(old.updateTime))throw Error('Data changed during backup; stop writes and retry');}
 for(const uid of members)if((await db.doc(`accountDeletions/${uid}`).get()).exists)throw Error('Account deletion started during backup');
 m.documents.sort((a,b)=>a.path.localeCompare(b.path));m.objects.sort((a,b)=>a.path.localeCompare(b.path));validateManifest(m);
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(m,null,2),{mode:0o600,flag:'wx'});return {documents:m.documents.length,objects:m.objects.length,bytes:total};
}
async function readBackup(dir){
 const stat=await fs.stat(path.join(dir,'manifest.json'));if(stat.size>20*1024*1024)throw Error('Manifest too large');
 const m=validateManifest(JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8')));
 for(const row of m.objects){const file=path.join(dir,row.file),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==row.size||hash(await fs.readFile(file))!==row.sha256)throw Error('Photo backup integrity failed');}return m;
}
async function restoreCouple({db,bucket,projectId,dir,execute=false}){
 const m=await readBackup(dir);if(projectId===m.sourceProject||bucket.name===m.bucket)throw Error('Restore must use a different project and bucket');
 const root=db.doc(`couples/${m.coupleId}`),marker=db.doc(`restorations/${m.coupleId}`),digest=hash(JSON.stringify(m));
 const prepared=m.documents.map(row=>({path:row.path,data:unpack(row.data,db)}));
 const restoredRoot=prepared.find(row=>row.path===root.path).data;
 if(restoredRoot.schemaVersion!==2){const {legacyPhotoPath}=require('../functions/legacy-migration.cjs');for(const [uid,days]of Object.entries(restoredRoot.myEntries||{}))for(const entry of Object.values(days))entry.photos=(entry.photos||[]).map(p=>legacyPhotoPath(p,m.bucket,uid));}
 const old=(await marker.get()).data();if(old&&old.digest!==digest)throw Error('Different restore already exists');
 if(!old&&((await root.get()).exists||(await root.listCollections()).length))throw Error('Restore target is not empty');
 for(const uid of m.members)if((await db.doc(`accountDeletions/${uid}`).get()).exists)throw Error('Target account deletion in progress');
 // Existing data is accepted only for the same verified backup's resumable restore.
 for(const row of prepared){const snapshot=await db.doc(row.path).get();if(snapshot.exists&&(!old||hashValue(snapshot.data())!==hashValue(row.data)))throw Error('Target document exists or changed');}
 for(const row of m.objects){const file=bucket.file(row.path);if((await file.exists())[0]){if(!old)throw Error('Target object exists');const [metadata]=await file.getMetadata();if(metadata.metadata?.firebaseStorageDownloadTokens||metadata.contentType!==row.contentType||hash((await file.download())[0])!==row.sha256)throw Error('Existing restore object changed');}}
 if(old?.status==='complete')return {alreadyComplete:true};
 if(!execute)return {dryRun:true,resuming:!!old,documents:m.documents.length,objects:m.objects.length};
 const runId=require('node:crypto').randomUUID();
 await db.runTransaction(async tx=>{const current=(await tx.get(marker)).data();if(current?.leaseUntil>Date.now())throw Error('Restore already running');if(current&&current.digest!==digest)throw Error('Different restore exists');tx.set(marker,{digest,status:'copying',sourceProject:m.sourceProject,runId,leaseUntil:Date.now()+10*60000});});
 try{
  for(const row of prepared.filter(d=>d.path!==root.path)){const ref=db.doc(row.path),existing=await ref.get();if(existing.exists){if(hashValue(existing.data())!==hashValue(row.data))throw Error('Restore document changed');}else await ref.create(row.data);}
  for(const row of m.objects){const file=bucket.file(row.path);if(!(await file.exists())[0])await file.save(await fs.readFile(path.join(dir,row.file)),{preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:row.contentType,cacheControl:'private, max-age=0'}});}
  await db.runTransaction(async tx=>{const current=(await tx.get(marker)).data(),snapshot=await tx.get(root);for(const uid of m.members)if((await tx.get(db.doc(`accountDeletions/${uid}`))).exists)throw Error('Target deletion started');if(current?.runId!==runId)throw Error('Restore lease changed');if(snapshot.exists){if(hashValue(snapshot.data())!==hashValue(restoredRoot))throw Error('Restore root changed');}else tx.create(root,restoredRoot);tx.update(marker,{status:'complete',leaseUntil:0,completedAt:Date.now()});});
  return {restored:true};
 }catch(error){await db.runTransaction(async tx=>{const current=(await tx.get(marker)).data();if(current?.runId===runId)tx.update(marker,{status:'retry-required',leaseUntil:0});});throw error;}
}
module.exports={pack,unpack,hashValue,validateManifest,validateBackupDestination,exportCouple,readBackup,restoreCouple};
