const {DomainError}=require('./service.cjs');
const PRODUCTS=new Set(['com.interest.couplediary.plus.monthly','com.interest.couplediary.plus.yearly']);
// A production server must also accept Sandbox: App Review and TestFlight purchase with sandbox accounts
// even in the App Store build (Apple: verify with production first, then sandbox on an environment mismatch).
function acceptedEnvironments(config){return config.environment==='Production'?['Production','Sandbox']:[config.environment];}
const INVALID_ENVIRONMENT=4; // VerificationStatus.INVALID_ENVIRONMENT
async function decodeSigned(environments,verifierFor,method,signed){
 for(const [index,environment] of environments.entries()){
  try{return await verifierFor(environment)[method](signed);}
  catch(e){if(e?.status!==INVALID_ENVIRONMENT||index===environments.length-1)throw e;}
 }
}
function validateTransaction(row,token,config,now=Date.now()){
 if(!row||row.bundleId!==config.bundleId||!acceptedEnvironments(config).includes(row.environment)||!PRODUCTS.has(row.productId)||row.type!=='Auto-Renewable Subscription'||row.appAccountToken!==token||!row.transactionId||!row.originalTransactionId||!Number.isSafeInteger(row.expiresDate)||!Number.isSafeInteger(row.purchaseDate))throw new DomainError('permission-denied','Apple 결제 정보가 계정 또는 앱과 일치하지 않습니다.');
 return {transactionId:row.transactionId,originalTransactionId:row.originalTransactionId,productId:row.productId,environment:row.environment,premiumUntil:!row.revocationDate&&row.expiresDate>now?row.expiresDate:0,expiresDate:row.expiresDate,signedDate:row.signedDate||row.purchaseDate};
}
function mergeEntitlements(existing,incoming,now=Date.now()) {
 const chains={...existing},prior=chains[incoming.originalTransactionId];
 const superseded=!!prior&&prior.signedDate>incoming.signedDate;
 if(!superseded)chains[incoming.originalTransactionId]={premiumUntil:incoming.premiumUntil,signedDate:incoming.signedDate,...(incoming.environment?{environment:incoming.environment}:{})};
 return {chains,superseded,premiumUntil:Math.max(0,...Object.values(chains).map(v=>v.premiumUntil>now?v.premiumUntil:0))};
}
module.exports={validateTransaction,mergeEntitlements,acceptedEnvironments,decodeSigned,PRODUCTS};
