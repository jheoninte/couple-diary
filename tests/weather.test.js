import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {weatherIcon,usesFahrenheit,formatTemp,summary,fresh} from '../weather-core.js';
const require=createRequire(import.meta.url);
globalThis.__diaryWeatherTest=true;
// weather.js talks to Firebase and the DOM translator; the logic under test needs neither.
const source=fs.readFileSync(new URL('../weather.js',import.meta.url),'utf8')
 .replace("import { call, getUser } from './diary-api.js';","const call=null,getUser=null;")
 .replace("import { t } from './i18n.js';","const t=s=>s;")
 .replace("from './weather-core.js'",`from '${new URL('../weather-core.js',import.meta.url)}'`)
 .replace("from './web-core.js'",`from '${new URL('../web-core.js',import.meta.url)}'`);
const {createWeather,partnerWeather}=await import('data:text/javascript,'+encodeURIComponent(source));

test('SF Symbol names become one simple emoji',()=>{
 assert.equal(weatherIcon('sun.max'),'☀️');assert.equal(weatherIcon('cloud.sun.rain'),'🌧️');assert.equal(weatherIcon('cloud.sun'),'⛅');
 assert.equal(weatherIcon('cloud.bolt.rain'),'⛈️');assert.equal(weatherIcon('moon.stars'),'🌙');assert.equal(weatherIcon('cloud.snow'),'🌨️');assert.equal(weatherIcon('???'),'🌡️');
});
test('temperatures follow the device region',()=>{
 assert.equal(usesFahrenheit(['en-US']),true);assert.equal(usesFahrenheit(['ko-KR']),false);assert.equal(usesFahrenheit(['en']),false);
 assert.equal(formatTemp(20,true),'68°');assert.equal(formatTemp(-0.4,false),'-0°'.replace('-0','0'));assert.equal(formatTemp(undefined),'');
});
function memory(){const m=new Map();return {get:k=>m.has(k)?structuredClone(m.get(k)):null,set:(k,v)=>v==null?m.delete(k):m.set(k,structuredClone(v))};}
function plugin(status='prompt'){return {calls:[],async status(){return {status,supported:true};},async current(o){this.calls.push(o);if(o.query==='nowhere')return {status:'notFound'};if(!o.query&&status==='prompt'&&!o.ask)return {status:'prompt'};status='granted';return {status:'granted',symbol:'sun.max',temp:18.4,high:21,low:12,city:o.query||'서울'};}};}
test('location is asked only on tap, then weather is cached and shared',async()=>{
 let time=1e12;const sent=[],p=plugin(),w=createWeather({plugin:p,call:async(a,d)=>sent.push([a,d]),getUser:async()=>({}),storage:memory(),now:()=>time});
 await w.context({uid:'a',coupleId:'c'});
 assert.equal(await w.load(),'prompt');assert.equal(p.calls.length,0);
 assert.equal(await w.load({ask:true}),'granted');assert.deepEqual(sent,[['weather',{coupleId:'c',weather:{icon:'☀️',temp:18,city:'서울',high:21,low:12}}]]);
 await w.load();assert.equal(p.calls.length,1,'fresh cache is reused');
 assert.deepEqual(w.forEntry('2026-11-15','2026-11-15'),{icon:'☀️',temp:18});assert.equal(w.forEntry('2026-11-14','2026-11-15'),undefined);
 time+=4*3600000;assert.equal(w.forEntry('2026-11-15','2026-11-15'),undefined,'stale weather is not stored on a diary');
});
test('a typed city works without location permission; unknown places are reported',async()=>{
 const p=plugin('denied'),w=createWeather({plugin:p,call:async()=>{},getUser:async()=>({shareWeather:false}),storage:memory()});
 await w.context({uid:'a',coupleId:'c'});assert.equal(await w.load(),'denied');
 assert.equal(await w.setPlace('Tokyo'),'granted');assert.equal(w.state.mine.city,'Tokyo');
 assert.equal(await w.setPlace('nowhere'),'notFound');
});
test('sharing off sends nothing but the removal',async()=>{
 const sent=[],w=createWeather({plugin:plugin('granted'),call:async(a,d)=>sent.push(d),getUser:async()=>({shareWeather:false}),storage:memory()});
 await w.context({uid:'a',coupleId:'c'});await w.load();assert.equal(sent.length,0);
 await w.setShare(false);assert.deepEqual(sent,[{coupleId:'c',share:false}]);
});
test('partner weather shows only when fresh, without placeholder names',()=>{
 const now=1e12,c={user1:'a',user2:'b',settings:{b:{displayName:'파트너'}},weather:{b:{icon:'🌧️',temp:12,city:'Osaka',at:now-3600000}}};
 assert.deepEqual(partnerWeather(c,'a',now),{icon:'🌧️',temp:12,city:'Osaka',at:now-3600000,name:''});
 assert.equal(partnerWeather(c,'a',now+7*3600000),null);assert.equal(partnerWeather(c,'b',now),null);
});

