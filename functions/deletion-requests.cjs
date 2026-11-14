const {randomBytes,createHash}=require('node:crypto');
const {DomainError}=require('./service.cjs');
const receiptHash=token=>createHash('sha256').update(token).digest('hex');
function createDeletionRequests(store,{now=Date.now}={}){
 return {
  async request(uid,authTime,email=''){
   if(!uid)throw new DomainError('unauthenticated','로그인해주세요.');
   const time=now();if(!Number.isFinite(authTime)||authTime*1000>time+60000||time-authTime*1000>300000)throw new DomainError('failed-precondition','안전을 위해 비밀번호를 다시 확인해주세요.');
   const receipt=randomBytes(32).toString('hex'),hash=receiptHash(receipt);
   return store.transaction(async tx=>{
    const jobPath=`accountDeletions/${uid}`,old=await tx.get(jobPath);
    if(old?.status==='complete')throw new DomainError('failed-precondition','이미 삭제된 계정입니다.');
    const user=await tx.get(`users/${uid}`)||{},cid=user.coupleId;
    const couple=cid?await tx.get(`couples/${cid}`):null;
    const partner=couple?[couple.user1,couple.user2].find(u=>u&&u!==uid):null;
    const partnerUser=partner?await tx.get(`users/${partner}`):null;
    if(!old&&couple?.status==='migrating')throw new DomainError('failed-precondition','기록 이전을 처리 중입니다. 잠시 후 삭제 요청을 다시 시도해주세요.');
    if(!old&&couple&&couple.schemaVersion!==2)throw new DomainError('failed-precondition','기존 기록 이전 검토가 필요합니다. cs@comino.app으로 문의해주세요.');
    if(!old&&couple?.status==='active'&&[couple.user1,couple.user2].includes(uid)){
     if(partner){if(partnerUser?.coupleId===cid)tx.set(`users/${partner}`,{...partnerUser,coupleId:null});tx.set(`users/${partner}/archives/${cid}`,{coupleId:cid,closedAt:time});}
     if(couple.inviteCode)tx.delete(`invitations/${couple.inviteCode}`);
     tx.set(`couples/${cid}`,{...couple,status:'closed',closedAt:time,premiumUntil:0,inviteCode:null,photoPermits:{}});
    }
    const job=old?{...old,receiptHash:hash}:{status:'pending',phase:'spaces',requestedAt:time,dueAt:time+7*86400000,receiptHash:hash,email,mode:'manual'};
    if(old?.receiptHash)tx.delete(`deletionReceipts/${old.receiptHash}`);
    tx.set(jobPath,job);if(!old)tx.set(`users/${uid}`,{...user,coupleId:null,status:'deleting'});
    tx.set(`deletionReceipts/${hash}`,{status:'pending',requestedAt:job.requestedAt,dueAt:job.dueAt});
    return {receipt,status:job.status,dueAt:job.dueAt};
   });
  },
  async status(receipt){
   if(typeof receipt!=='string'||!/^[a-f0-9]{64}$/.test(receipt))throw new DomainError('invalid-argument','접수번호를 확인해주세요.');
   return store.transaction(async tx=>{const row=await tx.get(`deletionReceipts/${receiptHash(receipt)}`);if(!row||row.expiresAt&&row.expiresAt<now())throw new DomainError('not-found','삭제 요청 정보를 찾을 수 없습니다.');return row;});
  }
 };
}
module.exports={createDeletionRequests,receiptHash};
