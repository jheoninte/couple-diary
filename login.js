import {withTimeout} from './request-timeout.js';
import {auth,pageURL} from './firebase-config.js';
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,sendEmailVerification} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
const $=id=>document.getElementById(id);
document.querySelector('.auth-brand').href=pageURL('login.html');
let mode='login',busy=false,resetUntil=0;
function message(text,kind='error'){const el=$('errorMessage');el.textContent=text;el.dataset.kind=kind;el.setAttribute('role',kind==='error'?'alert':'status');el.classList.add('show');}
function clear(){$('errorMessage').classList.remove('show');}
function tab(next){
 if(busy)return;
 const from=$(mode==='signup'?'signupEmail':mode==='reset'?'resetEmail':'loginEmail'),to=$(next==='signup'?'signupEmail':next==='reset'?'resetEmail':'loginEmail');
 if(from.value.trim())to.value=from.value.trim();mode=next;
 for(const name of ['login','signup','reset'])$(name+'Form').style.display=name===mode?'block':'none';
 document.querySelectorAll('.tab').forEach((button,i)=>{const selected=mode===(i===0?'login':'signup');button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
 clear();
}
window.showLogin=()=>tab('login');window.showSignup=()=>tab('signup');
if(new URLSearchParams(location.search).get('signup')==='1')tab('signup');
function error(e){const code=e.code?.split('/').at(-1);message(({
 'invalid-credential':'이메일 또는 비밀번호가 맞지 않아요. 비밀번호가 기억나지 않으면 아래에서 재설정해주세요.',
 'wrong-password':'이메일 또는 비밀번호를 확인해주세요. 비밀번호를 다시 설정할 수도 있어요.',
 'user-not-found':'이메일 또는 비밀번호를 확인해주세요. 처음이라면 회원가입을 선택해주세요.',
 'invalid-email':'이메일 주소 형식을 확인해주세요.',
 'too-many-requests':'요청이 많아 잠시 쉬고 있어요. 잠시 후 다시 시도해주세요.',
 'network-request-failed':'로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요. 입력한 이메일은 그대로 남아 있어요.',
 'weak-password':'비밀번호를 8자 이상으로 더 안전하게 만들어주세요.',
 'user-disabled':'이 계정은 사용할 수 없어요. 도움이 필요하면 cs@comino.app으로 문의해주세요.',
 'request-timeout':'연결이 지연되고 있어요. 인터넷 연결을 확인해주세요. 가입을 요청했다면 로그인도 확인해주세요.'
})[code]||'처리하지 못했어요. 입력 내용을 확인하고 잠시 후 다시 시도해주세요.');}
async function run(button,label,fn){if(busy)return;busy=true;button.disabled=true;button.textContent=label;document.querySelectorAll('.tab').forEach(b=>b.disabled=true);clear();try{await fn();}catch(e){error(e);}finally{busy=false;document.querySelectorAll('.tab').forEach(b=>b.disabled=false);button.disabled=false;button.textContent=button.id==='loginBtn'?'로그인':button.id==='signupBtn'?'회원가입':'재설정 이메일 보내기';updateReset();}}
$('loginForm').addEventListener('submit',e=>{e.preventDefault();run($('loginBtn'),'로그인 중…',async()=>{await withTimeout(signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value));location.href=pageURL('index.html');});});
$('signupForm').addEventListener('submit',e=>{
 e.preventDefault();if(busy)return;clear();
 if($('signupPassword').value!==$('signupPasswordConfirm').value){message('비밀번호가 서로 달라요. 다시 확인해주세요.');$('signupPasswordConfirm').focus();return;}
 if($('signupPassword').value.length<8){message('비밀번호를 8자 이상 입력해주세요.');$('signupPassword').focus();return;}
 run($('signupBtn'),'가입 중…',async()=>{
  try{const credential=await withTimeout(createUserWithEmailAndPassword(auth,$('signupEmail').value.trim(),$('signupPassword').value));sendEmailVerification(credential.user).catch(()=>{});location.href=pageURL('couple-connect.html');}
  catch(e){if(e.code!=='auth/email-already-in-use')throw e;
   $('loginEmail').value=$('signupEmail').value.trim();$('signupPassword').value='';$('signupPasswordConfirm').value='';busy=false;tab('login');busy=true;
   message('이미 가입된 이메일이에요. 비밀번호를 입력해 로그인하거나 비밀번호를 재설정해주세요.','info');$('loginPassword').focus();
  }
 });
});
$('resetPasswordBtn').onclick=()=>tab('reset');$('backToLoginBtn').onclick=()=>tab('login');
function updateReset(){const seconds=Math.ceil((resetUntil-Date.now())/1000),button=$('resetSendBtn');if(seconds>0){button.disabled=true;button.textContent=`${seconds}초 후 다시 보내기`;}else if(!busy){button.disabled=false;button.textContent='재설정 이메일 보내기';}}
$('resetForm').addEventListener('submit',e=>{e.preventDefault();if(busy||Date.now()<resetUntil)return;if(!$('resetEmail').reportValidity())return;
 run($('resetSendBtn'),'이메일 보내는 중…',async()=>{try{await withTimeout(sendPasswordResetEmail(auth,$('resetEmail').value.trim()));}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 resetUntil=Date.now()+60000;$('resetHint').hidden=false;message('가입된 이메일이라면 재설정 링크를 보냈어요. 메일함과 스팸함을 확인해주세요.','success');
 });
});
window.setInterval(updateReset,1000);
document.querySelectorAll('[data-passwords]').forEach(button=>button.onclick=()=>{const show=button.getAttribute('aria-pressed')!=='true';for(const id of button.dataset.passwords.split(' '))$(id).type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.textContent=show?'비밀번호 숨기기':'비밀번호 보기';});
// Restore an existing session without making the user type their password again.
auth.authStateReady?.().then(()=>{if(auth.currentUser&&!busy)location.replace(pageURL('index.html'));}).catch(()=>{});
