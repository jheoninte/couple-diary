import { auth, db, storage, functions, pageURL } from './firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import { doc, getDoc, getDocFromServer, collection, query, orderBy, limit, startAfter, where, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { ref, getBlob } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';
export const call=async(action,data={})=>{
    try{return (await httpsCallable(functions,'diary',{timeout:['initialize','disconnect'].includes(action)?540000:20000})({action,...data})).data;}
    catch(error){throw error;}
};
export const getUser=async()=> (await getDoc(doc(db,'users',auth.currentUser.uid))).data()||{};
export const getCouple=async id=>(await getDoc(doc(db,'couples',id))).data();
export const getEntry=async(cid,date)=>(await getDocFromServer(doc(db,'couples',cid,'entries',`${auth.currentUser.uid}_${date}`))).data();
export const watchCouple=(id,cb,error)=>onSnapshot(doc(db,'couples',id),snap=>cb(snap.data()),error);
export const watchUser=(cb,error)=>onSnapshot(doc(db,'users',auth.currentUser.uid),s=>cb(s.data()||{}),error);
export async function archives() {return (await getDocs(collection(db,'users',auth.currentUser.uid,'archives'))).docs.map(d=>d.data());}
export function entryQuery(cid,archive=false,cursor=null,pageSize=100) {
    const filters=archive?[where('author','==',auth.currentUser.uid)]:[];
    return query(collection(db,'couples',cid,'entries'),...filters,orderBy('date','desc'),...(cursor?[startAfter(cursor)]:[]),limit(pageSize));
}
export const watchEntries=(cid,archive,cb,error,count=100)=>onSnapshot(entryQuery(cid,archive,null,count),s=>cb(s),error);
export const olderEntries=(cid,archive,cursor)=>getDocs(entryQuery(cid,archive,cursor));
export async function allEntries(cid,archive=false) {
    const rows=[];let cursor=null;
    do {const s=await getDocs(entryQuery(cid,archive,cursor,200));rows.push(...s.docs.map(d=>d.data()));if(s.size<200)break;cursor=s.docs.at(-1);}while(cursor);
    return rows;
}
const photoCache=new Map();
let cachedBytes=0;
export async function photoURL(path) {
    if(photoCache.has(path))return photoCache.get(path).promise;
    const item={size:0,url:null,isBlob:false,promise:null};
    const pending=(async()=>{
        let url,size=0,isBlob=false;
        try {
            const blob=await getBlob(ref(storage,path),(path.startsWith('photos/')?20:2)*1024*1024);
            size=blob.size;url=URL.createObjectURL(blob);isBlob=true;
        } catch (e) {
            if (e?.code?.endsWith('object-not-found')) throw e;
            const { dataUrl } = await call('readPhoto', { path });
            url = dataUrl;
            size = dataUrl.length;
        }
        item.size=size;item.url=url;item.isBlob=isBlob;cachedBytes+=item.size;
        for(const [key,old]of photoCache){if(cachedBytes<=64*1024*1024)break;if(key!==path&&old.url){if(old.isBlob)URL.revokeObjectURL(old.url);cachedBytes-=old.size;photoCache.delete(key);}}
        return item.url;
    })();
    item.promise=pending;photoCache.set(path,item);
    try {return await pending;} catch(e){photoCache.delete(path);throw e;}
}
export async function clearPhotos() {
    for(const item of photoCache.values())try{const url=await item.promise;if(item.isBlob)URL.revokeObjectURL(url);}catch{}
    photoCache.clear();cachedBytes=0;
}
export async function uploadPhoto(cid,dataURL) {
    const response=await fetch(dataURL),blob=await response.blob();
    if(blob.size>512*1024||!/^image\/(jpeg|png|webp)$/.test(blob.type))throw Error('사진을 다시 선택해 자동 압축한 뒤 저장해주세요.');
    const { path } = await call('uploadPhoto', { coupleId: cid, dataUrl: dataURL });
    return path;
}
export const discardUpload=()=>Promise.resolve();
