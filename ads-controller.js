import { ADS_CONFIG } from './ads-config.js';
import { AD_POLICY, adState, recordSave, canShowInterstitial } from './monetization-core.js';

// Membership and consent must both be known before requesting mobile ads.
export function createAdsController({config=ADS_CONFIG,storage=null,now=()=>Date.now()}={}) {
  if(!storage)try{storage=window.localStorage;}catch{}
  let session=null,premium=true,contextKey='',generation=0;
  let sessionStarted=now(),sessionShown=false,pending=null;
  const native=()=>config.provider==='native'?window.diaryNativeAds:null;
  const eligible=()=>{
    try{return !!session?.uid&&!!session?.coupleId&&!session.archive&&!premium&&window.diaryAdConsent?.canRequestAds?.()===true;}
    catch{return false;}
  };
  const stateKey=()=>`diary:ads:v2:${session.uid}`;
  function read(){return adState(JSON.parse(storage.getItem(stateKey())||'null'),now());}
  function write(counts){storage.setItem(stateKey(),JSON.stringify(counts));}
  function safeScreen(){return document.visibilityState==='visible'&&
    !window.diaryBilling?.busy&&
    !document.documentElement.classList.contains('keyboard-open')&&
    !document.querySelector('#authGate:not([hidden]),dialog[open],.settings-modal.active,.confirm-modal.active,.modal.active')&&
    !document.querySelector('input:focus,textarea:focus,[contenteditable="true"]:focus');}
  async function updateBanner(){
    const adapter=native();if(!adapter)return;
    if(eligible())await adapter.showBanner();else await adapter.hideBanner();
  }
  function prefetch(){
    if(!eligible()||!config.interstitialEnabled||sessionShown)return;
    try{if(canShowInterstitial(read(),now()))Promise.resolve(native()?.prepareInterstitial?.()).catch(()=>{});}catch{}
  }
  return {
    async update(context,isPremium){
      const key=JSON.stringify([context?.uid,context?.coupleId,context?.archive]);
      if(key!==contextKey){generation++;pending=null;sessionShown=false;sessionStarted=now();contextKey=key;}
      session=context;premium=isPremium!==false;
      if(premium)pending=null;
      if(session&&!session.archive&&!premium)try{write(read());}catch{}
      await updateBanner();prefetch();
    },
    reset(){
      generation++;session=null;premium=true;contextKey='';pending=null;
      Promise.resolve(native()?.hideBanner?.()).catch(()=>{});
    },
    async consentChanged(){if(!eligible())pending=null;await updateBanner();prefetch();},
    suspend(){pending=null;},
    afterSave({isNew=false,returnedToRecords=false}={}){
      if(!session||session.archive||premium||!isNew)return;
      try{write(recordSave(read(),now()));}catch{return;}
      // Saving never opens an ad. Only a later explicit browsing transition may do so.
      pending=returnedToRecords?{at:now(),generation}:null;
      prefetch();
    },
    async sectionChanged({from,to,userInitiated=false}={}){
      const opportunity=pending;
      if(!userInitiated||from===to)return;
      if(to==='write'||to==='settings'){pending=null;return;}
      if(!['calendar','memories'].includes(from)||!['calendar','memories'].includes(to))return;
      if(!opportunity)return;
      const age=now()-opportunity.at;
      if(age<AD_POLICY.afterSaveMs)return;
      pending=null; // Never queue an ad to appear later if this transition is missed.
      const transitionAt=now();
      const stillSafe=()=>opportunity.generation===generation&&eligible()&&safeScreen()&&
        now()-transitionAt<=AD_POLICY.maximumTransitionDelayMs&&
        !!document.querySelector(`#${to}.active`);
      if(age>AD_POLICY.opportunityMs||now()-sessionStarted<AD_POLICY.minimumSessionMs||
         sessionShown||!config.interstitialEnabled||!stillSafe()||!native()?.isInterstitialReady?.())return;
      let counts;
      try{
        counts=read();if(!canShowInterstitial(counts,now()))return;
        write({...counts,shown:counts.shown+1,lastShown:now(),lastShownSave:counts.saves});
      }catch{return;}
      // Reserve first: SDK failures never cause another attempt in this session.
      sessionShown=true;
      try{await native().showInterstitial({canShow:stillSafe});}catch{}
    },
  };
}
