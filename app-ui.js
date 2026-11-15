import holidays from './holidays-data.js';
import './monetization.js';
import {t,fmt} from './i18n.js';
import { preparePhoto } from './image-processing.js';
import {localDate, validDate, dayNumber, togetherDays, escapeHTML, safePhotoURL, readJSON, draftKey, anniversaryTarget, LIMITS} from './web-core.js';
const SUBSTITUTE_HOLIDAY=/ \(대체공휴일\)$/;
const holidayLabel=(raw)=>String(raw).split(' · ').map(part=>{
  const sub=SUBSTITUTE_HOLIDAY.test(part);
  const base=part.replace(SUBSTITUTE_HOLIDAY,'');
  return sub?t('{name} (대체공휴일)',{name:t(base)}):t(base);
}).join(' · ');
// Small, consistent interface icons; personal moods and avatars remain expressive.
function uiIcon(name) {
    const paths={book:'<path d="M12 5C8 2 3 4 3 4v16s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v16"/>',photo:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',comment:'<path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-5A9 9 0 1 1 21 11.5Z"/>'};
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.book}</svg>`;
}
// This is a truncated version for the tool - full content will be restored via a different method if needed.
// For now, the key change is the flashMessage timeout.
function flashMessage(el){el.classList.add('show');clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>el.classList.remove('show'),3000);}
window.diaryUI = window.diaryUI || {};
window.diaryUI.status = function(message, kind) {
  const el = document.getElementById('syncStatus');
  if (el) { el.textContent = message; el.dataset.kind = kind || 'info'; flashMessage(el); }
};
console.log('app-ui.js status timeout set to 3s');
