const path=require('node:path'),{createRequire}=require('node:module');
const load=createRequire(path.resolve(__dirname,'../functions/package.json'));
let activeDb;
const args=process.argv.slice(2),command=args[0],value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
async function main(){
 const {readBackup,exportCouple,restoreCouple}=require('./backup-core.cjs'),dir=value('--backup')||value('--out');
 if(command==='verify'){if(!dir)throw Error('--backup 폴더가 필요합니다.');const m=await readBackup(dir);console.log(JSON.stringify({verified:true,documents:m.documents.length,objects:m.objects.length,sourceProject:m.sourceProject}));return;}
 const project=value('--project'),bucketName=value('--bucket');
 if(!project||!bucketName)throw Error('--project와 --bucket을 명시하세요. 기본 동작은 쓰기 없는 미리보기입니다.');
 const hosts=['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'];const emulator=hosts.some(k=>process.env[k]);if(emulator&&(!project.startsWith('demo-')||hosts.some(k=>!process.env[k])))throw Error('에뮬레이터는 모든 호스트를 지정한 demo 프로젝트만 사용하세요.');
 if(!['inventory','backup','restore','migrate'].includes(command))throw Error('명령: inventory | backup | verify | restore | migrate');
 const execute=args.includes('--execute');if(execute&&value('--confirm')!==project)throw Error('쓰기에는 --execute --confirm PROJECT_ID가 필요합니다.');
 if((command==='backup'||command==='migrate'&&execute)&&!args.includes('--maintenance-confirmed'))throw Error('일관된 이전용 백업에는 원본 쓰기 중단 확인(--maintenance-confirmed)이 필요합니다.');
 if(command==='restore'&&!project.startsWith('demo-')&&project!=='couple-diary-staging'&&!args.includes('--staging-target'))throw Error('복구 대상은 별도 테스트 프로젝트여야 합니다. --staging-target으로 확인하세요.');
 if(command==='restore'&&project==='couple-diary-75157')throw Error('기존 운영 프로젝트로 복구할 수 없습니다.');
 let db,bucket;
 if(args.includes('--firebase-cli-auth')){
  if(emulator)throw Error('에뮬레이터는 CLI 인증을 사용하지 않습니다.');
  const cli=require('../node_modules/firebase-tools/lib/auth.js'),api=require('../node_modules/firebase-tools/lib/api.js'),account=cli.getGlobalDefaultAccount();
  if(!account)throw Error('먼저 npx firebase login으로 로그인해주세요.');
  // Reuse the already approved login in memory; never write or print refresh credentials.
  const credentials={type:'authorized_user',client_id:api.clientId(),client_secret:api.clientSecret(),refresh_token:account.tokens.refresh_token};
  const {Firestore}=load('@google-cloud/firestore'),{Storage}=load('@google-cloud/storage');db=new Firestore({projectId:project,credentials});bucket=new Storage({projectId:project,credentials}).bucket(bucketName);
 }else{
  const {initializeApp}=load('firebase-admin/app'),{getFirestore}=load('firebase-admin/firestore'),{getStorage}=load('firebase-admin/storage');initializeApp({projectId:project,storageBucket:bucketName});db=getFirestore();bucket=getStorage().bucket();
 }
 activeDb=db;
 if(command==='inventory'){const rows=await db.collection('couples').limit(50).get();const [metadata]=await bucket.getMetadata();console.log(JSON.stringify({project,bucket:bucket.name,bucketLocation:metadata.location,examined:rows.size,truncated:rows.size===50,v2:rows.docs.filter(d=>d.data().schemaVersion===2).length,legacy:rows.docs.filter(d=>d.data().schemaVersion!==2).length,readOnly:true}));return;}
 if(!dir)throw Error('--backup 또는 --out 폴더가 필요합니다.');
 let result;
 if(command==='backup'){const cid=value('--couple');if(!cid)throw Error('--couple이 필요합니다.');result=await exportCouple({db,bucket,projectId:project,coupleId:cid,dir:path.resolve(dir),maintenanceConfirmed:args.includes('--maintenance-confirmed')});}
 if(command==='restore')result=await restoreCouple({db,bucket,projectId:project,dir:path.resolve(dir),execute});
 if(command==='migrate')result=await require('./migration-core.cjs').migrateCouple({db,bucket,projectId:project,dir:path.resolve(dir),execute});
 console.log(JSON.stringify({project,...result}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>activeDb?.terminate());
