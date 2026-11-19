// Native SDK operations are serialized so late loads cannot resurrect an old banner.
export function createNativeAdsAdapter({getSDK,config,canRequestAds,isPremium,isBillingBusy=()=>false,nonPersonalized=()=>false,doc=document,now=()=>Date.now()}) {
  let wanted=false,created=false,visible=false,loaded=false,height=50,fullScreen=false;
  let queue=Promise.resolve(),listeners=null,retryBannerAt=0,retryInterstitialAt=0;
  let readyAt=null,preparing=null,epoch=0;
  const allowed=()=>canRequestAds()&&!isPremium();
  const obstructed=()=>doc.visibilityState!=='visible'||fullScreen||isBillingBusy()||
    doc.documentElement.classList.contains('keyboard-open')||
    !!doc.querySelector('#authGate:not([hidden]),dialog[open],.modal.active,.settings-modal.active,.confirm-modal.active,input:focus,textarea:focus,[contenteditable="true"]:focus');
  const bannerAllowed=()=>wanted&&allowed()&&!obstructed()&&
    !!doc.querySelector('#calendar.active,#write.active,#memories.active .memory-item');
  function space(){
    // The SDK anchors to the native safe area; leave extra clearance around the ad.
    const bottomPadding=parseFloat(doc.defaultView.getComputedStyle(doc.querySelector('.tab-nav')||doc.body).paddingBottom)||0;
    doc.documentElement.style.setProperty('--native-ad-space',visible&&loaded&&bannerAllowed()?`${height+24+bottomPadding}px`:'0px');
  }
  function reconcile(){
    // Collapse the web spacer immediately when keyboard/dialog/Plus state changes.
    space();
    queue=queue.then(async()=>{
      const sdk=getSDK();if(!sdk)return;
      if(!wanted||!allowed()){
        if(created)await sdk.AdMob.removeBanner();
        created=false;visible=false;loaded=false;space();return;
      }
      if(!bannerAllowed()){
        if(visible){visible=false;space();await sdk.AdMob.hideBanner();}
        return;
      }
      if(created){
        if(!visible){visible=true;await sdk.AdMob.resumeBanner();space();}
        return;
      }
      if(now()<retryBannerAt)return;
      await watch();if(!bannerAllowed())return;
      const navHeight=doc.querySelector('.tab-nav')?.getBoundingClientRect().height||82;
      doc.documentElement.style.setProperty('--native-nav-space',`${navHeight}px`);
      created=true;visible=true;loaded=false;
      await sdk.AdMob.showBanner({adId:config.bannerId,isTesting:config.testAds,adSize:sdk.BannerAdSize.BANNER,
        npa:nonPersonalized(),position:sdk.BannerAdPosition.BOTTOM_CENTER,margin:Math.ceil(navHeight+12)});
      // Recheck after crossing the native bridge: entitlement or screen may have changed.
      if(!bannerAllowed()){visible=false;space();await sdk.AdMob.hideBanner();}
    }).catch(async()=>{
      retryBannerAt=now()+60_000;created=false;visible=false;loaded=false;space();
      try{await getSDK()?.AdMob.removeBanner();}catch{}
    });
    return queue;
  }
  async function watch(){
    if(listeners)return listeners;
    const sdk=getSDK();
    const onEnd=()=>{fullScreen=false;void reconcile();};
    listeners=Promise.all([
      sdk.AdMob.addListener('bannerAdLoaded',()=>{loaded=true;space();void reconcile();}),
      sdk.AdMob.addListener('bannerAdSizeChanged',event=>{if(event.height>0)height=Math.max(50,Math.min(event.height,90));space();}),
      sdk.AdMob.addListener('bannerAdFailedToLoad',()=>{
        retryBannerAt=now()+60_000;visible=false;loaded=false;space();
        // Remove the failed native view once, without a reload loop.
        queue=queue.then(async()=>{if(created)await sdk.AdMob.removeBanner();created=false;}).catch(()=>{});
      }),
      sdk.AdMob.addListener('interstitialAdDismissed',onEnd),
      sdk.AdMob.addListener('interstitialAdFailedToShow',onEnd),
    ]);
    return listeners;
  }
  const observer=new doc.defaultView.MutationObserver(()=>{void reconcile();});
  observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open','hidden']});
  doc.addEventListener('focusin',()=>{void reconcile();});
  doc.addEventListener('focusout',()=>{void reconcile();});
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState!=='visible'){epoch++;readyAt=null;}void reconcile();});
  const adapter={
    showBanner(){wanted=true;return reconcile();},
    hideBanner(){wanted=false;epoch++;readyAt=null;return reconcile();},
    isInterstitialReady(){return allowed()&&readyAt!==null&&now()-readyAt<30*60_000;},
    async prepareInterstitial(){
      if(!allowed()||adapter.isInterstitialReady()||preparing||now()<retryInterstitialAt)return;
      const requestEpoch=epoch;
      preparing=(async()=>{
        await watch();if(!allowed()||requestEpoch!==epoch)return;
        const sdk=getSDK();
        await sdk.AdMob.prepareInterstitial({adId:config.interstitialId,isTesting:config.testAds,npa:nonPersonalized()});
        if(allowed()&&requestEpoch===epoch)readyAt=now();
      })().catch(()=>{readyAt=null;retryInterstitialAt=now()+60_000;}).finally(()=>{preparing=null;});
      return preparing;
    },
    async showInterstitial({canShow=()=>false}={}){
      if(!adapter.isInterstitialReady()||obstructed()||!canShow())return false;
      readyAt=null;fullScreen=true;
      try{
        await reconcile();
        if(!allowed()||doc.visibilityState!=='visible'||!canShow()){fullScreen=false;void reconcile();return false;}
        await getSDK().AdMob.showInterstitial();return true;
      }catch{fullScreen=false;void reconcile();return false;}
    },
  };
  return adapter;
}