const {createService}=require('../functions/service.cjs');
function fixture(){const docs=new Map();const store={async transaction(fn){const staged=new Map(docs);const r=await fn({get:async p=>structuredClone(staged.get(p)),set:(p,v)=>staged.set(p,structuredClone(v)),delete:p=>staged.delete(p)});docs.clear();for(const [k,v] of staged)docs.set(k,v);return r;}};return {docs,run:createService(store,{now:()=>Date.UTC(2026,10,15)}).execute};}
test('server keeps only an icon, temperatures and a city, and honours sharing off',async()=>{
 const f=fixture(),cid=(await f.run('alice',{action:'createSpace',startDate:'2026-01-01'})).coupleId;
 await f.run('alice',{action:'weather',coupleId:cid,weather:{icon:'☀️',temp:18.6,city:' 서울 ',high:21,low:12,lat:37.5}});
 assert.deepEqual(f.docs.get('couples/'+cid).weather.alice,{icon:'☀️',temp:19,city:'서울',high:21,low:12,at:Date.UTC(2026,10,15)});
 await assert.rejects(f.run('alice',{action:'weather',coupleId:cid,weather:{icon:'<b>',temp:1}}),{code:'invalid-argument'});
 await f.run('alice',{action:'weather',coupleId:cid,share:false});assert.deepEqual(f.docs.get('couples/'+cid).weather,{});
 await f.run('alice',{action:'weather',coupleId:cid,weather:{icon:'☀️',temp:1,city:'x'}});assert.deepEqual(f.docs.get('couples/'+cid).weather,{},'ignored while sharing is off');
 await f.run('alice',{action:'weather',coupleId:cid,share:true});await f.run('alice',{action:'weather',coupleId:cid,weather:{icon:'☀️',temp:1,city:'x'}});assert.equal(f.docs.get('couples/'+cid).weather.alice.temp,1);
});
test('a diary keeps the weather of the day it was first written',async()=>{
 const f=fixture(),cid=(await f.run('alice',{action:'createSpace',startDate:'2026-01-01'})).coupleId,base={action:'saveEntry',coupleId:cid,date:'2026-11-15',content:'hi',mood:'😊',photos:[]};
 const {entry}=await f.run('alice',{...base,revision:0,weather:{icon:'🌧️',temp:9.2,city:'서울'}});assert.deepEqual(entry.weather,{icon:'🌧️',temp:9});
 const {entry:edited}=await f.run('alice',{...base,revision:1,weather:{icon:'☀️',temp:20}});assert.deepEqual(edited.weather,{icon:'🌧️',temp:9});
 const {entry:other}=await f.run('alice',{...base,date:'2026-11-14',revision:0,weather:{icon:'nope',temp:1}});assert.equal(other.weather,undefined);
});
test('iOS project: weather plugin, WeatherKit entitlement, weak link and approximate location prompt',()=>{
 const read=p=>fs.readFileSync(p,'utf8');
 assert.match(read('ios/App/App/DiaryViewController.swift'),/registerPluginInstance\(DiaryWeather\(\)\)/);
 assert.match(read('ios/App/App/App.entitlements'),/com\.apple\.developer\.weatherkit/);
 const project=read('ios/App/App.xcodeproj/project.pbxproj');assert.match(project,/DiaryWeather\.swift in Sources/);assert.equal(project.match(/"-weak_framework",\s*WeatherKit/g).length,2);
 const plist=read('ios/App/App/Info.plist');assert.match(plist,/NSLocationWhenInUseUsageDescription/);assert.match(plist,/NSLocationDefaultAccuracyReduced<\/key>\s*<true\/>/);
 for(const l of ['ko','en','ja'])assert.match(read(`ios/App/App/${l}.lproj/InfoPlist.strings`),/NSLocationWhenInUseUsageDescription/);
 assert.match(read('ios/App/App/DiaryWeather.swift'),/kCLLocationAccuracyReduced/);
 const cfg=read('scripts/configure-ios.cjs');assert.match(cfg,/'DiaryWeather\.swift'/);assert.match(cfg,/-weak_framework/);
});
test('summary drops everything but the shareable fields',()=>{assert.deepEqual(summary({symbol:'cloud',temp:3.5,city:'A',lat:1}),{icon:'☁️',temp:4,city:'A'});assert.equal(fresh({at:0},10,5),true);});

test('saving today refreshes stale weather without prompting; past dates get none',async()=>{
 let time=1e12;const p=plugin('granted'),w=createWeather({plugin:p,call:async()=>{},getUser:async()=>({}),storage:memory(),now:()=>time});
 await w.context({uid:'a',coupleId:'c'});await w.load();time+=5*3600000;
 assert.equal(w.forEntry('2026-11-15','2026-11-15'),undefined);
 assert.deepEqual(await w.ensureFor('2026-11-15','2026-11-15'),{icon:'☀️',temp:18});assert.equal(p.calls.length,2);assert.equal(p.calls[1].ask,false);
 assert.equal(await w.ensureFor('2026-11-14','2026-11-15'),undefined);
 const fresh=plugin('prompt'),never=createWeather({plugin:fresh,call:async()=>{},getUser:async()=>({}),storage:memory()});
 assert.equal(await never.ensureFor('2026-11-15','2026-11-15'),undefined);assert.equal(fresh.calls.length,0,'no location prompt while saving');
});
