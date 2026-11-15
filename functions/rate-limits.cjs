const MUTATIONS=new Set(['createSpace','join','invite','disconnect','settings','anniversaryAdd','anniversaryDelete','reservePhoto','uploadPhoto','saveEntry','deleteEntry','restoreEntry','like','commentAdd','commentEdit','commentDelete','pushRegister','pushUnregister','pushPrefs','weather']);
async function reserveOperation(tx,uid,action,now){
 if(!MUTATIONS.has(action))return true;
 const path=`operationLimits/${uid}`,old=await tx.get(path)||{},day=new Date(now+9*3600000).toISOString().slice(0,10),minute=Math.floor(now/60000);
 const row={day,minute,daily:old.day===day?old.daily:0,perMinute:old.minute===minute?old.perMinute:0,spaces:old.day===day?old.spaces||0:0,invites:old.day===day?old.invites||0:0,expiresAt:now+2*86400000};
 if(row.perMinute>=120||row.daily>=1000||action==='createSpace'&&row.spaces>=10||action==='invite'&&row.invites>=20)return false;
 row.perMinute++;row.daily++;if(action==='createSpace')row.spaces++;if(action==='invite')row.invites++;tx.set(path,row);return true;
}
module.exports={reserveOperation};
