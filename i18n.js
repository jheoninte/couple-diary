import {SUPPORTED_LOCALES,resolveLocale,translate,localizeDocument,formatDate,formatTime,formatMonthYear,formatMonthDay,formatNumber,formatCurrency,formatWon,weekdayNames} from './i18n-core.js';
const storageKey='diary.language.v1';let preference='system';try{preference=localStorage.getItem(storageKey)||'system';}catch{}
export function getLocale(){return resolveLocale(preference,navigator.languages?.length?navigator.languages:[navigator.language||'en']);}
export function t(source,params){return translate(source,getLocale(),params);}
export const fmt={date:(v,o)=>formatDate(v,getLocale(),o),time:v=>formatTime(v,getLocale()),monthYear:(y,m)=>formatMonthYear(y,m,getLocale()),monthDay:v=>formatMonthDay(v,getLocale()),number:(v,o)=>formatNumber(v,getLocale(),o),currency:(a,c)=>formatCurrency(a,c,getLocale()),won:a=>formatWon(a,getLocale()),weekdays:w=>weekdayNames(getLocale(),w)};
function syncPickers(){const value=SUPPORTED_LOCALES.some(v=>v.code===preference)?preference:'system';for(const select of document.querySelectorAll('[data-language-picker]')){const system=select.querySelector('option[value="system"]');if(system)system.textContent=t('시스템 언어 사용');select.value=value;}}
function update(){
  localizeDocument(document,getLocale());
  syncPickers();
  if(window.diaryUI?.relocale)window.diaryUI.relocale();
  window.dispatchEvent(new CustomEvent('diary:language-changed',{detail:{locale:getLocale()}}));
  // Force refresh of common dynamic areas after language change
  document.querySelectorAll('[data-i18n-refresh]').forEach(el=>{
    if(el.dataset.i18nOriginal)el.textContent=t(el.dataset.i18nOriginal);
  });
}
export function setLanguage(value){preference=SUPPORTED_LOCALES.some(v=>v.code===value)?value:'system';try{localStorage.setItem(storageKey,preference);}catch{}update();}
function mount(){for(const select of document.querySelectorAll('[data-language-picker]')){select.replaceChildren();const system=document.createElement('option');system.value='system';system.textContent=t('시스템 언어 사용');select.append(system);for(const {code,name}of SUPPORTED_LOCALES){const option=document.createElement('option');option.value=code;option.textContent=name;select.append(option);}select.addEventListener('change',()=>setLanguage(select.value));}update();
 const pending=new Set();let queued=false;const observer=new MutationObserver(mutations=>{for(const m of mutations){if(m.type==='characterData')pending.add(m.target);else if(m.type==='attributes')pending.add(m.target);else for(const node of m.addedNodes)pending.add(node);}if(queued)return;queued=true;queueMicrotask(()=>{queued=false;const nodes=[...pending];pending.clear();for(const node of nodes)if(node.isConnected)localizeDocument(node,getLocale());});});observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title','alt']});
 const confirmOriginal=window.confirm.bind(window);window.confirm=message=>confirmOriginal(t(String(message)));
 window.alert=message=>showToast(t(String(message)));
}
function showToast(text){let el=document.getElementById('appToast');if(!el){el=document.createElement('div');el.id='appToast';el.className='app-toast';el.setAttribute('role','status');el.setAttribute('data-i18n-ignore','');document.body.append(el);}el.textContent=text;el.classList.add('show');clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>el.classList.remove('show'),3000);}
window.diaryI18n={t,getLocale,setLanguage,fmt};window.addEventListener('languagechange',()=>{if(preference==='system')update();});window.addEventListener('storage',event=>{if(event.key===storageKey){preference=event.newValue||'system';update();}});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
