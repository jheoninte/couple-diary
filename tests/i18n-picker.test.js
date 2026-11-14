import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
test('every language picker keeps its value and system-language label in sync',async()=>{
 const dom=new JSDOM('<body><select id="a" data-language-picker></select><select id="languageSelect" data-language-picker></select></body>',{url:'https://app.test/'});
 const w=dom.window;for(const name of ['window','document','localStorage','MutationObserver','CustomEvent','Node'])globalThis[name]=w[name];
 Object.defineProperty(globalThis,'navigator',{value:{language:'ko-KR',languages:['ko-KR']},configurable:true});
 w.alert=()=>{};w.confirm=()=>true;
 const {setLanguage}=await import('../i18n.js');
 const pickers=[...w.document.querySelectorAll('[data-language-picker]')];
 const systemLabel=s=>s.querySelector('option[value="system"]').textContent;
 setLanguage('ja');
 for(const s of pickers){assert.equal(s.value,'ja',s.id);assert.doesNotMatch(systemLabel(s),/[가-힣]/,s.id);}
 const jaLabel=systemLabel(pickers[0]);
 setLanguage('en');
 for(const s of pickers){assert.equal(s.value,'en',s.id);assert.notEqual(systemLabel(s),jaLabel,s.id);assert.doesNotMatch(systemLabel(s),/[가-힣]/,s.id);}
 setLanguage('system');
 for(const s of pickers){assert.equal(s.value,'system',s.id);assert.equal(systemLabel(s),'시스템 언어 사용',s.id);}
});
