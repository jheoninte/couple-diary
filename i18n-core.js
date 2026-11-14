import catalogs from './locales/catalogs.json' with {type:'json'};
export const SUPPORTED_LOCALES=Object.freeze([['ko','한국어'],['en','English'],['ja','日本語'],['zh-Hant','繁體中文'],['zh-Hans','简体中文'],['es','Español'],['pt-BR','Português (Brasil)'],['fr','Français'],['id','Bahasa Indonesia'],['vi','Tiếng Việt'],['de','Deutsch'],['th','ไทย'],['ms','Bahasa Melayu'],['it','Italiano'],['ru','Русский'],['tr','Türkçe'],['ar','العربية'],['hi','हिन्दी']].map(([code,name])=>({code,name})));
const supported=new Set(SUPPORTED_LOCALES.map(v=>v.code));
export function resolveLocale(preference='system',languages=['en']){if(supported.has(preference))return preference;for(const value of languages){const tag=String(value).replace(/_/g,'-').toLowerCase(),base=tag.split('-')[0];if(base==='zh')return /hant|-(tw|hk|mo)(-|$)/.test(tag)?'zh-Hant':'zh-Hans';if(base==='pt')return 'pt-BR';if(supported.has(base))return base;}return 'en';}
export function translate(source,locale='en',params={}){const normalized=String(source).replace(/\s+/g,' ').trim();let value=catalogs[locale]?.[normalized]??catalogs.en[normalized]??source;if(locale==='ko')value=source;return value.replace(/\{(\w+)\}/g,(match,key)=>params[key]===undefined?match:String(params[key]));}
export function hasTranslation(source){return Object.hasOwn(catalogs.en,String(source).replace(/\s+/g,' ').trim());}
const originalText=new WeakMap(),originalAttributes=new WeakMap();
// All authored content stays exactly as entered, including text identical to a UI label.
const protectedContent='script,style,textarea,input,option,[data-i18n-ignore],[data-user-content],.diary-content,.comment-text,.comment-author,.diary-writer-icon,.diary-writer,.anniversary-name,.search-result-preview,.memory-caption,#appTitle,#userEmail,#partnerEmail,#generatedCode,#coupleCodeInput';
const attributes=['placeholder','aria-label','title','alt'];
function applyText(node,locale){if(node.parentElement?.closest(protectedContent))return;const current=node.nodeValue,previous=originalText.get(node),source=previous?.last===current?previous.source:current;const next=translate(source,locale);originalText.set(node,{source,last:next});if(next!==current)node.nodeValue=next;}
function applyAttributes(el,locale){if(el.closest('[data-i18n-ignore],[data-user-content]'))return;const records=originalAttributes.get(el)||{};for(const name of attributes){if(!el.hasAttribute(name))continue;const current=el.getAttribute(name),previous=records[name],source=previous?.last===current?previous.source:current,next=translate(source,locale);records[name]={source,last:next};if(next!==current)el.setAttribute(name,next);}originalAttributes.set(el,records);}
export function localizeDocument(root,locale){const doc=root.nodeType===9?root:root.ownerDocument;doc.documentElement.lang=locale;doc.documentElement.dir=locale==='ar'?'rtl':'ltr';if(root.nodeType===3){applyText(root,locale);return;}if(root.nodeType===1)applyAttributes(root,locale);const walk=doc.createTreeWalker(root,5);while(walk.nextNode()){const n=walk.currentNode;if(n.nodeType===3)applyText(n,locale);else applyAttributes(n,locale);}}
// Locale-aware formatting. Always Gregorian calendar and Latin digits so diary dates stay unambiguous across languages.
const intlTags={ko:'ko-KR',en:'en-US',ja:'ja-JP','zh-Hans':'zh-CN','zh-Hant':'zh-TW',es:'es','pt-BR':'pt-BR',fr:'fr',id:'id',vi:'vi',de:'de',th:'th-TH-u-ca-gregory-nu-latn',ms:'ms',it:'it',ru:'ru',tr:'tr',ar:'ar-u-ca-gregory-nu-latn',hi:'hi-IN-u-nu-latn'};
export function intlLocale(locale){return intlTags[locale]||'en-US';}
const toDate=value=>value instanceof Date?value:new Date(value);
export function formatDate(value,locale,options={year:'numeric',month:'long',day:'numeric'}){const date=toDate(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(intlLocale(locale),options).format(date);}
export function formatTime(value,locale){return formatDate(value,locale,{hour:'2-digit',minute:'2-digit'});}
export function formatMonthYear(year,monthIndex,locale){return formatDate(new Date(year,monthIndex,1,12),locale,{year:'numeric',month:'long'});}
export function formatMonthDay(value,locale){return formatDate(value,locale,{month:'long',day:'numeric'});}
export function formatNumber(value,locale,options){return new Intl.NumberFormat(intlLocale(locale),options).format(value);}
export function formatCurrency(amount,currency,locale){return new Intl.NumberFormat(intlLocale(locale),{style:'currency',currency,maximumFractionDigits:currency==='KRW'||currency==='JPY'?0:2}).format(amount);}
// Korean keeps the familiar "4,900원"; other languages use the locale's own KRW currency format.
export function formatWon(amount,locale){return locale==='ko'?`${formatNumber(Math.round(amount),locale)}원`:formatCurrency(Math.round(amount),'KRW',locale);}
// Sunday-first weekday names (the calendar grid starts on Sunday).
export function weekdayNames(locale,width='short'){const format=new Intl.DateTimeFormat(intlLocale(locale),{weekday:width,timeZone:'UTC'});return Array.from({length:7},(_,i)=>format.format(new Date(Date.UTC(2023,0,1+i))));}
