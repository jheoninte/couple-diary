import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createNativeLoader,evictions,webCached,thumbOf,CACHE_LIMIT_BYTES} from '../photo-cache.js';
const require=createRequire(import.meta.url);
const MB=1024*1024;

function disk(initial={}){const files={...initial};return {files,lookups:0,fetched:[],saved:[],
 async lookup({paths}){this.lookups++;return {files:Object.fromEntries(paths.filter(p=>files[p]).map(p=>[p,files[p]]))};},
 async fetch({items}){this.fetched.push(...items.map(i=>i.path));const out={};for(const i of items)if(!i.url.includes('broken')){files[i.path]='/c/'+i.path;out[i.path]=files[i.path];}return {files:out};},
 async save({path}){this.saved.push(path);files[path]='/c/'+path;return {file:files[path]};}};}
test('a screen of photos costs one lookup and one server call; cached photos cost none',async()=>{
 const d=disk({'a.jpg':'/c/a.jpg'}),calls=[];
 const load=createNativeLoader({disk:d,call:async(a,x)=>{calls.push([a,x]);return {urls:Object.fromEntries(x.paths.map(p=>[p,'https://signed/'+p]))};},toSrc:f=>'capacitor://localhost/_capacitor_file_'+f,delay:1});
 const urls=await Promise.all(['a.jpg','b.jpg','c.jpg','b.jpg'].map(load));
 assert.deepEqual(urls,['a.jpg','b.jpg','c.jpg','b.jpg'].map(p=>'capacitor://localhost/_capacitor_file_/c/'+p));
 assert.equal(d.lookups,1);assert.deepEqual(calls,[['photoUrls',{paths:['b.jpg','c.jpg']}]]);
 calls.length=0;await Promise.all(['b.jpg','c.jpg'].map(load));assert.equal(calls.length,0);
});
test('without signed URLs the old proxy still works and its result is cached on disk',async()=>{
 const d=disk(),calls=[];
 const load=createNativeLoader({disk:d,call:async(a,x)=>{calls.push(a);if(a==='photoUrls')throw Object.assign(Error('no iam'),{code:'unavailable'});if(x.path==='gone.jpg')throw Object.assign(Error('denied'),{code:'permission-denied'});return {dataUrl:'data:image/jpeg;base64,AAAA'};},toSrc:f=>'file:'+f,delay:1});
 assert.equal(await load('x.jpg'),'file:/c/x.jpg');assert.deepEqual(d.saved,['x.jpg']);
 await assert.rejects(load('gone.jpg'),{code:'permission-denied'});
 assert.deepEqual(calls,['photoUrls','readPhoto','photoUrls','readPhoto']);
});
test('a failed direct download falls back to the proxy for that photo only',async()=>{
 const d=disk(),calls=[];
 const load=createNativeLoader({disk:d,call:async(a,x)=>{calls.push(a);return a==='photoUrls'?{urls:{'ok.jpg':'https://s/ok','bad.jpg':'https://s/broken'}}:{dataUrl:'data:image/jpeg;base64,AAAA'};},toSrc:f=>f,delay:1});
 await Promise.all([load('ok.jpg'),load('bad.jpg')]);assert.deepEqual(calls,['photoUrls','readPhoto']);
});
test('least recently used photos go first once the cache passes 1,500 MB',()=>{
 assert.equal(CACHE_LIMIT_BYTES,1500*MB);
 assert.deepEqual(evictions({a:[700*MB,3],b:[700*MB,1],c:[200*MB,2]}),['b']);
 assert.deepEqual(evictions({a:[10,1]}),[]);
 assert.equal(thumbOf('couples/c/u/abc-1.jpg'),'couples/c/u/abc-1.t.jpg');
});
test('browser cache serves repeat views without downloading',async()=>{
 const store=new Map(),cache={async match(k){return store.has(k)?new Response(store.get(k)):undefined;},async put(k,r){store.set(k,await r.blob());},async delete(k){store.delete(k);}};
 globalThis.caches={open:async()=>cache};const ls=new Map(),storage={getItem:k=>ls.get(k)??null,setItem:(k,v)=>ls.set(k,v)};
 let downloads=0;const download=async()=>{downloads++;return new Blob(['jpg'],{type:'image/jpeg'});};
 await webCached('p.jpg',download,{storage});const again=await webCached('p.jpg',download,{storage});
 assert.equal(downloads,1);assert.equal(await again.text(),'jpg');assert.ok(JSON.parse(ls.get('diary.photoCache.index.v1'))['p.jpg']);
 delete globalThis.caches;
});

