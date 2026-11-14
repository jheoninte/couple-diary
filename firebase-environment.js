const production=Object.freeze({apiKey:'AIzaSyBoEZNvbq_eYne5y1Ejm5IwLa2WDHfdYQs',authDomain:'couple-diary-75157.firebaseapp.com',projectId:'couple-diary-75157',storageBucket:'couple-diary-75157.firebasestorage.app',messagingSenderId:'681335251233',appId:'1:681335251233:web:fb6865fe60058287fd9e60'});
export function resolveFirebaseEnvironment({hostname='',search='',native=false,env={}}={}){
 const local=['localhost','127.0.0.1'].includes(hostname);
 if(local&&!native&&new URLSearchParams(search).has('emulator'))return {emulator:true,config:{...production,apiKey:'demo-key',projectId:'demo-couple-diary',storageBucket:'demo-couple-diary.appspot.com'}};
 const staging=env.MODE==='staging'||env.VITE_FIREBASE_TARGET==='staging';
 const custom=!!env.VITE_FIREBASE_PROJECT_ID;
 if(local&&!native&&!custom)throw Error('로컬에서는 ?emulator=1 또는 명시적인 스테이징 Firebase 설정이 필요합니다.');
 let config=production;
 if(staging||custom){
  const fields={apiKey:'API_KEY',authDomain:'AUTH_DOMAIN',projectId:'PROJECT_ID',storageBucket:'STORAGE_BUCKET',appId:'APP_ID'};config={};
  for(const [key,suffix]of Object.entries(fields)){const value=env[`VITE_FIREBASE_${suffix}`];if(typeof value!=='string'||!value.trim())throw Error(`Firebase 공개 설정 누락: ${suffix}`);config[key]=value;}
  if(env.VITE_FIREBASE_MESSAGING_SENDER_ID)config.messagingSenderId=env.VITE_FIREBASE_MESSAGING_SENDER_ID;
 }
 if(staging&&['projectId','apiKey','appId','authDomain','storageBucket'].some(key=>config[key]===production[key]))throw Error('스테이징에서 운영 Firebase 프로젝트를 사용할 수 없습니다.');
 if(local&&!native&&config.projectId===production.projectId)throw Error('로컬에서 운영 프로젝트를 사용할 수 없습니다. emulator를 사용해주세요.');
 return {emulator:false,config};
}
