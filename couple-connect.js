import {auth,pageURL} from './firebase-config.js';
import {onAuthStateChanged,signOut,sendEmailVerification,reload} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import * as api from './diary-api.js';
import {localDate} from './web-core.js';
import {normalizeInviteCode,formatInviteCode} from './invite-code.js';
import {withTimeout} from './request-timeout.js';
import {t,fmt} from './i18n.js';
const $=id=>document.getElementById(id);
document.querySelector('.back-link').href=pageURL('index.html')+'#settings';
let user=null,coupleId=null,currentCouple=null,stopUser=null,stopCouple=null,busy=false,ready=false,mode=null,revision=0,spaceRevision=0,verifyUntil=0;
function clear(){for(const id of ['errorMessage','successMessage'])$(id).classList.remove('show');}
function message(text,error=false){clear();const el=$(error?'errorMessage':'successMessage');el.textContent=text;el.classList.add('show');clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>el.classList.remove('show'),2500);}
function controls(){const valid=!!currentCouple?.inviteCode&&currentCouple.inviteExpiresAt>Date.now();for(const id of ['copyInviteBtn','shareInviteBtn'])$(id).disabled=busy||!valid;$('connectBtn').disabled=busy||!!coupleId;$('verifyEmailBtn').disabled=busy||Date.now()<verifyUntil;$('verifyEmailBtn').textContent=Date.now()<verifyUntil?'확인 메일을 보냈어요':'이메일 확인 메일 보내기';}
async function run(fn){if(busy||!user||!ready)return;busy=true;clear();document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){const code=e.code?.split('/').at(-1);message(code==='not-found'?'만료되었거나 이미 사용한 코드예요. 연인에게 새 초대 코드를 받아주세요.':code==='resource-exhausted'||code==='too-many-requests'?'요청이 많아요. 잠시 후 다시 시도해주세요.':code==='network-request-failed'||code==='unavailable'||code==='request-timeout'?'인터넷 연결을 확인하고 다시 시도해주세요.':e.message||'처리하지 못했어요. 잠시 후 다시 시도해주세요.',true);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);controls();}}
function choose(next){mode=next;clear();display(currentCouple);}
function display(couple){
 const wasConnected=!!currentCouple?.user2;const wasReady=ready;currentCouple=couple;const connected=!!couple?.user2,valid=!!couple?.inviteCode&&couple.inviteExpiresAt>Date.now();if(!mode&&coupleId)mode='invite';
 $('notConnectedSection').hidden=connected;$('connectedSection').hidden=!connected;$('connectedSection').style.display=connected?'block':'none';$('connectLoading').hidden=true;$('connectRetry').hidden=true;ready=true;if(wasReady&&connected&&!wasConnected)message('연결됐어요! 이제 같은 일기장에서 서로의 기록을 볼 수 있어요.');
 $('invitePanel').hidden=mode!=='invite';$('joinPanel').hidden=mode!=='join';$('chooseHint').hidden=!!mode;
 $('chooseInvite').setAttribute('aria-pressed',String(mode==='invite'));$('chooseJoin').setAttribute('aria-pressed',String(mode==='join'));
 if(connected){const id=couple.user1===user.uid?couple.user2:couple.user1;$('partnerEmail').textContent=couple.settings?.[id]?.displayName||t('파트너');}
 $('generatedCodeSection').style.display=valid&&mode==='invite'&&!connected?'block':'none';
 if(valid){$('generatedCode').textContent=formatInviteCode(couple.inviteCode);$('codeExpiry').textContent=t('{date}까지 · 한 사람만 사용 가능',{date:fmt.date(couple.inviteExpiresAt,{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})});}
 $('generateCodeBtn').textContent=coupleId?'새 초대 코드 만들기':'일기장 만들고 초대하기';
 $('soloCloseBtn').hidden=!coupleId||connected||mode!=='join';$('currentSpaceNotice').hidden=$('soloCloseBtn').hidden;$('soloDiaryBtn').hidden=!coupleId||connected;
 document.querySelector('.header-title').textContent=connected?'이제, 함께 기록해요':coupleId?'연인의 연결을 기다리고 있어요':'둘만의 일기장, 함께 시작해요';
 document.querySelector('.header-subtitle').textContent=connected?'연결이 완료됐어요. 같은 일기장에서 서로의 하루를 나눠요.':coupleId?'코드를 보내고 먼저 일기를 써도 좋아요.\n상대방이 연결하면 이 화면도 자동으로 바뀌어요.':'한 사람은 초대하고, 한 사람은 코드를 입력하면 돼요.\n각자의 계정으로 같은 일기장을 나눠요.';controls();
}
async function watchSpace(id){stopCouple?.();const version=++spaceRevision;coupleId=id;if(!id){display(null);return;}stopCouple=api.watchCouple(id,c=>{if(version===spaceRevision&&c?.status==='active')display(c);},()=>{message('일기장 연결을 확인하지 못했어요. 다시 확인해주세요.',true);$('connectRetry').hidden=false;});}
$('chooseInvite').onclick=()=>choose('invite');$('chooseJoin').onclick=()=>choose('join');$('connectRetry').onclick=()=>location.reload();
window.generateCoupleCode=()=>run(async()=>{if(!coupleId)coupleId=(await api.call('createSpace',{startDate:localDate()})).coupleId;await api.call('invite',{coupleId});mode='invite';message('초대 준비가 됐어요. 아래 코드를 복사해서 연인에게 보내주세요.');await watchSpace(coupleId);});
window.connectWithCode=()=>run(async()=>{const code=normalizeInviteCode($('coupleCodeInput').value);const result=await api.call('join',{code});coupleId=result.coupleId;message('연결됐어요! 이제 같은 일기장에서 서로의 기록을 볼 수 있어요.');await watchSpace(coupleId);});
$('coupleCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();window.connectWithCode();}});
async function copyInvite(){const code=formatInviteCode(currentCouple.inviteCode);try{await navigator.clipboard.writeText(code);message('코드를 복사했어요. 연인에게 붙여넣어 보내주세요.');}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents($('generatedCode'));selection.removeAllRanges();selection.addRange(range);message('코드를 선택했어요. 길게 누르거나 복사 단축키로 복사해주세요.');}}
$('copyInviteBtn').onclick=()=>run(copyInvite);
$('shareInviteBtn').onclick=()=>run(async()=>{if(!navigator.share){await copyInvite();return;}try{await navigator.share({title:t('우리의 공간 초대'),text:[t('우리의 공간에서 함께 일기 써요.'),t('초대 코드: {code}',{code:formatInviteCode(currentCouple.inviteCode)}),t('앱에서 각자의 계정으로 가입한 뒤 ‘초대 코드를 받았어요’를 선택해 코드를 입력해주세요. 코드는 24시간 동안 한 사람만 사용할 수 있어요.')].join('\n')});}catch(e){if(e.name!=='AbortError')await copyInvite();}});
window.disconnectCouple=()=>{if(!confirm('현재 공유 일기장을 보관할까요? 두 사람의 연결이 해제되고, 각자의 보관함에는 자신이 작성한 일기만 남아요. 상대방 일기도 보관하려면 먼저 전체 기록을 내보내주세요.'))return;return run(async()=>{await api.call('disconnect',{coupleId});location.reload();});};
window.goToDiary=()=>{if(!coupleId){message('일기장을 만들거나 받은 초대 코드로 연결해주세요.',true);return;}location.href=pageURL('index.html');};
$('connectLogoutBtn').onclick=()=>run(()=>signOut(auth));
$('verifyEmailBtn').onclick=()=>run(async()=>{await withTimeout(sendEmailVerification(user));verifyUntil=Date.now()+60000;message('이메일 확인 안내를 보냈어요. 스팸함도 확인해주세요. 확인 전에도 일기장을 시작할 수 있어요.');});
$('checkEmailBtn').onclick=()=>run(async()=>{await withTimeout(reload(user));if(user.emailVerified){$('verifyEmailBtn').hidden=true;$('checkEmailBtn').hidden=true;message('이메일 확인이 완료됐어요.');}else message('아직 확인되지 않았어요. 메일의 확인 링크를 누른 뒤 다시 확인해주세요.');});
window.setInterval(()=>{controls();if(currentCouple?.inviteCode&&currentCouple.inviteExpiresAt<=Date.now()){$('codeExpiry').textContent='초대 코드가 만료됐어요. 새 코드를 만들어주세요.';}},1000);
onAuthStateChanged(auth,async value=>{
 const version=++revision;stopUser?.();stopCouple?.();user=value;ready=false;currentCouple=null;coupleId=null;
 if(!user){location.replace(pageURL('login.html'));return;}
 $('userEmail').textContent=user.email;$('verifyEmailBtn').hidden=user.emailVerified;$('checkEmailBtn').hidden=user.emailVerified;
 try{await api.call('initialize');if(version!==revision)return;stopUser=api.watchUser(u=>{if(version===revision)watchSpace(u.coupleId||null);},()=>{message('내 일기장을 확인하지 못했어요. 다시 확인해주세요.',true);$('connectRetry').hidden=false;});
 const archives=await api.archives();if(version!==revision)return;const list=$('archiveList');list.replaceChildren();document.querySelector('.archive-section').hidden=!archives.length;
 for(const item of archives){const link=document.createElement('a');link.textContent=t('{date} 보관함 · 내 일기',{date:fmt.date(item.closedAt)});const url=new URL(pageURL('index.html'),location.href);url.searchParams.set('archive',item.coupleId);link.href=url.href;list.append(link,document.createElement('br'));}
 }catch{if(version===revision){message('일기장을 준비하지 못했어요. 인터넷 연결을 확인해주세요.',true);$('connectLoading').hidden=true;$('connectRetry').hidden=false;}}
});
