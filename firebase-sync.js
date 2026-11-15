import {auth, pageURL} from './firebase-config.js';
import {onAuthStateChanged, signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import * as api from './diary-api.js';
import {validDate, localDate, LIMITS} from './web-core.js';
import {t} from './i18n.js';
const ui=window.diaryUI;
document.getElementById('gateLoginLink').href=pageURL('login.html');
let session=null,couple=null,records=new Map(),stops=[],entryStop=null,pageSize=100,generation=0,ready=false,entriesLoaded=false,editorInitialized=false;
const pending=new Set();
// Photos already uploaded for a failed save are reused on retry so a retry does not upload them (and spend quota) again.
const uploadCache=new Map();
const commentRequests=new Map(),anniversaryRequests=new Map();
function fail(e) {
    ui.status(e.code?.endsWith('permission-denied')?'일기장 접근 권한이 변경되었습니다. 커플 설정을 확인해주세요.':(e.message||'처리하지 못했습니다. 잠시 후 다시 시도해주세요.'),'error');return false;
}
async function action(key,buttonId,fn) {
    if(!ready||session?.archive){ui.status('현재 화면에서는 기록을 변경할 수 없습니다.','error');return false;}
    if(pending.has(key))return false;
    if(!navigator.onLine){ui.status('오프라인입니다. 초안은 이 기기에 보관됩니다. 연결 후 다시 저장해주세요.','info');return false;}
    pending.add(key);const button=document.getElementById(buttonId);if(button)button.disabled=true;
    ui.status(navigator.onLine?'저장 중…':'인터넷 연결을 확인해주세요. 초안은 이 기기에 보관됩니다.','saving');
    try{const result=await fn();ui.status(typeof result==='string'?result:'서버에 저장했습니다.','success');return true;}
    catch(e){return fail(e);}finally{pending.delete(key);if(button)button.disabled=false;}
}
async function render() {
    if(!session||!couple||!entriesLoaded)return;
    const current=++generation;
    const scrollY=window.scrollY;
    const data={entries:{},partnerEntries:{},settings:couple.settings,anniversaries:couple.anniversaries,startDate:couple.startDate,partnerUid:couple.user1===session.uid?couple.user2:couple.user1};
    for(const entry of [...records.values()].filter(e=>!e.deletedAt)){
        const photoPaths=[...(entry.photos||[])],photos=photoPaths;
        if(entry.author===session.uid)data.entries[entry.date]={...entry,photoPaths,photos};
        else if(!session.archive&&entry.author===data.partnerUid)data.partnerEntries[entry.date]={...entry,photoPaths,photos};
    }
    if(current!==generation)return;
    ui.render(data);
    // Restore scroll after render for large feeds
    if(scrollY>0)requestAnimationFrame(()=>window.scrollTo(0,scrollY));
    if(!editorInitialized){ui.openEditor(localDate(),false);editorInitialized=true;}
    if(!ready){ready=true;document.getElementById('authGate').hidden=true;if(location.hash==='#settings'){history.replaceState(null,'',location.pathname+location.search);window.openSettings?.();}ui.status(session.archive?'보관함 · 내 일기만 읽을 수 있습니다.':'최신 기록을 불러왔습니다.','success');}
}
function subscribeEntries() {
    entryStop?.();ready=false;
    entryStop=api.watchEntries(session.coupleId,session.archive,snap=>{
        records=new Map(snap.docs.map(d=>[d.id,d.data()]));entriesLoaded=true;
        document.getElementById('recordScope').textContent=t(session.archive?'보관함 · 최근 {n}개 기록을 불러왔습니다. 검색·달력·사진은 불러온 기록을 기준으로 표시합니다.':'최근 {n}개 기록을 불러왔습니다. 검색·달력·사진은 불러온 기록을 기준으로 표시합니다.',{n:snap.size});
        const older=document.getElementById('loadOlderBtn');
        older.hidden=snap.size<pageSize;
        if(snap.size>=300)older.textContent=t('더 이전 기록 불러오기 ({n})',{n:snap.size});
        render().catch(fail);
    },e=>{fail(e);document.getElementById('loadingMessage').textContent='기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';},pageSize);
}
function target(date,type='partner') {
    const uid=type==='my'?session.uid:(couple.user1===session.uid?couple.user2:couple.user1);
    const entry=records.get(`${uid}_${date}`);if(!entry)throw Error('일기를 찾을 수 없습니다.');return entry;
}
window.diaryActions={
    photoURL:api.photoURL,
    async openPhoto(path){try{window.openModal(await api.photoURL(path));}catch(e){ui.status('사진을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.','error');}},
    reloadEditor(){
        const date=ui.editor().date;if(!validDate(date))return;
        window.showConfirmModal('서버의 최신 글 불러오기','현재 초안을 서버의 최신 일기로 바꿀까요? 직전 초안은 이 기기에 복구용으로 남습니다.',()=>{
            ui.persistDraft();
            return action('reloadEditor',null,async()=>{
                const entry=await api.getEntry(session.coupleId,date);
                if(entry)records.set(`${session.uid}_${date}`,entry);else records.delete(`${session.uid}_${date}`);
                await render();ui.replaceEditor(date);return '최신 일기를 불러왔습니다. 필요하면 직전 초안을 복구할 수 있습니다.';
            });
        },'🔄','확인');
    },
    async saveDiary() {
        if(ui.photoBusy){ui.status('사진을 준비하고 있습니다. 완료 후 저장해주세요.','info');return;}
        const editor=ui.editor();ui.persistDraft();
        if(editor.photos.some(photo=>photo.startsWith('data:'))&&window.diaryMonetization&&!window.diaryMonetization.requestPhoto())return;
        if(!validDate(editor.date)||!editor.content||!editor.mood||editor.content.length>LIMITS.content){ui.status('날짜·일기 내용·기분을 확인해주세요. 일기는 20,000자까지 작성할 수 있습니다.','error');return;}
        return action('saveEntry','saveDiaryBtn',async()=>{
            const uploaded=[];let committed=false;
            try{
                const photos=[];
                for(const photo of editor.photos){if(photo.startsWith('data:')){const hit=uploadCache.get(photo);const path=hit&&Date.now()-hit.at<8*60000?hit.path:await api.uploadPhoto(session.coupleId,photo);if(path!==hit?.path)uploadCache.set(photo,{path,at:Date.now()});uploaded.push(path);photos.push(path);}else photos.push(photo);}
                let result;
                try{result=await api.call('saveEntry',{coupleId:session.coupleId,...editor,photos});}
                catch(e){
                    // Only this author writes this entry, so a revision mismatch means an older copy (stale draft or
                    // another device of the same user). Retry once against the server's latest revision.
                    if(!e.code?.endsWith('aborted'))throw e;
                    const latest=await api.getEntry(session.coupleId,editor.date);
                    result=await api.call('saveEntry',{coupleId:session.coupleId,...editor,photos,revision:latest?.revision||0});
                }
                committed=true;for(const photo of editor.photos)uploadCache.delete(photo);
                records.set(`${session.uid}_${editor.date}`,result.entry);
                const unchanged=JSON.stringify(ui.editor())===JSON.stringify(editor);
                if(unchanged)ui.clearDraft(editor.date);else{ui.updateRevision(editor.date,result.entry.revision,editor.revision);ui.persistDraft();}
                await render();if(unchanged)ui.saved(editor.date);
                window.dispatchEvent(new CustomEvent('diary:saved'));
                if(!unchanged)return '저장했습니다. 저장 중 추가로 작성한 내용은 초안으로 보관했습니다.';
            }catch(e){
                const definite=['invalid-argument','permission-denied','aborted','failed-precondition'];
                if(!committed&&e.code?.endsWith('permission-denied'))for(const photo of editor.photos)uploadCache.delete(photo);
                if(!committed&&definite.some(c=>e.code?.endsWith(c)))await Promise.allSettled(uploaded.map(api.discardUpload));
                throw e;
            }
        });
    },
    deleteEntry(date){const entry=target(date,'my');window.showConfirmModal('일기를 삭제할까요?','삭제한 일기는 다시 볼 수 없습니다.',()=>action(`delete-${date}`,null,()=>api.call('deleteEntry',{coupleId:session.coupleId,date,revision:entry.revision})),'🗑️');},
    saveSettings(){return action('settings','saveSettingsBtn',async()=>{
        const state=ui.state(),settings={icon:state.myIcon,theme:state.currentTheme,appTitle:document.getElementById('appTitleInput').value.trim()||'우리의 공간',displayName:document.getElementById('displayNameInput').value.trim()||'나'};
        await api.call('settings',{coupleId:session.coupleId,settings,startDate:document.getElementById('startDateInput').value});
    });},
    saveAnniversary(){return action('anniversary','saveAnniversaryBtn',async()=>{
        const data={coupleId:session.coupleId,name:document.getElementById('anniversaryName').value.trim(),date:document.getElementById('anniversaryDate').value,icon:ui.state().selectedAnniversaryIcon,recurring:document.getElementById('anniversaryRecurring').checked},key=JSON.stringify(data);
        if(!anniversaryRequests.has(key))anniversaryRequests.set(key,crypto.randomUUID());
        await api.call('anniversaryAdd',{...data,id:anniversaryRequests.get(key)});anniversaryRequests.delete(key);ui.cancelAnniversaryForm();
    });},
    deleteAnniversary(index){const a=ui.state().anniversaries[index];if(a)window.showConfirmModal('기념일을 삭제할까요?',a.name,()=>action('anniversary',null,()=>api.call('anniversaryDelete',{coupleId:session.coupleId,id:a.id})),'🎉');},
    addComment(date,type='partner'){
        const input=document.getElementById(`comment-input-${type}-${date}`);if(!input)return;
        const value=input.value.trim(),key=JSON.stringify([session.coupleId,date,type,value]);
        if(!commentRequests.has(key))commentRequests.set(key,crypto.randomUUID());const id=commentRequests.get(key);
        return action(`comment-${date}`,null,async()=>{await api.call('commentAdd',{coupleId:session.coupleId,author:target(date,type).author,date,id,text:value});commentRequests.delete(key);const current=document.getElementById(`comment-input-${type}-${date}`);if(current?.value.trim()===value)current.value='';if(input.value.trim()===value)input.value='';});
    },
    saveCommentEdit(date,index,type='partner'){
        const entry=target(date,type),comment=entry.comments.find(c=>c.id===index),input=document.getElementById(`edit-input-${type}-${date}-${index}`);if(!comment||!input)return;
        return action(`comment-${comment.id}`,null,async()=>{const value=input.value.trim();await api.call('commentEdit',{coupleId:session.coupleId,author:entry.author,date,id:comment.id,text:value});const current=document.getElementById(`edit-input-${type}-${date}-${index}`);if(current?.value.trim()===value)ui.displayDateEntries(date,true);});
    },
    deleteComment(date,index,type='partner'){
        const entry=target(date,type),comment=entry.comments.find(c=>c.id===index);if(comment)window.showConfirmModal('댓글을 삭제할까요?','삭제한 댓글은 복원할 수 없습니다.',()=>action(`comment-${comment.id}`,null,()=>api.call('commentDelete',{coupleId:session.coupleId,author:entry.author,date,id:comment.id})),'💬');
    },
    toggleLike(date,type='partner'){const e=target(date,type);return action(`like-${e.author}-${date}`,null,()=>api.call('like',{coupleId:session.coupleId,author:e.author,date,liked:!(e.likedBy||[]).includes(session.uid)}));}
};
document.getElementById('loadOlderBtn').onclick=()=>{const y=window.scrollY;pageSize+=100;subscribeEntries();setTimeout(()=>window.scrollTo(0,y),50);};
document.getElementById('logoutBtn').onclick=async()=>{ui.persistDraft();try{await signOut(auth);}catch(e){fail(e);}};
window.addEventListener('offline',()=>ui.status('오프라인입니다. 작성 중인 초안은 이 기기에 보관됩니다.','info'));
window.addEventListener('online',()=>ui.status('인터넷에 다시 연결되었습니다. 저장 버튼으로 초안을 저장해주세요.','info'));

async function waitForAuthReady() {
    if(auth.authStateReady) await auth.authStateReady();
    if(window.Capacitor?.isNativePlatform?.()) await new Promise(r => setTimeout(r, 120));
    return auth.currentUser;
}

onAuthStateChanged(auth, async user => {
    window.dispatchEvent(new CustomEvent('diary:context',{detail:null}));
    stops.forEach(stop=>stop());stops=[];entryStop?.();generation++;ready=false;entriesLoaded=false;editorInitialized=false;records.clear();document.getElementById('authGate').hidden=false;await api.clearPhotos();

    const readyUser = await waitForAuthReady();
    if(!readyUser){location.replace(pageURL('login.html'));return;}

    let attempt = 0;
    const maxAttempts = 2;
    while(attempt < maxAttempts) {
        try {
            const archiveId = new URLSearchParams(location.search).get('archive');
            const initial = archiveId ? {coupleId: archiveId} : await api.call('initialize');
            if(!initial.coupleId){location.replace(pageURL('couple-connect.html'));return;}
            session={uid:readyUser.uid,coupleId:initial.coupleId,archive:!!archiveId};ui.session(session);couple=await api.getCouple(session.coupleId);
            window.dispatchEvent(new CustomEvent('diary:context',{detail:{...session}}));
            document.getElementById('coupleConnectionLink').href=pageURL('couple-connect.html');
            const deletionLink=document.getElementById('accountDeletionLink');if(deletionLink)deletionLink.href=pageURL('account-delete.html');
            const licensesLink=document.getElementById('licensesLink');if(licensesLink)licensesLink.href=pageURL('licenses.html');
            if(!couple)throw Error('일기장을 찾을 수 없습니다.');
            if(session.archive){document.querySelector('.intro-write')?.setAttribute('hidden','');document.querySelectorAll('.tab-btn')[1].hidden=true;document.querySelector('.nav-settings').hidden=true;}
            stops.push(api.watchCouple(session.coupleId,value=>{
                if(!value||(!session.archive&&value.status!=='active')){ui.persistDraft();location.replace(pageURL('couple-connect.html'));return;}
                couple=value;render().catch(fail);window.dispatchEvent(new CustomEvent('diary:context',{detail:{...session}}));
            },fail));
            if(!session.archive)stops.push(api.watchUser(value=>{if(value.coupleId!==session.coupleId){ui.persistDraft();location.replace(pageURL('couple-connect.html'));}},fail));
            subscribeEntries();
            return;
        } catch(e) {
            attempt++;
            if(attempt >= maxAttempts) {
                fail(e);
                document.getElementById('startupRecovery').hidden=false;
                document.getElementById('loadingMessage').textContent='기록을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.';
                return;
            }
            await new Promise(r => setTimeout(r, 400));
        }
    }
});
