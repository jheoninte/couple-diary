import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
test('every language picker keeps its value and system-language label in sync',async()=>{
 const dom=new JSDOM('<body><select id="a" data-language-picker></select><select id="languageSelect" data-language-picker></select></body>',{url:'https://app.test/'});
 const w=dom.window;for(const name of ['window','document','localStorage','MutationObserver','CustomEvent','Node'])globalThis[name]=w[name];
 Object.defineProperty(globalThis,'navigator',{value:{language:'ja-JP',languages:['ja-JP']},configurable:true});
 w.alert=()=>{};w.confirm=()=>true;
 const {setLanguage,getLocale,t}=await import('../i18n.js');
 assert.equal(getLocale(),'ja');assert.equal(t('로그인'),'ログイン');
 const pickers=[...w.document.querySelectorAll('[data-language-picker]')];
 const systemLabel=s=>s.querySelector('option[value="system"]').textContent;
 await setLanguage('ja');
 for(const s of pickers){assert.equal(s.value,'ja',s.id);assert.doesNotMatch(systemLabel(s),/[가-힣]/,s.id);}
 const jaLabel=systemLabel(pickers[0]);
 await setLanguage('en');
 for(const s of pickers){assert.equal(s.value,'en',s.id);assert.notEqual(systemLabel(s),jaLabel,s.id);assert.doesNotMatch(systemLabel(s),/[가-힣]/,s.id);}
 Object.defineProperty(globalThis,'navigator',{value:{language:'ko-KR',languages:['ko-KR']},configurable:true});
 await setLanguage('system');
 for(const s of pickers){assert.equal(s.value,'system',s.id);assert.equal(systemLabel(s),'시스템 언어 사용',s.id);}
 // An older import finishing late must never override the latest selection.
 await Promise.all([setLanguage('de'),setLanguage('ar'),setLanguage('en')]);
 assert.equal(getLocale(),'en');assert.equal(w.document.documentElement.dir,'ltr');
 assert.equal(w.localStorage.getItem('diary.language.v1'),'en');
 for(const s of pickers)assert.equal(s.value,'en');
 // System and cross-tab changes use the same asynchronous language loading path.
 Object.defineProperty(globalThis,'navigator',{value:{language:'fr-FR',languages:['fr-FR']},configurable:true});
 await setLanguage('system');
 const changed=new Promise(resolve=>w.addEventListener('diary:language-changed',resolve,{once:true}));
 Object.defineProperty(globalThis,'navigator',{value:{language:'ar-SA',languages:['ar-SA']},configurable:true});
 w.dispatchEvent(new w.Event('languagechange'));await changed;
 assert.equal(getLocale(),'ar');assert.equal(w.document.documentElement.dir,'rtl');
 const stored=new Promise(resolve=>w.addEventListener('diary:language-changed',resolve,{once:true}));
 w.dispatchEvent(new w.StorageEvent('storage',{key:'diary.language.v1',newValue:'ja'}));await stored;
 assert.equal(getLocale(),'ja');
 dom.window.close();
});
