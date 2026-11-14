const {createRequire}=require('node:module'),path=require('node:path');
const load=createRequire(path.resolve(__dirname,'../functions/package.json'));
const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
const project=value('--project'),uid=value('--uid');
async function main(){
 if(!project)throw Error('프로젝트를 --project로 명시하세요. 기본 동작은 미리보기입니다.');
 if((process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIREBASE_STORAGE_EMULATOR_HOST)&&!project.startsWith('demo-'))throw Error('에뮬레이터 환경에서는 demo 프로젝트만 사용하세요.');
 const {initializeApp}=load('firebase-admin/app'),{getFirestore,FieldValue}=load('firebase-admin/firestore');
 initializeApp({projectId:project,storageBucket:value('--bucket')||`${project}.appspot.com`});const db=getFirestore();
 if(!uid){const rows=await db.collection('accountDeletions').where('status','==','pending').limit(50).get();console.log(JSON.stringify(rows.docs.map(d=>({uid:d.id,...d.data()})),null,2));return;}
 const ref=db.doc(`accountDeletions/${uid}`),job=(await ref.get()).data();if(!job)throw Error('접수된 삭제 요청이 없습니다.');
 if(!args.includes('--execute')){console.log(JSON.stringify({project,uid,request:job,dryRun:true,warning:'본인의 일기·사진·댓글·계정 및 공유 관계 정보가 영구 삭제됩니다. 상대방 작성 일기는 보존됩니다.'},null,2));return;}
 if(!project.startsWith('demo-')&&!value('--bucket'))throw Error('실제 프로젝트는 --bucket으로 버킷을 명시하세요.');
 if(value('--confirm')!==uid)throw Error('실제 작업에는 --execute --confirm UID가 필요합니다.');
 if(args.includes('--notified')){if(job.status!=='complete')throw Error('삭제 완료 후에만 완료 알림을 확인할 수 있습니다.');await ref.update({email:FieldValue.delete(),noticePending:false,notifiedAt:Date.now()});console.log('알림 처리 확인 및 연락처 제거 완료');return;}
 const {advanceDeletion}=require('../functions/deletion-worker.cjs');const deps={db,bucket:load('firebase-admin/storage').getStorage().bucket(),auth:load('firebase-admin/auth').getAuth()};
 let result;for(let i=0;i<30;i++){result=await advanceDeletion(deps,uid);if(result.status==='complete')break;}
 console.log(JSON.stringify({project,uid,...result,noticeEmail:result.status==='complete'?job.email:undefined,instruction:result.status==='complete'?'완료 이메일을 직접 보낸 후 --execute --confirm UID --notified로 연락처를 제거하세요.':'같은 명령을 다시 실행하면 남은 단계부터 이어집니다.'},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
