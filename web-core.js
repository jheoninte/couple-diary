// Pure helpers shared by the UI and regression tests. No Firebase or DOM side effects.
export const LIMITS = Object.freeze({content: 20000, comment: 1000, photos: 3, imageBytes: 2 * 1024 * 1024});
export function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [y,m,d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y,m-1,d));
    return y >= 1900 && y <= 2200 && date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d;
}
export function dayNumber(value) {
    if (!validDate(value)) return NaN;
    const [y,m,d] = value.split('-').map(Number);
    return Date.UTC(y,m-1,d)/86400000;
}
export function togetherDays(start, today = localDate()) {return Math.max(0, dayNumber(today)-dayNumber(start)+1) || 0;}
export function escapeHTML(value) {return String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
export function safePhotoURL(value) {
    if (typeof value !== 'string') return '';
    if (/^blob:/.test(value) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    return '';
}
export function readJSON(storage, key, fallback) {
    try {const value=JSON.parse(storage.getItem(key)); return value ?? fallback;} catch {return fallback;}
}
export function draftKey(uid, coupleId, date) {return `diary:v2:${uid}:${coupleId}:draft:${date}`;}
export function anniversaryTarget(anniversary, today = localDate()) {
    if (!anniversary.recurring) return anniversary.date;
    const year=Number(today.slice(0,4));
    const md=anniversary.date.slice(5);
    for(let y=year;y<=year+8;y++) {
        const next=`${y}-${md}`;
        if(validDate(next) && next>=today) return next;
    }
    return anniversary.date;
}
export function entryId(uid,date) {if(!validDate(date)|| !/^[A-Za-z0-9_-]+$/.test(uid)) throw Error('잘못된 날짜 또는 사용자입니다.');return `${uid}_${date}`;}
