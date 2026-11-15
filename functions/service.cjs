const {randomUUID,randomBytes}=require('node:crypto');
const {reserveOperation}=require('./rate-limits.cjs');
class DomainError extends Error {constructor(code,message,details){super(message);this.code=code;this.details=details;}}
function fail(code,message){throw new DomainError(code,message);}
function check(ok,message='요청 내용을 확인해주세요.'){if(!ok)fail('invalid-argument',message);}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return v>='1900-01-01'&&v<='2200-12-31'&&Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
function text(v,max){check(typeof v==='string'&&v.trim().length>0&&v.length<=max);return v.trim();}
function id(v){check(typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v));return v;}
function createService(store,{now=Date.now}={}){
 async function execute(uid,data={}){
  if(!uid)fail('unauthenticated','먼저 로그인해주세요.');id(uid);check(data&&typeof data==='object');
  const action=data.action,time=now();
  return store.transaction(async tx=>{
   if(await tx.get(`accountDeletions/${uid}`))throw new DomainError('permission-denied','계정 삭제 요청을 처리 중입니다.',{accountDeletion:true});
   if(!await reserveOperation(tx,uid,action,time))fail('resource-exhausted','요청이 많습니다. 잠시 후 다시 시도해주세요.');
   const userPath=`users/${uid}`,storedUser=await tx.get(userPath),user=storedUser||{coupleId:null};
   if(action==='initialize'){
    if(user.coupleId){const old=await tx.get(`couples/${id(user.coupleId)}`);if(old?.status==='migrating')fail('failed-precondition','기록 이전을 확인 중입니다. 잠시 후 다시 시도해주세요.');if(!old||old.schemaVersion!==2)fail('failed-precondition','기존 기록 이전이 필요합니다. 원본을 보존한 상태로 관리자에게 문의해주세요.');}
    if(!storedUser)tx.set(userPath,user);return {coupleId:user.coupleId||null};
   }
   if(action==='createSpace'){
    if(user.coupleId)fail('failed-precondition','이미 일기장이 있습니다.');check(date(data.startDate));const cid=randomUUID();
    tx.set(`couples/${cid}`,{schemaVersion:2,status:'active',user1:uid,user2:null,startDate:data.startDate,settings:{},anniversaries:[],premiumUntil:user.billingUntil||0,createdAt:time});tx.set(userPath,{...user,coupleId:cid});return {coupleId:cid};
   }
   if(action==='join'){
    if(user.coupleId)fail('failed-precondition','현재 일기장을 먼저 보관해주세요.');check(typeof data.code==='string'&&/^[A-F0-9]{16}$/.test(data.code));
    const path=`invitations/${data.code}`,invite=await tx.get(path);if(!invite||invite.expiresAt<=time)fail('not-found','만료되었거나 사용된 초대 코드입니다.');
    const cp=`couples/${invite.coupleId}`,c=await tx.get(cp);if(!c||c.status!=='active'||c.user2||c.user1===uid)fail('failed-precondition','연결할 수 없는 일기장입니다.');
    const owner=await tx.get(`users/${c.user1}`);if(owner?.coupleId!==invite.coupleId)fail('failed-precondition','유효하지 않은 초대입니다.');
    tx.set(cp,{...c,user2:uid,premiumUntil:Math.max(owner.billingUntil||0,user.billingUntil||0),inviteCode:null,inviteExpiresAt:0});tx.set(userPath,{...user,coupleId:invite.coupleId});tx.delete(path);return {coupleId:invite.coupleId};
   }
   if(action==='readPhoto'){
    check(typeof data.path==='string'&&data.path.length>0&&data.path.length<=300&&!data.path.includes('..'));
    let allowed=false;
    const coupleMatch=data.path.match(/^couples\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/([a-f0-9-]+\.jpg)$/);
    const legacyMatch=data.path.match(/^photos\/([A-Za-z0-9_-]+)\/([^/]+)$/);
    if(coupleMatch){
     const [,targetCid,ownerUid]=coupleMatch,targetCouple=await tx.get(`couples/${targetCid}`);
     if(targetCouple&&[targetCouple.user1,targetCouple.user2].includes(uid)){
      if(targetCouple.status==='active'&&user.coupleId===targetCid)allowed=true;
      else if(targetCouple.status==='closed'&&ownerUid===uid)allowed=true;
     }
    }else if(legacyMatch){
     const [,ownerUid]=legacyMatch;
     if(ownerUid===uid)allowed=true;
     else if(user.coupleId){const uc=await tx.get(`couples/${id(user.coupleId)}`);if(uc?.status==='active'&&[uc.user1,uc.user2].includes(uid)&&[uc.user1,uc.user2].includes(ownerUid))allowed=true;}
    }
    if(!allowed)fail('permission-denied','사진에 접근할 수 없습니다.');
    const buffer=await store.readPhoto(data.path);
    return {dataUrl:`data:image/jpeg;base64,${buffer.toString('base64')}`};
   }
   const cid=id(data.coupleId),cp=`couples/${cid}`,c=await tx.get(cp);
   if(!c||c.status!=='active'||c.schemaVersion!==2||user.coupleId!==cid||![c.user1,c.user2].includes(uid))fail('permission-denied','이 일기장에 접근할 수 없습니다.');
   if(action==='membership')return {premium:c.premiumUntil>time,premiumUntil:c.premiumUntil||0,plans:{monthly:{amount:4900},yearly:{amount:39900}}};
   if(action==='invite'){
    if(c.user2)fail('failed-precondition','이미 연결된 일기장입니다.');if(c.inviteCode)tx.delete(`invitations/${c.inviteCode}`);
    const code=randomBytes(8).toString('hex').toUpperCase(),expiresAt=time+86400000;tx.set(`invitations/${code}`,{coupleId:cid,expiresAt});tx.set(cp,{...c,inviteCode:code,inviteExpiresAt:expiresAt});return {code,expiresAt};
   }
   if(action==='disconnect'){
    const members=[c.user1,c.user2].filter(Boolean),users=await Promise.all(members.map(u=>tx.get(`users/${u}`)));
    members.forEach((u,i)=>{if(users[i]?.coupleId===cid)tx.set(`users/${u}`,{...users[i],coupleId:null});tx.set(`users/${u}/archives/${cid}`,{coupleId:cid,closedAt:time});});
    if(c.inviteCode)tx.delete(`invitations/${c.inviteCode}`);tx.set(cp,{...c,status:'closed',closedAt:time,inviteCode:null,photoPermits:{},premiumUntil:0});return {closed:true};
   }
   if(action==='settings'){
    check(date(data.startDate));const s=data.settings||{};const settings={displayName:text(s.displayName,40),appTitle:text(s.appTitle,60),icon:text(s.icon,40),theme:text(s.theme,30)};
    tx.set(cp,{...c,startDate:data.startDate,settings:{...c.settings,[uid]:settings}});return {};
   }
   if(action==='anniversaryAdd'||action==='anniversaryDelete'){
    const key=id(data.id),rows=c.anniversaries||[];let next=rows.filter(a=>a.id!==key);
    if(action==='anniversaryAdd'){if(rows.some(a=>a.id===key))return {};check(next.length<30);check(date(data.date));next.push({id:key,name:text(data.name,80),date:data.date,icon:text(data.icon,40),recurring:data.recurring===true});}
    tx.set(cp,{...c,anniversaries:next});return {};
   }
   if(action==='reservePhoto'||action==='uploadPhoto'){
    if(!(c.premiumUntil>time))fail('permission-denied','사진 업로드는 Plus 구독이 필요합니다.');
    const day=new Date(time+9*3600000).toISOString().slice(0,10),month=day.slice(0,7),qp=`uploadQuotas/${uid}`,q=await tx.get(qp)||{};
    const daily=q.day===day?q.daily:0,monthly=q.month===month?q.monthly:0;if(daily>=6||monthly>=90)fail('resource-exhausted','사진 업로드 한도에 도달했습니다.');
    const filename=randomUUID()+'.jpg',expiresAt=time+10*60000;
    if(action==='uploadPhoto'){
     const match=typeof data.dataUrl==='string'&&data.dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
     if(!match)fail('invalid-argument','사진을 다시 선택해 자동 압축한 뒤 저장해주세요.');
     const buffer=Buffer.from(match[1],'base64');
     if(!buffer.length||buffer.length>512*1024||buffer[0]!==0xff||buffer[1]!==0xd8||buffer[2]!==0xff)fail('invalid-argument','사진을 다시 선택해 자동 압축한 뒤 저장해주세요.');
     const path=`couples/${cid}/${uid}/${filename}`;
     await store.savePhoto(path,buffer);
     tx.set(qp,{day,month,daily:daily+1,monthly:monthly+1});tx.set(`couples/${cid}/photoReservations/${filename}`,{uid,expiresAt,createdAt:time,attached:false});return {path,filename};
    }
    tx.set(qp,{day,month,daily:daily+1,monthly:monthly+1});tx.set(`couples/${cid}/photoReservations/${filename}`,{uid,expiresAt,createdAt:time,attached:false});return {filename};
   }
   check(date(data.date));const author=['saveEntry','deleteEntry','restoreEntry'].includes(action)?uid:id(data.author);check([c.user1,c.user2].includes(author));
   const ep=`couples/${cid}/entries/${author}_${data.date}`,old=await tx.get(ep);
   if(action==='saveEntry'){
    check(Number.isSafeInteger(data.revision)&&data.revision>=0);if((old?.revision||0)!==data.revision)fail('aborted','다른 화면에서 수정되었습니다. 최신 일기를 다시 불러와주세요.');
    check(Array.isArray(data.photos)&&data.photos.length<=3&&new Set(data.photos).size===data.photos.length);const content=text(data.content,20000),mood=text(data.mood,40);
    const newPhotos=data.photos.filter(p=>!old?.photos?.includes(p));
    for(const p of newPhotos){check(typeof p==='string');const prefix=`couples/${cid}/${uid}/`;if(!p.startsWith(prefix)||!/^[a-f0-9-]+\.jpg$/.test(p.slice(prefix.length)))fail('permission-denied','유효하지 않은 사진입니다.');
     const rp=`couples/${cid}/photoReservations/${p.slice(prefix.length)}`,r=await tx.get(rp);if(!r||r.uid!==uid||r.attached||r.expiresAt<=time||!(c.premiumUntil>time))fail('permission-denied','사진 업로드 권한이 만료되었습니다.');
     if(store.photoExists&&!await store.photoExists(p))fail('failed-precondition','업로드한 사진을 확인할 수 없습니다.');tx.delete(rp);}
    for(const p of old?.photos||[]){
     if(!data.photos.includes(p)&&p.startsWith(`couples/${cid}/${uid}/`)){
      const filename=p.split('/').at(-1);tx.set(`couples/${cid}/photoReservations/${filename}`,{uid,expiresAt:time,createdAt:time,attached:false});
     }
    }
    const entry={...(old||{}),author:uid,date:data.date,content,mood,photos:data.photos,revision:data.revision+1,comments:old?.comments||[],likedBy:old?.likedBy||[],createdAt:old?.createdAt||time,updatedAt:time,deletedAt:null};tx.set(ep,entry);return {entry};
   }
   if(!old)fail('not-found','일기를 찾을 수 없습니다.');
   if(action==='deleteEntry'||action==='restoreEntry'){
    if(old.revision!==data.revision)fail('aborted','최신 일기를 다시 불러와주세요.');tx.set(ep,{...old,deletedAt:action==='deleteEntry'?time:null,revision:old.revision+1,updatedAt:time});return {};
   }
   if(old.deletedAt)fail('failed-precondition','삭제된 일기는 변경할 수 없습니다.');
   if(action==='like'){check(typeof data.liked==='boolean');const likedBy=(old.likedBy||[]).filter(u=>u!==uid);if(data.liked)likedBy.push(uid);tx.set(ep,{...old,likedBy});return {};}
   const comments=old.comments||[],key=id(data.id),comment=comments.find(c=>c.id===key);
   if(action==='commentAdd'){
    if(comment)return {};check(comments.length<200);tx.set(ep,{...old,comments:[...comments,{id:key,author:uid,text:text(data.text,1000),createdAt:time}]});return {};
   }
   if(!['commentEdit','commentDelete'].includes(action))fail('invalid-argument','지원하지 않는 작업입니다.');
   if(!comment)fail('not-found','댓글을 찾을 수 없습니다.');if(comment.author!==uid)fail('permission-denied','본인의 댓글만 변경할 수 있습니다.');
   tx.set(ep,{...old,comments:action==='commentDelete'?comments.filter(c=>c.id!==key):comments.map(c=>c.id===key?{...c,text:text(data.text,1000),updatedAt:time}:c)});return {};
  });
 }
 return {execute};
}
module.exports={createService,DomainError};
