import {auth,pageURL} from './firebase-config.js';
import {onAuthStateChanged,signOut,sendEmailVerification} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import * as api from './diary-api.js';
import {localDate} from './web-core.js';
const $=id=>document.getElementById(id);
document.querySelector('.back-link').href=pageURL('index.html');
let user=null,coupleId=null,stopUser=null,stopCouple=null,busy=false;
function message(text,error=false){const el=$(error?'errorMessage':'successMessage');el.textContent=text;el.classList.add('show');}
async function run(fn){if(busy||!user)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){message(e.message||'처리하지 못했습니다. 잠시 후 다시 시도해주세요.',true);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function display(couple){
    const connected=!!couple?.user2;
    $('notConnectedSection').style.display=connected?'none':'block';$('connectedSection').style.display=connected?'block':'none';
    if(connected){const id=couple.user1===user.uid?couple.user2:couple.user1;$('partnerEmail').textContent=couple.settings?.[id]?.displayName||'파트너';}
    $('generatedCodeSection').style.display=couple?.inviteCode?'block':'none';
    if(couple?.inviteCode){$('generatedCode').textContent=couple.inviteCode;$('codeExpiry').textContent=`${new Date(couple.inviteExpiresAt).toLocaleString('ko-KR')}까지 유효 · 한 번만 사용 가능`;}
    $('generateCodeBtn').textContent=coupleId?'새 초대 코드 생성':'일기장 만들고 초대 코드 생성';
    $('soloCloseBtn').hidden=!coupleId||connected;
    $('currentSpaceNotice').hidden=!coupleId||connected;
}
async function watchSpace(id){
    stopCouple?.();coupleId=id;
    if(!id){display(null);return;}
    stopCouple=api.watchCouple(id,c=>{if(c?.status==='active')display(c);},e=>message(e.message,true));
}
window.generateCoupleCode=()=>run(async()=>{
    if(!coupleId)coupleId=(await api.call('createSpace',{startDate:localDate()})).coupleId;
    const result=await api.call('invite',{coupleId});$('generatedCode').textContent=result.code;
    message('초대 코드가 생성되었습니다. 파트너는 자신의 계정으로 가입한 뒤 입력해주세요.');await watchSpace(coupleId);
});
window.connectWithCode=()=>run(async()=>{
    const code=$('coupleCodeInput').value.trim().toUpperCase();if(!/^[A-F0-9]{16}$/.test(code))throw Error('16자리 초대 코드를 입력해주세요.');
    const result=await api.call('join',{code});coupleId=result.coupleId;message('파트너와 연결되었습니다.');await watchSpace(coupleId);
});
window.disconnectCouple=()=>{
    if(!confirm('연결을 해제하면 두 사람 모두 현재 공유 일기장에서 나옵니다. 이후에는 각자 보관함에서 자기 일기만 읽을 수 있습니다. 상대방 일기도 보관하려면 먼저 전체 기록을 내보내세요. 계속할까요?'))return;
    return run(async()=>{await api.call('disconnect',{coupleId});location.reload();});
};
window.goToDiary=()=>{if(!coupleId){message('먼저 일기장을 만들거나 파트너의 초대 코드로 연결해주세요.',true);return;}location.href=pageURL('index.html');};
$('connectLogoutBtn').onclick=()=>run(()=>signOut(auth));
$('verifyEmailBtn').onclick=()=>run(async()=>{await sendEmailVerification(user);message('이메일 확인 안내를 보냈습니다. 메일함을 확인해주세요.');});
onAuthStateChanged(auth,async value=>{
    stopUser?.();stopCouple?.();user=value;
    if(!user){location.replace(pageURL('login.html'));return;}
    $('userEmail').textContent=user.email;$('verifyEmailBtn').hidden=user.emailVerified;
    try{
        await api.call('initialize');stopUser=api.watchUser(u=>watchSpace(u.coupleId||null).catch(e=>message(e.message,true)),e=>message(e.message,true));
        const list=$('archiveList');list.replaceChildren();
        for(const item of await api.archives()){
            const link=document.createElement('a');link.textContent=`${new Date(item.closedAt).toLocaleDateString('ko-KR')} 보관함 · 내 일기`;
            const url=new URL(pageURL('index.html'),location.href);url.searchParams.set('archive',item.coupleId);link.href=url.href;list.append(link,document.createElement('br'));
        }
    }catch(e){message('일기장 연결을 준비하지 못했습니다. '+(e.message||''),true);}
});
