import {auth,pageURL} from './firebase-config.js';
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,sendEmailVerification} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
const $=id=>document.getElementById(id);
document.querySelector('.auth-brand').href=pageURL('login.html');
function message(text){$('errorMessage').textContent=text;$('errorMessage').classList.add('show');}
function clear(){ $('errorMessage').classList.remove('show'); }
function tab(signup){$('loginForm').style.display=signup?'none':'block';$('signupForm').style.display=signup?'block':'none';document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('active',i===(signup?1:0)));clear();}
window.showLogin=()=>tab(false);window.showSignup=()=>tab(true);
function error(e){
    const code=e.code?.split('/').at(-1);
    message(({ 'invalid-credential':'이메일과 비밀번호를 확인해주세요.','wrong-password':'이메일과 비밀번호를 확인해주세요.','user-not-found':'이메일과 비밀번호를 확인해주세요.','email-already-in-use':'이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해주세요.','too-many-requests':'요청이 많습니다. 잠시 후 다시 시도해주세요.','network-request-failed':'인터넷 연결을 확인해주세요.','weak-password':'더 안전한 비밀번호를 입력해주세요.'})[code]||'처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.');
}
$('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();clear();const b=$('loginBtn');if(b.disabled)return;b.disabled=true;b.textContent='로그인 중…';
    try{await signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value);location.href=pageURL('index.html');}
    catch(e){error(e);}finally{b.disabled=false;b.textContent='로그인';}
});
$('signupForm').addEventListener('submit',async e=>{
    e.preventDefault();clear();const b=$('signupBtn');if(b.disabled)return;
    if($('signupPassword').value!==$('signupPasswordConfirm').value){message('비밀번호가 일치하지 않습니다.');return;}
    if($('signupPassword').value.length<8){message('비밀번호를 8자 이상 입력해주세요.');return;}
    b.disabled=true;b.textContent='가입 중…';
    try{
        const credential=await createUserWithEmailAndPassword(auth,$('signupEmail').value.trim(),$('signupPassword').value);
        try{await sendEmailVerification(credential.user);}catch{ /* Account was created; do not invite duplicate signup retries. */ }
        location.href=pageURL('couple-connect.html');
    }catch(e){error(e);}finally{b.disabled=false;b.textContent='회원가입';}
});
$('resetPasswordBtn').onclick=async()=>{
    const email=$('loginEmail');if(!email.value.trim()||!email.reportValidity()){message('로그인 이메일을 먼저 입력해주세요.');return;}
    const b=$('resetPasswordBtn');b.disabled=true;
    try{await sendPasswordResetEmail(auth,email.value.trim());message('가입된 이메일이라면 비밀번호 재설정 안내가 발송됩니다. 메일함을 확인해주세요.');}catch(e){error(e);}finally{b.disabled=false;}
};
