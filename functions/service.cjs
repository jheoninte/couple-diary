const {randomUUID,randomBytes}=require('node:crypto');
const {reserveOperation}=require('./rate-limits.cjs');
const {registerDevice,unregisterDevice}=require('./push.cjs');
const {validTimeZone}=require('./reminders.cjs');
// Members' birthdays (month-day only; the year stays on the private user document) and time zones are mirrored
// on the couple so the hourly reminder job reads one document per couple.
const mirror=(c,uid,user)=>({birthdays:{...(c.birthdays||{}),...(user.birthDate?{[uid]:user.birthDate.slice(5)}:{})},timeZones:{...(c.timeZones||{}),...(user.timeZone?{[uid]:user.timeZone}:{})}});
class DomainError extends Error {constructor(code,message,details){super(message);this.code=code;this.details=details;}}
function fail(code,message){throw new DomainError(code,message);}
function check(ok,message='요청 내용을 확인해주세요.'){if(!ok)fail('invalid-argument',message);}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return v>='1900-01-01'&&v<='2200-12-31'&&Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
function text(v,max){check(typeof v==='string'&&v.trim().length>0&&v.length<=max);return v.trim();}
function id(v){check(typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v));return v;}
// Weather is summarised on the device (WeatherKit); only an icon, temperatures in °C and a city name reach the server.
const WEATHER_ICONS=new Set(['☀️','🌙','⛅','☁️','🌧️','⛈️','🌨️','🌫️','💨','🌡️']);
const temp=v=>Number.isFinite(v)&&v>=-90&&v<=70?Math.round(v):null;
function weatherOf(v,{city=false}={}){
 if(!v||typeof v!=='object'||!WEATHER_ICONS.has(v.icon)||temp(v.temp)===null)return null;
 const row={icon:v.icon,temp:temp(v.temp)};
 if(city){row.city=typeof v.city==='string'?v.city.trim().slice(0,60):'';if(temp(v.high)!==null)row.high=temp(v.high);if(temp(v.low)!==null)row.low=temp(v.low);}
 return row;
}
const PHOTO_DAILY=6,PHOTO_MONTHLY=90,PHOTO_ATTEMPTS=30;
function quota(q,time){const day=new Date(time+9*3600000).toISOString().slice(0,10),month=day.slice(0,7);q=q||{};
 // Older documents counted every attempt (including failed ones) as usage; carry those over only as attempts.
 const legacy=q.attempts===undefined;
 return {day,month,daily:!legacy&&q.day===day?q.daily||0:0,monthly:!legacy&&q.month===month?q.monthly||0:0,attempts:q.day===day?(legacy?q.daily:q.attempts)||0:0};}
