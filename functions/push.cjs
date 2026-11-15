const crypto=require('node:crypto');
const {render}=require('./push-messages.cjs');
// Which preference turns each kind off. "connected" is a one-time event the inviter is waiting for.
const PREFERENCE={diary:'diary',like:'reactions',comment:'reactions',reply:'reactions'};
const MAX_DEVICES=5;
const tokenId=token=>crypto.createHash('sha256').update(token).digest('hex').slice(0,40);
const validToken=v=>typeof v==='string'&&/^[a-f0-9]{64,200}$/.test(v);

// Token bookkeeping runs inside the diary service transaction (rate limits and deletion checks apply).
// pushDevices/{uid}: {devices:[{id,token,environment,locale,updatedAt}]} — server only.
// pushTokens/{id}: {uid} — lets a device that signs into another account leave the previous one.
async function registerDevice(tx,uid,{token,environment,locale},time){
 if(!validToken(token))return false;
 const id=tokenId(token),owner=await tx.get(`pushTokens/${id}`),mine=await tx.get(`pushDevices/${uid}`);
 let previous=null;if(owner&&owner.uid!==uid)previous=await tx.get(`pushDevices/${owner.uid}`);
 if(previous)tx.set(`pushDevices/${owner.uid}`,{devices:(previous.devices||[]).filter(d=>d.id!==id)});
 const devices=(mine?.devices||[]).filter(d=>d.id!==id);
 // Newest first (the sort is stable), so the cap drops the least recently registered devices.
 devices.unshift({id,token,environment:environment==='development'?'development':'production',locale:typeof locale==='string'?locale.slice(0,20):'en',updatedAt:time});
 devices.sort((a,b)=>b.updatedAt-a.updatedAt);
 for(const old of devices.splice(MAX_DEVICES))tx.delete(`pushTokens/${old.id}`);
 tx.set(`pushDevices/${uid}`,{devices});tx.set(`pushTokens/${id}`,{uid});return true;
}
async function unregisterDevice(tx,uid,token){
 if(!validToken(token))return false;
 const id=tokenId(token),owner=await tx.get(`pushTokens/${id}`),mine=await tx.get(`pushDevices/${uid}`);
 if(mine)tx.set(`pushDevices/${uid}`,{devices:(mine.devices||[]).filter(d=>d.id!==id)});
 if(owner?.uid===uid)tx.delete(`pushTokens/${id}`);return true;
}

// Delivery happens after the diary transaction commits. A failed push never fails the user's action.
function createPush({read,removeDevices,send,log=console}){
 return async function deliver(events){
  for(const event of events){
   try{
    const [devices,user]=await Promise.all([read(`pushDevices/${event.to}`),read(`users/${event.to}`)]);
    const pref=PREFERENCE[event.kind];
    if(!devices?.devices?.length||(pref&&user?.notify?.[pref]===false))continue;
    // The partner may have disconnected or moved to another space between commit and delivery.
    if(event.coupleId&&user?.coupleId!==event.coupleId)continue;
    const dead=[];
    await Promise.all(devices.devices.map(async device=>{
     const {title,body}=render(event.kind,event,device.locale);
     const result=await send(device,{title,body,thread:event.thread,collapse:event.collapse,data:{kind:event.kind,coupleId:event.coupleId||'',author:event.author||'',date:event.date||''}});
     if(result==='invalid')dead.push(device.id);
    }));
    if(dead.length)await removeDevices(event.to,dead);
   }catch(e){log.error('Push delivery failed',event.kind,e.code||e.name||e.message);}
  }
 };
}

// Apple Push Notification service over HTTP/2 with a token (.p8) key. No third-party SDK needed.
function createApnsSender({keyId,teamId,key,bundleId,http2=require('node:http2'),now=Date.now}){
 let jwt=null,issuedAt=0;
 const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
 function token(){
  // APNs rejects tokens older than an hour and also refreshes made more often than every 20 minutes.
  if(jwt&&now()-issuedAt<40*60000)return jwt;
  issuedAt=now();const head=b64({alg:'ES256',kid:keyId}),claims=b64({iss:teamId,iat:Math.floor(issuedAt/1000)});
  const signature=crypto.sign('sha256',Buffer.from(`${head}.${claims}`),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  jwt=`${head}.${claims}.${signature}`;return jwt;
 }
 const sessions=new Map();
 function session(environment){
  const host=environment==='development'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com';
  let s=sessions.get(host);if(s&&!s.closed&&!s.destroyed)return s;
  s=http2.connect(host);s.on('error',()=>sessions.delete(host));s.on('close',()=>sessions.delete(host));s.unref?.();sessions.set(host,s);return s;
 }
 return function send(device,{title,body,thread,collapse,data}){
  const payload=JSON.stringify({aps:{alert:{title,body},sound:'default',...(thread?{'thread-id':thread}:{})},...data});
  const headers={':method':'POST',':path':`/3/device/${device.token}`,authorization:`bearer ${token()}`,'apns-topic':bundleId,'apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(now()/1000)+86400),...(collapse?{'apns-collapse-id':collapse.slice(0,64)}:{})};
  return new Promise(resolve=>{
   let request;try{request=session(device.environment).request(headers);}catch(e){console.error('APNs connection failed',e.code||e.name);resolve('error');return;}
   let status=0,text='';
   request.setTimeout(10000,()=>request.close());
   request.on('response',h=>{status=h[':status'];});request.setEncoding('utf8');request.on('data',c=>{text+=c;});
   request.on('end',()=>{
    if(status===200)return resolve('sent');
    let reason='';try{reason=JSON.parse(text).reason;}catch{}
    // Unregistered (410) and bad tokens are removed; anything else (auth, topic) is a configuration error to log.
    if(status===410||['BadDeviceToken','DeviceTokenNotForTopic','Unregistered'].includes(reason))return resolve('invalid');
    console.error('APNs rejected push',status,reason);resolve('error');
   });
   request.on('error',e=>{console.error('APNs request failed',e.code||e.name);resolve('error');});
   request.end(payload);
  });
 };
}
module.exports={registerDevice,unregisterDevice,createPush,createApnsSender,tokenId,PREFERENCE};