const {createService}=require('../functions/service.cjs');
function fixture(){const docs=new Map();const store={signed:[],async transaction(fn){const staged=new Map(docs);const r=await fn({get:async p=>structuredClone(staged.get(p)),set:(p,v)=>staged.set(p,structuredClone(v)),delete:p=>staged.delete(p)});docs.clear();for(const [k,v] of staged)docs.set(k,v);return r;},
 saved:[],async savePhoto(p){this.saved.push(p);},async photoExists(){return true;},async signPhotos(paths){this.signed.push(paths);return {urls:Object.fromEntries(paths.map(p=>[p,'https://signed/'+p])),expiresAt:1};}};
 return {docs,store,run:createService(store,{now:()=>Date.UTC(2026,10,15)}).execute};}
const JPEG='data:image/jpeg;base64,'+Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3]).toString('base64');
test('server signs only photos the person may see, and records thumbnails on the entry',async()=>{
 const f=fixture(),cid=(await f.run('alice',{action:'createSpace',startDate:'2026-01-01'})).coupleId;f.docs.get('couples/'+cid).premiumUntil=Date.UTC(2027,0,1);
 const {path,thumb}=await f.run('alice',{action:'uploadPhoto',coupleId:cid,dataUrl:JPEG,thumbUrl:JPEG});
 assert.equal(thumb,true);assert.deepEqual(f.store.saved,[path,path.replace('.jpg','.t.jpg')]);
 const {path:plain}=await f.run('alice',{action:'uploadPhoto',coupleId:cid,dataUrl:JPEG});
 const {entry}=await f.run('alice',{action:'saveEntry',coupleId:cid,date:'2026-11-15',content:'p',mood:'😊',photos:[path,plain],revision:0});
 assert.deepEqual(entry.thumbs,[path]);
 const {entry:edited}=await f.run('alice',{action:'saveEntry',coupleId:cid,date:'2026-11-15',content:'p',mood:'😊',photos:[plain],revision:1});assert.deepEqual(edited.thumbs,[]);
 const other='couples/someone-else/bob/0000-1111.jpg';
 const {urls}=await f.run('alice',{action:'photoUrls',paths:[path,path.replace('.jpg','.t.jpg'),other,'../x']});
 assert.deepEqual(Object.keys(urls),[path,path.replace('.jpg','.t.jpg')]);
 await assert.rejects(f.run('eve',{action:'photoUrls',paths:[path]}).then(r=>{if(Object.keys(r.urls).length)throw Error('leak');throw Object.assign(Error(),{code:'ok'});}),{code:'ok'});
 await assert.rejects(f.run('alice',{action:'photoUrls',paths:Array(61).fill(path)}),{code:'invalid-argument'});
 await assert.rejects(f.run('alice',{action:'readPhoto',path:other}),{code:'permission-denied'});
});
test('iOS project registers the disk cache plugin',()=>{
 const read=p=>fs.readFileSync(p,'utf8');
 assert.match(read('ios/App/App/DiaryViewController.swift'),/registerPluginInstance\(DiaryPhotoCache\(\)\)/);
 assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/DiaryPhotoCache\.swift in Sources/);
 assert.match(read('scripts/configure-ios.cjs'),/'DiaryPhotoCache\.swift'/);
 const swift=read('ios/App/App/DiaryPhotoCache.swift');assert.match(swift,/1500 \* 1024 \* 1024/);assert.match(swift,/cachesDirectory/);
});
