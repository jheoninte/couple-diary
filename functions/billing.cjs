const {DomainError}=require('./service.cjs');
const PRODUCTS=new Set(['com.interest.couplediary.plus.monthly','com.interest.couplediary.plus.yearly']);
function validateTransaction(row,token,config,now=Date.now()){
 if(!row||row.bundleId!==config.bundleId||row.environment!==config.environment||!PRODUCTS.has(row.productId)||row.type!=='Auto-Renewable Subscription'||row.appAccountToken!==token||!row.transactionId||!row.originalTransactionId||!Number.isSafeInteger(row.expiresDate)||!Number.isSafeInteger(row.purchaseDate))throw new DomainError('permission-denied','Apple 결제 정보가 계정 또는 앱과 일치하지 않습니다.');
 return {transactionId:row.transactionId,originalTransactionId:row.originalTransactionId,productId:row.productId,premiumUntil:!row.revocationDate&&row.expiresDate>now?row.expiresDate:0,expiresDate:row.expiresDate,signedDate:row.signedDate||row.purchaseDate};
}
function mergeEntitlements(existing,incoming,now=Date.now()) {
 const chains={...existing},prior=chains[incoming.originalTransactionId];
 const superseded=!!prior&&prior.signedDate>incoming.signedDate;
 if(!superseded)chains[incoming.originalTransactionId]={premiumUntil:incoming.premiumUntil,signedDate:incoming.signedDate};
 return {chains,superseded,premiumUntil:Math.max(0,...Object.values(chains).map(v=>v.premiumUntil>now?v.premiumUntil:0))};
}
module.exports={validateTransaction,mergeEntitlements,PRODUCTS};
