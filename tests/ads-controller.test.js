import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createAdsController} from '../ads-controller.js';
import {AD_POLICY,adState,recordSave,canShowInterstitial} from '../monetization-core.js';

const DAY=86_400_000,base=Date.UTC(2026,10,20,12);
function fixture({aged=true,ready=true,storageFails=false}={}){
 const dom=new JSDOM('<body><section id="calendar" class="section active"></section><section id="write" class="section"></section><section id="memories" class="section"></section><textarea></textarea></body>',{url:'https://app.test/',pretendToBeVisual:true});
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 let time=base,consent=true,shown=0,prepared=0,banners=0,hidden=0;
 const data=new Map();
 const key='diary:ads:v2:me';
 data.set(key,JSON.stringify({...adState(null,time),firstSeenAt:aged?time-3*DAY:time,saves:2}));
 const storage={getItem:k=>{if(storageFails)throw Error('storage unavailable');return data.get(k);},setItem:(k,v)=>{if(storageFails)throw Error('storage unavailable');data.set(k,v);}};
 window.diaryAdConsent={canRequestAds:()=>consent};
 window.diaryNativeAds={showBanner:async()=>{banners++;},hideBanner:async()=>{hidden++;},prepareInterstitial:async()=>{prepared++;},isInterstitialReady:()=>ready,showInterstitial:async({canShow})=>{if(canShow())shown++;}};
 const controller=createAdsController({config:{provider:'native',interstitialEnabled:true},storage,now:()=>time});
 const context={uid:'me',coupleId:'us'};
 return {dom,controller,context,data,key,get shown(){return shown;},get prepared(){return prepared;},get banners(){return banners;},get hidden(){return hidden;},advance:ms=>{time+=ms;},consent:v=>{consent=v;},ready:v=>{ready=v;},counts:()=>JSON.parse(data.get(key)),
  save:()=>controller.afterSave({isNew:true,returnedToRecords:true}),
  async move(to='memories',userInitiated=true){const from=document.querySelector('.section.active').id;document.querySelector('.section.active').classList.remove('active');document.getElementById(to).classList.add('active');await controller.sectionChanged({from,to,userInitiated});},
  close:()=>dom.window.close()};
}

test('ads wait through grace, then require three new records and a full rolling day between impressions',()=>{
 let counts=adState(null,base);for(let i=0;i<3;i++)counts=recordSave(counts,base);
 assert.equal(canShowInterstitial(counts,base+AD_POLICY.graceMs-1),false);
 const later=base+AD_POLICY.graceMs;assert.equal(canShowInterstitial(counts,later),true);
 counts={...adState(counts,later),shown:1,lastShown:later,lastShownSave:counts.saves};
 for(let i=0;i<3;i++)counts=recordSave(counts,later+DAY-1);
 assert.equal(canShowInterstitial(counts,later+DAY-1),false);
 assert.equal(canShowInterstitial(counts,later+DAY),true);
 assert.equal(canShowInterstitial({...counts,saves:5},later+DAY),false);
 assert.equal(canShowInterstitial(counts,later-1),false);
});

test('saving and automatic return never show; an explicit later browsing transition can show once',async()=>{
 const f=fixture();await f.controller.update(f.context,false);f.advance(120_000);f.save();
 assert.equal(f.shown,0);assert.equal(f.prepared,1);
 await f.move('memories',false);assert.equal(f.shown,0);
 await f.move('calendar');assert.equal(f.shown,0);
 f.advance(30_000);await f.move();assert.equal(f.shown,1);
 for(let i=0;i<3;i++)f.save();f.advance(DAY);await f.move('calendar');assert.equal(f.shown,1);
 f.close();
});

test('no-fill never queues a surprise ad when the load finishes later',async()=>{
 const f=fixture({ready:false});await f.controller.update(f.context,false);f.advance(120_000);f.save();f.advance(30_000);
 await f.move();assert.equal(f.shown,0);f.ready(true);await f.move('calendar');assert.equal(f.shown,0);f.close();
});

test('edits, short sessions, stale opportunities, writing and backgrounding do not trigger ads',async()=>{
 for(const reason of ['edit','short','expired','writing','background']){
  const f=fixture();await f.controller.update(f.context,false);
  if(reason!=='short')f.advance(120_000);
  if(reason==='edit')f.controller.afterSave({isNew:false,returnedToRecords:true});else f.save();
  f.advance(reason==='expired'?AD_POLICY.opportunityMs+1:30_000);
  if(reason==='writing')await f.move('write');
  if(reason==='background')f.controller.suspend();
  await f.move();assert.equal(f.shown,0,reason);f.close();
 }
});

test('Plus, archives, absent consent, storage errors, dialogs and focused editors suppress interstitials',async()=>{
 for(const reason of ['premium','archive','consent','storage','dialog','keyboard']){
  const f=fixture({storageFails:reason==='storage'});
  const context={...f.context,archive:reason==='archive'};
  await f.controller.update(context,reason==='premium');f.advance(120_000);f.save();f.advance(30_000);
  if(reason==='consent')f.consent(false);
  if(reason==='dialog'){const dialog=document.createElement('dialog');dialog.setAttribute('open','');document.body.append(dialog);}
  if(reason==='keyboard')document.querySelector('textarea').focus();
  await f.move();assert.equal(f.shown,0,reason);f.close();
 }
});

test('banner entitlement follows free membership, consent, archive and Plus transitions',async()=>{
 const f=fixture();await f.controller.update(f.context,true);assert.equal(f.banners,0);
 await f.controller.update(f.context,false);assert.equal(f.banners,1);
 f.consent(false);await f.controller.consentChanged();assert.equal(f.banners,1);
 f.consent(true);await f.controller.consentChanged();assert.equal(f.banners,2);
 await f.controller.update({...f.context,archive:true},false);assert.equal(f.banners,2);
 await f.controller.update(f.context,true);assert.equal(f.banners,2);assert.ok(f.hidden>=4);f.close();
});

test('purchase during a bridge call prevents the final presentation',async()=>{
 const f=fixture();await f.controller.update(f.context,false);f.advance(120_000);f.save();f.advance(30_000);
 window.diaryNativeAds.showInterstitial=async({canShow})=>{await f.controller.update(f.context,true);assert.equal(canShow(),false);};
 await f.move();assert.equal(f.shown,0);f.close();
});

test('a slow native bridge cannot display an ad after the transition has passed',async()=>{
 const f=fixture();await f.controller.update(f.context,false);f.advance(120_000);f.save();f.advance(30_000);
 window.diaryNativeAds.showInterstitial=async({canShow})=>{f.advance(1001);assert.equal(canShow(),false);};
 await f.move();assert.equal(f.shown,0);f.close();
});