// notify(events) runs after the transaction commits; events from a retried attempt are discarded.
function createService(store,{now=Date.now,notify}={}){
 async function execute(uid,data={}){
  if(!uid)fail('unauthenticated','먼저 로그인해주세요.');id(uid);check(data&&typeof data==='object');
  const action=data.action,time=now();
  let events=[];
  const result=await store.transaction(async tx=>{
   events=[];
   if(await tx.get(`accountDeletions/${uid}`))throw new DomainError('permission-denied','계정 삭제 요청을 처리 중입니다.',{accountDeletion:true});
   if(!await reserveOperation(tx,uid,action,time))fail('resource-exhausted','요청이 많습니다. 잠시 후 다시 시도해주세요.');
   const userPath=`users/${uid}`,storedUser=await tx.get(userPath),user=storedUser||{coupleId:null};
   if(action==='initialize'){
    if(user.coupleId){const old=await tx.get(`couples/${id(user.coupleId)}`);if(old?.status==='migrating')fail('failed-precondition','기록 이전을 확인 중입니다. 잠시 후 다시 시도해주세요.');if(!old||old.schemaVersion!==2)fail('failed-precondition','기존 기록 이전이 필요합니다. 원본을 보존한 상태로 관리자에게 문의해주세요.');}
    if(!storedUser)tx.set(userPath,user);return {coupleId:user.coupleId||null};
   }
   if(action==='pushRegister'){
    check(await registerDevice(tx,uid,data,time));
    if(validTimeZone(data.timeZone)&&user.timeZone!==data.timeZone){
     const next={...user,timeZone:data.timeZone};tx.set(userPath,next);
     const c=user.coupleId?await tx.get(`couples/${id(user.coupleId)}`):null;
     if(c?.status==='active'&&[c.user1,c.user2].includes(uid))tx.set(`couples/${user.coupleId}`,{...c,...mirror(c,uid,next)});
    }
    return {};
   }
   if(action==='pushUnregister'){check(await unregisterDevice(tx,uid,data.token));return {};}
   if(action==='pushPrefs'){
    const p=data.notify;check(p&&typeof p.diary==='boolean'&&typeof p.reactions==='boolean'&&['boolean','undefined'].includes(typeof p.anniversaries));
    tx.set(userPath,{...user,notify:{...(user.notify||{}),diary:p.diary,reactions:p.reactions,...(typeof p.anniversaries==='boolean'?{anniversaries:p.anniversaries}:{})}});return {};
   }
   if(action==='createSpace'){
    if(user.coupleId)fail('failed-precondition','이미 일기장이 있습니다.');check(date(data.startDate));const cid=randomUUID();
    tx.set(`couples/${cid}`,{schemaVersion:2,status:'active',user1:uid,user2:null,startDate:data.startDate,settings:{},anniversaries:[],premiumUntil:user.billingUntil||0,createdAt:time,...mirror({},uid,user)});tx.set(userPath,{...user,coupleId:cid});return {coupleId:cid};
   }
   if(action==='join'){
    if(user.coupleId)fail('failed-precondition','현재 일기장을 먼저 보관해주세요.');check(typeof data.code==='string'&&/^[A-F0-9]{16}$/.test(data.code));
    const path=`invitations/${data.code}`,invite=await tx.get(path);if(!invite||invite.expiresAt<=time)fail('not-found','만료되었거나 사용된 초대 코드입니다.');
    const cp=`couples/${invite.coupleId}`,c=await tx.get(cp);if(!c||c.status!=='active'||c.user2||c.user1===uid)fail('failed-precondition','연결할 수 없는 일기장입니다.');
    const owner=await tx.get(`users/${c.user1}`);if(owner?.coupleId!==invite.coupleId)fail('failed-precondition','유효하지 않은 초대입니다.');
    tx.set(cp,{...c,user2:uid,premiumUntil:Math.max(owner.billingUntil||0,user.billingUntil||0),inviteCode:null,inviteExpiresAt:0,...mirror(c,uid,user)});tx.set(userPath,{...user,coupleId:invite.coupleId});tx.delete(path);
    events.push({kind:'connected',to:c.user1,coupleId:invite.coupleId});return {coupleId:invite.coupleId};
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
   if(action==='weather'){
    // share:false removes this member's weather from the space and stops future updates until share:true.
    const shared={...(c.weather||{})};
    if(data.share===false){delete shared[uid];tx.set(userPath,{...user,shareWeather:false});tx.set(cp,{...c,weather:shared});return {};}
    if(data.share===true&&!data.weather){tx.set(userPath,{...user,shareWeather:true});return {};}
    if(user.shareWeather===false&&data.share!==true)return {};
    const row=weatherOf(data.weather,{city:true});check(row);
    if(data.share===true)tx.set(userPath,{...user,shareWeather:true});
    tx.set(cp,{...c,weather:{...shared,[uid]:{...row,at:time}}});return {};
   }
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
    // birthDate is optional (older app versions do not send it); '' clears it.
    let next=c;
    if(data.birthDate!==undefined){
     const latest=new Date(time+14*3600000).toISOString().slice(0,10);
     check(data.birthDate===''||(date(data.birthDate)&&data.birthDate<=latest),'생년월일을 확인해주세요.');
     const birthDate=data.birthDate||null,birthdays={...(c.birthdays||{})};
     if(birthDate)birthdays[uid]=birthDate.slice(5);else delete birthdays[uid];
     tx.set(userPath,{...user,birthDate});next={...c,birthdays};
    }
    tx.set(cp,{...next,startDate:data.startDate,settings:{...c.settings,[uid]:settings}});return {};
   }
   if(action==='anniversaryAdd'||action==='anniversaryDelete'){
    const key=id(data.id),rows=c.anniversaries||[];let next=rows.filter(a=>a.id!==key);
    if(action==='anniversaryAdd'){if(rows.some(a=>a.id===key))return {};check(next.length<30);check(date(data.date));next.push({id:key,name:text(data.name,80),date:data.date,icon:text(data.icon,40),recurring:data.recurring===true});}
    tx.set(cp,{...c,anniversaries:next});return {};
   }
   if(action==='reservePhoto'||action==='uploadPhoto'){
    if(!(c.premiumUntil>time))fail('permission-denied','사진 업로드는 Plus 구독이 필요합니다.');
    const qp=`uploadQuotas/${uid}`,q=quota(await tx.get(qp),time);
    // Only photos attached to a saved diary count toward the published limit; raw attempts get a separate abuse ceiling.
    if(q.daily>=PHOTO_DAILY||q.monthly>=PHOTO_MONTHLY||q.attempts>=PHOTO_ATTEMPTS)fail('resource-exhausted','사진 업로드 한도에 도달했습니다.');
    const filename=randomUUID()+'.jpg',expiresAt=time+10*60000;
    if(action==='uploadPhoto'){
     const match=typeof data.dataUrl==='string'&&data.dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
     if(!match)fail('invalid-argument','사진을 다시 선택해 자동 압축한 뒤 저장해주세요.');
     const buffer=Buffer.from(match[1],'base64');
     if(!buffer.length||buffer.length>512*1024||buffer[0]!==0xff||buffer[1]!==0xd8||buffer[2]!==0xff)fail('invalid-argument','사진을 다시 선택해 자동 압축한 뒤 저장해주세요.');
     const path=`couples/${cid}/${uid}/${filename}`;
     await store.savePhoto(path,buffer);
     tx.set(qp,{...q,attempts:q.attempts+1});tx.set(`couples/${cid}/photoReservations/${filename}`,{uid,expiresAt,createdAt:time,attached:false});return {path,filename};
    }
    tx.set(qp,{...q,attempts:q.attempts+1});tx.set(`couples/${cid}/photoReservations/${filename}`,{uid,expiresAt,createdAt:time,attached:false});return {filename};
   }
   check(date(data.date));const author=['saveEntry','deleteEntry','restoreEntry'].includes(action)?uid:id(data.author);check([c.user1,c.user2].includes(author));
   const ep=`couples/${cid}/entries/${author}_${data.date}`,old=await tx.get(ep);
   if(action==='saveEntry'){
    check(Number.isSafeInteger(data.revision)&&data.revision>=0);if((old?.revision||0)!==data.revision)fail('aborted','다른 화면에서 수정되었습니다. 최신 일기를 다시 불러와주세요.');
    check(Array.isArray(data.photos)&&data.photos.length<=3&&new Set(data.photos).size===data.photos.length);const content=text(data.content,20000),mood=text(data.mood,40);
    const newPhotos=data.photos.filter(p=>!old?.photos?.includes(p));
    if(newPhotos.length){const qp=`uploadQuotas/${uid}`,q=quota(await tx.get(qp),time);if(q.daily+newPhotos.length>PHOTO_DAILY||q.monthly+newPhotos.length>PHOTO_MONTHLY)fail('resource-exhausted','사진 업로드 한도에 도달했습니다.');tx.set(qp,{...q,daily:q.daily+newPhotos.length,monthly:q.monthly+newPhotos.length});}
    for(const p of newPhotos){check(typeof p==='string');const prefix=`couples/${cid}/${uid}/`;if(!p.startsWith(prefix)||!/^[a-f0-9-]+\.jpg$/.test(p.slice(prefix.length)))fail('permission-denied','유효하지 않은 사진입니다.');
     const rp=`couples/${cid}/photoReservations/${p.slice(prefix.length)}`,r=await tx.get(rp);if(!r||r.uid!==uid||r.attached||r.expiresAt<=time||!(c.premiumUntil>time))fail('permission-denied','사진 업로드 권한이 만료되었습니다.');
     if(store.photoExists&&!await store.photoExists(p))fail('failed-precondition','업로드한 사진을 확인할 수 없습니다.');tx.delete(rp);}
    for(const p of old?.photos||[]){
     if(!data.photos.includes(p)&&p.startsWith(`couples/${cid}/${uid}/`)){
      const filename=p.split('/').at(-1);tx.set(`couples/${cid}/photoReservations/${filename}`,{uid,expiresAt:time,createdAt:time,attached:false});
     }
    }
    // The day's weather is recorded once, when the entry is first written; edits keep it.
    const dayWeather=old?.weather||weatherOf(data.weather);
    const entry={...(old||{}),...(dayWeather?{weather:dayWeather}:{}),author:uid,date:data.date,content,mood,photos:data.photos,revision:data.revision+1,comments:old?.comments||[],likedBy:old?.likedBy||[],createdAt:old?.createdAt||time,updatedAt:time,deletedAt:null};
    // Announce a diary to the partner once; later edits, deletes and restores stay quiet.
    const partner=[c.user1,c.user2].find(u=>u&&u!==uid);
    if(partner&&!old?.announcedAt){entry.announcedAt=time;events.push({kind:'diary',to:partner,coupleId:cid,author:uid,date:data.date,name:c.settings?.[uid]?.displayName,thread:`diary-${cid}`});}
    tx.set(ep,entry);return {entry};
   }
   if(!old)fail('not-found','일기를 찾을 수 없습니다.');
   if(action==='deleteEntry'||action==='restoreEntry'){
    if(old.revision!==data.revision)fail('aborted','최신 일기를 다시 불러와주세요.');tx.set(ep,{...old,deletedAt:action==='deleteEntry'?time:null,revision:old.revision+1,updatedAt:time});return {};
   }
   if(old.deletedAt)fail('failed-precondition','삭제된 일기는 변경할 수 없습니다.');
   const reaction=extra=>({coupleId:cid,author,date:data.date,name:c.settings?.[uid]?.displayName,thread:`entry-${cid}-${author}_${data.date}`,...extra});
   if(action==='like'){
    check(typeof data.liked==='boolean');const likedBy=(old.likedBy||[]).filter(u=>u!==uid);if(data.liked)likedBy.push(uid);
    // One heart notification per person per entry, so toggling the heart does not repeat it.
    const notified=old.likeNotified||[],announce=data.liked&&author!==uid&&!notified.includes(uid);
    if(announce)events.push(reaction({kind:'like',to:author,collapse:`like-${author}_${data.date}`}));
    tx.set(ep,{...old,likedBy,...(announce?{likeNotified:[...notified,uid]}:{})});return {};
   }
   const comments=old.comments||[],key=id(data.id),comment=comments.find(c=>c.id===key);
   if(action==='commentAdd'){
    if(comment)return {};check(comments.length<200);const body=text(data.text,1000);tx.set(ep,{...old,comments:[...comments,{id:key,author:uid,text:body,createdAt:time}]});
    // A comment on the partner's entry goes to its author; the author's own comment is a reply to the partner who commented.
    const partner=[c.user1,c.user2].find(u=>u&&u!==uid);
    if(author!==uid)events.push(reaction({kind:'comment',to:author,text:body}));
    else if(partner&&comments.some(x=>x.author===partner))events.push(reaction({kind:'reply',to:partner,text:body}));
    return {};
   }
   if(!['commentEdit','commentDelete'].includes(action))fail('invalid-argument','지원하지 않는 작업입니다.');
   if(!comment)fail('not-found','댓글을 찾을 수 없습니다.');if(comment.author!==uid)fail('permission-denied','본인의 댓글만 변경할 수 있습니다.');
   tx.set(ep,{...old,comments:action==='commentDelete'?comments.filter(c=>c.id!==key):comments.map(c=>c.id===key?{...c,text:text(data.text,1000),updatedAt:time}:c)});return {};
  });
  if(events.length&&notify)await notify(events).catch(()=>{});
  return result;
 }
 return {execute};
}
module.exports={createService,DomainError};
