const {createHash}=require('node:crypto');
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function ensure(ok,message){if(!ok)throw Error(`이전 중단: ${message}`);}
function fields(value,allowed,label){ensure(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k)),`${label}에 알 수 없는 필드`);}
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return v>='1900-01-01'&&v<='2200-12-31'&&Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
function timestamp(v,fallback){if(v===undefined)return fallback;const n=typeof v==='number'?v:Date.parse(v);ensure(Number.isSafeInteger(n)&&n>=0,'날짜 형식');return n;}
const stable=(...parts)=>createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,32);
function legacyPhotoPath(value,bucket,uid){
 ensure(typeof value==='string','사진 경로');let path=value;
 if(value.startsWith('https://')){
  const u=new URL(value);ensure(u.hostname==='firebasestorage.googleapis.com'&&!u.port&&!u.username&&!u.password,'사진 호스트');
  const match=u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);ensure(match&&decodeURIComponent(match[1])===bucket,'다른 버킷의 사진');path=decodeURIComponent(match[2]);
 }
 ensure(path.startsWith(`photos/${uid}/`)&&path.split('/').length===3&&!['.','..',''].includes(path.split('/')[2])&&!/[\\\x00-\x1f]/.test(path),'사진 작성자/경로');return path;
}
function planLegacyCouple(cid,source,bucket){
 ensure(safeId(cid)&&safeId(source?.user1)&&(source.user2==null||safeId(source.user2)&&source.user2!==source.user1),'커플 멤버');
 fields(source,['user1','user2','schemaVersion','status','myEntries','settings','anniversaries','startDate','createdAt','updatedAt','code','createdBy','connectedAt'],'커플');
 ensure(source.status===undefined||source.status==='active','닫힌 공간');
 ensure(!source.schemaVersion||source.schemaVersion===1,'지원하지 않는 스키마');
 ensure(source.myEntries&&typeof source.myEntries==='object'&&!Array.isArray(source.myEntries),'myEntries 형식');
 const members=[source.user1,source.user2].filter(Boolean),entries=[],photos=new Set(),createdAt=timestamp(source.createdAt,0);
 for(const [uid,days]of Object.entries(source.myEntries)){
  ensure(members.includes(uid)&&days&&typeof days==='object'&&!Array.isArray(days),'알 수 없는 작성자');
  for(const [date,e]of Object.entries(days)){
   fields(e,['content','mood','photos','comments','liked','likedBy','createdAt','author','authorEmail'],'일기');
   ensure(e.likedBy===undefined||Array.isArray(e.likedBy)&&e.likedBy.length<=2&&e.likedBy.every(u=>members.includes(u))&&new Set(e.likedBy).size===e.likedBy.length,'좋아요 작성자');
   ensure(e.liked===undefined||typeof e.liked==='boolean','좋아요 형식');
   ensure(validDate(date)&&e&&typeof e==='object'&&(!e.author||e.author===uid),'일기 날짜/작성자');
   ensure(typeof e.content==='string'&&e.content.length>0&&e.content.length<=20000&&typeof e.mood==='string'&&e.mood.length>0&&e.mood.length<=40,'일기 내용/기분');
   ensure(!e.photos||Array.isArray(e.photos)&&e.photos.length<=3,'사진 개수');
   const paths=(e.photos||[]).map(v=>legacyPhotoPath(v,bucket,uid));ensure(new Set(paths).size===paths.length,'중복 사진');paths.forEach(p=>photos.add(p));
   ensure(!e.comments||Array.isArray(e.comments)&&e.comments.length<=200,'댓글 개수');
   const at=timestamp(e.createdAt,createdAt),comments=(e.comments||[]).map((c,index)=>{
    fields(c,['author','text','createdAt'],'댓글');
    ensure(c&&typeof c.text==='string'&&c.text.length>0&&c.text.length<=1000,'댓글 내용');
    const author=members.includes(c.author)?c.author:'legacy:unknown';return {id:stable(cid,uid,date,'comment',index),author,text:c.text,createdAt:timestamp(c.createdAt,at),...(author==='legacy:unknown'?{legacyAuthorLabel:String(c.author||'알 수 없음').slice(0,80)}:{})};
   });
   entries.push({id:`${uid}_${date}`,data:{author:uid,date,content:e.content,mood:e.mood,photos:paths,comments,likedBy:e.likedBy||[],legacyLiked:e.liked===true,revision:1,createdAt:at,updatedAt:at,deletedAt:null}});
  }
 }
 const startDate=source.startDate||(createdAt?new Date(createdAt).toISOString().slice(0,10):null);ensure(validDate(startDate),'시작일 확인 필요');
 const settings=source.settings||{};ensure(settings&&typeof settings==='object'&&!Array.isArray(settings)&&Object.keys(settings).every(u=>members.includes(u)),'설정 작성자');
 for(const setting of Object.values(settings)){fields(setting,['icon','theme','appTitle','displayName'],'사용자 설정');for(const [key,max]of [['icon',40],['theme',30],['appTitle',60],['displayName',40]])ensure(setting[key]===undefined||typeof setting[key]==='string'&&setting[key].length<=max,'설정 값');}
 const anniversaries=source.anniversaries||[];ensure(Array.isArray(anniversaries)&&anniversaries.length<=30,'기념일 개수');
 const nextAnniversaries=anniversaries.map((a,i)=>{fields(a,['name','date','icon','recurring'],'기념일');ensure(a.recurring===undefined||typeof a.recurring==='boolean','기념일 반복 형식');ensure(a.icon===undefined||typeof a.icon==='string'&&a.icon.length<=40,'기념일 아이콘');ensure(a&&validDate(a.date)&&typeof a.name==='string'&&a.name.length>0&&a.name.length<=80,'기념일');return {id:stable(cid,'anniversary',i),name:a.name,date:a.date,icon:typeof a.icon==='string'?a.icon.slice(0,40):'🎉',recurring:a.recurring===true};});
 return {couple:{schemaVersion:2,status:'active',user1:source.user1,user2:source.user2||null,startDate,settings,anniversaries:nextAnniversaries,createdAt,premiumUntil:0,inviteCode:null,inviteExpiresAt:0},entries:entries.sort((a,b)=>a.id.localeCompare(b.id)),photos:[...photos].sort()};
}
module.exports={planLegacyCouple,legacyPhotoPath};
