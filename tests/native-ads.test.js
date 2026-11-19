import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createNativeAdsAdapter} from '../native-ads.js';

function fixture(){
 const dom=new JSDOM('<body><nav class="tab-nav"></nav><section id="calendar" class="active"></section><section id="write"></section><section id="memories"><div class="memory-item"></div></section><div class="settings-modal"></div><textarea></textarea></body>',{pretendToBeVisual:true});
 const doc=dom.window.document,calls=[],events=new Map();let premium=false,permission=true,failBanner=false,time=1000;
 const AdMob={
  addListener:async(name,callback)=>{events.set(name,callback);return {remove:async()=>{}};},
  showBanner:async()=>{calls.push('banner');if(failBanner)throw Error('no fill');},
  hideBanner:async()=>{calls.push('hide');},resumeBanner:async()=>{calls.push('resume');},removeBanner:async()=>{calls.push('remove');},
  prepareInterstitial:async()=>{calls.push('prepare');},showInterstitial:async()=>{calls.push('interstitial');},
 };
 const sdk={AdMob,BannerAdSize:{BANNER:'BANNER'},BannerAdPosition:{BOTTOM_CENTER:'BOTTOM_CENTER'}};
 const adapter=createNativeAdsAdapter({getSDK:()=>sdk,config:{bannerId:'test-banner',interstitialId:'test-interstitial',testAds:true},canRequestAds:()=>permission,isPremium:()=>premium,doc,now:()=>time});
 return {dom,doc,adapter,AdMob,calls,events,premium:v=>{premium=v;},permission:v=>{permission=v;},failBanner:v=>{failBanner=v;},advance:ms=>{time+=ms;},space:()=>doc.documentElement.style.getPropertyValue('--native-ad-space'),flush:async()=>{await new Promise(r=>setImmediate(r));await adapter.showBanner();},close:()=>dom.window.close()};
}

test('one mobile banner persists across the three sections and hides for text entry, dialogs and settings',async()=>{
 const f=fixture();await f.adapter.showBanner();f.events.get('bannerAdLoaded')();await f.flush();assert.notEqual(f.space(),'0px');
 for(const section of ['write','memories','calendar']){
  f.doc.querySelector('.active').classList.remove('active');f.doc.getElementById(section).classList.add('active');await f.flush();
 }
 assert.equal(f.calls.filter(c=>c==='banner').length,1);
 const textarea=f.doc.querySelector('textarea');textarea.focus();await f.flush();assert.equal(f.space(),'0px');assert.equal(f.calls.at(-1),'hide');
 textarea.blur();await f.flush();assert.equal(f.calls.at(-1),'resume');
 const dialog=f.doc.createElement('dialog');dialog.setAttribute('open','');f.doc.body.append(dialog);await f.flush();assert.equal(f.space(),'0px');
 dialog.remove();await f.flush();
 f.doc.querySelector('.settings-modal').classList.add('active');await f.flush();assert.equal(f.space(),'0px');
 f.doc.querySelector('.settings-modal').classList.remove('active');await f.flush();
 f.premium(true);await f.adapter.hideBanner();assert.equal(f.space(),'0px');assert.equal(f.calls.at(-1),'remove');f.close();
});

test('banner no-fill removes empty space without repeatedly requesting ads',async()=>{
 const f=fixture();f.failBanner(true);await f.adapter.showBanner();assert.equal(f.space(),'0px');
 for(let i=0;i<5;i++)await f.adapter.showBanner();assert.equal(f.calls.filter(c=>c==='banner').length,1);
 f.advance(60_000);f.failBanner(false);await f.adapter.showBanner();f.events.get('bannerAdFailedToLoad')();await f.flush();
 assert.equal(f.space(),'0px');assert.equal(f.calls.at(-1),'remove');f.close();
});

test('startup overlays and an empty album never show a banner',async()=>{
 const f=fixture();const gate=f.doc.createElement('div');gate.id='authGate';f.doc.body.append(gate);
 await f.adapter.showBanner();assert.equal(f.calls.includes('banner'),false);
 gate.hidden=true;await f.flush();assert.equal(f.calls.includes('banner'),true);
 f.doc.getElementById('calendar').classList.remove('active');f.doc.getElementById('memories').classList.add('active');
 f.doc.querySelector('.memory-item').remove();await f.flush();assert.equal(f.calls.at(-1),'hide');assert.equal(f.space(),'0px');f.close();
});

test('an in-flight banner cannot remain visible after a Plus upgrade',async()=>{
 const f=fixture();let release;f.AdMob.showBanner=()=>new Promise(resolve=>{release=resolve;});
 const loading=f.adapter.showBanner();await new Promise(r=>setImmediate(r));
 f.premium(true);const removing=f.adapter.hideBanner();release();await Promise.all([loading,removing]);
 f.events.get('bannerAdLoaded')();await new Promise(r=>setImmediate(r));
 assert.equal(f.space(),'0px');assert.ok(f.calls.includes('hide'));assert.equal(f.calls.at(-1),'remove');f.close();
});

test('interstitial presentation never waits for a download and restores the banner after dismissal',async()=>{
 const f=fixture();await f.adapter.showBanner();f.events.get('bannerAdLoaded')();await f.flush();
 assert.equal(await f.adapter.showInterstitial({canShow:()=>true}),false);assert.ok(!f.calls.includes('prepare'));
 await f.adapter.prepareInterstitial();assert.equal(f.adapter.isInterstitialReady(),true);
 assert.equal(await f.adapter.showInterstitial({canShow:()=>true}),true);assert.equal(f.calls.at(-1),'interstitial');assert.equal(f.space(),'0px');
 f.events.get('interstitialAdDismissed')();await f.flush();assert.equal(f.calls.at(-1),'resume');
 f.close();
});

test('late interstitial downloads cannot show after consent loss and cached ads expire',async()=>{
 const f=fixture();let release;f.AdMob.prepareInterstitial=()=>new Promise(resolve=>{release=resolve;});
 const loading=f.adapter.prepareInterstitial();await new Promise(r=>setImmediate(r));f.permission(false);release();await loading;
 assert.equal(f.adapter.isInterstitialReady(),false);assert.equal(await f.adapter.showInterstitial({canShow:()=>true}),false);
 f.permission(true);f.AdMob.prepareInterstitial=async()=>{};await f.adapter.prepareInterstitial();f.advance(30*60_000);
 assert.equal(f.adapter.isInterstitialReady(),false);f.close();
});
