export function normalizeInviteCode(value){const code=String(value).trim().replace(/[\s-]/g,'').toUpperCase();if(!/^[A-F0-9]{16}$/.test(code))throw Error('16자리 초대 코드를 확인해주세요. 코드의 공백과 하이픈은 그대로 붙여넣어도 괜찮아요.');return code;}
export function formatInviteCode(value){return normalizeInviteCode(value).match(/.{4}/g).join('-');}
