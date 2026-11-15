import {translate,formatDate} from './i18n-core.js';
export function mountDeletionUI({document,storage,auth,pageURL,subscribe,reauthenticate,remote,signOut}) {
  const $=id=>document.getElementById(id),key=uid=>`diary:deletion:receipt:${uid}`,lastKey='diary:deletion:lastReceipt';
  let currentUser=null,submitting=false,receipt=null,version=0;
  const lang=()=>document.documentElement.lang||'ko',tr=(source,params)=>translate(source,lang(),params);
  const get=name=>{try{return storage.getItem(name);}catch{return null;}};
  const message=value=>{$('deletionStatus').textContent=value;};
  $('backLink').href=pageURL('index.html#settings');$('loginLink').href=pageURL('login.html');
  function showReceipt(row){
    $('receiptSection').hidden=false;$('deletionIntro').hidden=true;
    $('receiptTitle').textContent=row.status==='complete'?'계정 삭제가 완료되었습니다':'계정 삭제 요청 처리 중';
    $('receiptMessage').textContent=row.status==='complete'?'앱 계정과 기록·사진 삭제를 완료했습니다. Apple 구독은 별도로 관리해주세요.':row.dueAt?tr('기록 접근과 공유가 중단되었습니다. {date}까지 COMINO가 삭제하고 가입 이메일로 완료를 안내합니다.',{date:formatDate(row.dueAt,lang())}):tr('기록 접근과 공유가 중단되었습니다. COMINO가 삭제하고 가입 이메일로 완료를 안내합니다.');
    $('receiptCode').textContent=receipt?tr('접수번호: {id}',{id:receipt}):'';
    // Clearer guidance for already-requested users
    const hint=$('alreadyRequestedHint');
    if(hint)hint.hidden=row.status==='complete';
  }
  async function refresh(){
    const token=receipt,view=version;
    if(!token){if(currentUser){const row=await remote('state');if(view===version&&row.requested)showReceipt(row);}return;}
    try{const row=await remote('status',{receipt:token});if(view!==version)return;showReceipt(row);message('');}
    catch{if(view===version)message('접수 상태를 확인하지 못했습니다. 접수번호와 함께 cs@comino.app으로 문의해주세요.');}
  }
  $('refreshReceipt').onclick=()=>refresh().catch(()=>message('계정 상태를 확인하지 못했습니다.'));
  $('deletionForm').addEventListener('submit',async event=>{
    event.preventDefault();if(submitting||!currentUser||!$('deleteConsent').checked)return;
    const user=currentUser;submitting=true;$('deleteSubmit').disabled=true;message('요청을 접수하고 있습니다…');
    try{
      await reauthenticate(user,$('deletePassword').value);$('deletePassword').value='';
      if(auth.currentUser?.uid!==user.uid)throw Error('로그인 계정이 변경되었습니다. 현재 계정에서 다시 확인해주세요.');
      const result=await remote('request',{expectedUid:user.uid});
      try{storage.setItem(key(user.uid),result.receipt);storage.setItem(lastKey,result.receipt);
        for(const name of Object.keys(storage))if(name.startsWith(`diary:v2:${user.uid}:`)||name===`diary:ads:v1:${user.uid}`)storage.removeItem(name);
      }catch{}
      if(auth.currentUser?.uid!==user.uid)return;
      receipt=result.receipt;showReceipt(result);message('');await signOut();
    }catch(error){$('deletePassword').value='';if(auth.currentUser?.uid===user.uid)message(error.code?.startsWith('auth/')?'이메일과 비밀번호를 확인하고 다시 시도해주세요.':error.message||'접수하지 못했습니다. 연결을 확인하고 다시 시도해주세요.');}
    finally{submitting=false;$('deleteSubmit').disabled=false;}
  });
  subscribe(async user=>{
    currentUser=user;const view=++version;receipt=get(user?key(user.uid):lastKey);
    $('receiptSection').hidden=true;$('deletionIntro').hidden=false;$('deletionForm').hidden=!user;$('loginNotice').hidden=!!user;message('');
    try{if(receipt)await refresh();else if(user){const state=await remote('state');if(view===version&&state.requested)showReceipt(state);}}
    catch{if(view===version)message('계정 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');}
  });
}
