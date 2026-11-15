// Push notification text, rendered on the server in the language the device registered with.
// Diary contents are never put in a notification (lock screens are visible to others); a comment preview is,
// because iOS already lets each user hide previews on the lock screen.
// Columns: partner fallback, how a name is shown, then title/body per kind. Only ko/en/ja are reviewed;
// the other languages are provisional, like the in-app catalog.
const KEYS=['partner','who','diaryTitle','diaryBody','likeTitle','likeBody','commentTitle','replyTitle','connectedTitle','connectedBody'];
const ROWS={
 ko:['연인','{name}님','💌 {who}의 일기가 도착했어요','{date}, 어떤 하루였는지 읽어보세요.','❤️ {who}이 내 일기에 공감했어요','{date}의 일기를 다시 열어보세요.','💬 {who}이 댓글을 남겼어요','💬 {who}이 답글을 남겼어요','🎉 {who}과 연결되었어요','이제 둘만의 일기장을 함께 채워가요.'],
 en:['Your partner','{name}','💌 {who} wrote a new diary entry','{date} · See how their day went.','❤️ {who} loved your diary entry','Your entry from {date}','💬 {who} commented on your entry','💬 {who} replied to your comment','🎉 {who} joined your diary','Start filling your shared diary together.'],
 ja:['パートナー','{name}さん','💌 {who}の日記が届きました','{date}はどんな一日だったか読んでみましょう。','❤️ {who}があなたの日記にいいねしました','{date}の日記をもう一度開いてみましょう。','💬 {who}がコメントしました','💬 {who}が返信しました','🎉 {who}とつながりました','ふたりの日記を一緒につづっていきましょう。'],
 'zh-Hans':['另一半','{name}','💌 {who}写了新日记','看看{date}过得怎么样吧。','❤️ {who}赞了你的日记','{date}的日记','💬 {who}评论了你的日记','💬 {who}回复了你的评论','🎉 {who}已与你连接','一起写下你们的专属日记吧。'],
 'zh-Hant':['另一半','{name}','💌 {who}寫了新日記','看看{date}過得怎麼樣吧。','❤️ {who}對你的日記按讚','{date}的日記','💬 {who}在你的日記留言','💬 {who}回覆了你的留言','🎉 {who}已與你連結','一起寫下你們專屬的日記吧。'],
 es:['Tu pareja','{name}','💌 {who} escribió en el diario','{date} · Mira cómo fue su día.','❤️ {who} reaccionó a tu entrada','Tu entrada del {date}','💬 {who} comentó tu entrada','💬 {who} respondió a tu comentario','🎉 {who} se unió a tu diario','Empiecen a llenar su diario juntos.'],
 'pt-BR':['Seu amor','{name}','💌 {who} escreveu no diário','{date} · Veja como foi o dia.','❤️ {who} curtiu seu diário','Seu diário de {date}','💬 {who} comentou no seu diário','💬 {who} respondeu ao seu comentário','🎉 {who} entrou no seu diário','Comecem a preencher o diário juntos.'],
 fr:['Votre partenaire','{name}','💌 {who} a écrit dans le journal','Découvrez sa journée du {date}.','❤️ {who} a aimé votre page','Votre page du {date}','💬 {who} a commenté votre page','💬 {who} a répondu à votre commentaire','🎉 {who} a rejoint votre journal','Remplissez votre journal à deux.'],
 id:['Pasanganmu','{name}','💌 {who} menulis buku harian baru','{date} · Lihat bagaimana harinya.','❤️ {who} menyukai catatanmu','Catatanmu tanggal {date}','💬 {who} mengomentari catatanmu','💬 {who} membalas komentarmu','🎉 {who} telah terhubung denganmu','Mulai isi buku harian kalian bersama.'],
 vi:['Người ấy','{name}','💌 {who} vừa viết nhật ký','Cùng đọc xem ngày {date} thế nào nhé.','❤️ {who} đã thích nhật ký của bạn','Nhật ký ngày {date}','💬 {who} đã bình luận nhật ký của bạn','💬 {who} đã trả lời bình luận của bạn','🎉 {who} đã kết nối với bạn','Cùng nhau viết nhật ký của hai bạn nhé.'],
 de:['Dein Schatz','{name}','💌 {who} hat ins Tagebuch geschrieben','Lies, wie der {date} war.','❤️ {who} gefällt dein Eintrag','Dein Eintrag vom {date}','💬 {who} hat deinen Eintrag kommentiert','💬 {who} hat auf deinen Kommentar geantwortet','🎉 {who} ist jetzt mit dir verbunden','Füllt euer gemeinsames Tagebuch.'],
 th:['แฟนของคุณ','{name}','💌 {who} เขียนไดอารี่ใหม่','มาดูกันว่าวันที่ {date} เป็นอย่างไร','❤️ {who} ถูกใจไดอารี่ของคุณ','ไดอารี่วันที่ {date}','💬 {who} แสดงความคิดเห็นในไดอารี่ของคุณ','💬 {who} ตอบกลับความคิดเห็นของคุณ','🎉 เชื่อมต่อกับ {who} แล้ว','มาเขียนไดอารี่ของเราสองคนด้วยกันนะ'],
 ms:['Pasangan anda','{name}','💌 {who} menulis diari baharu','Baca kisah harinya pada {date}.','❤️ {who} menyukai diari anda','Diari anda pada {date}','💬 {who} mengulas diari anda','💬 {who} membalas ulasan anda','🎉 {who} telah bersambung dengan anda','Mari isi diari bersama.'],
 it:['Il tuo amore','{name}','💌 {who} ha scritto nel diario','Scopri com’è andata il {date}.','❤️ {who} ha messo un cuore alla tua pagina','La tua pagina del {date}','💬 {who} ha commentato la tua pagina','💬 {who} ha risposto al tuo commento','🎉 Connessione con {who} riuscita','Riempite insieme il vostro diario.'],
 ru:['Ваша половинка','{name}','💌 {who} написал(а) в дневнике','Узнайте, как прошёл {date}.','❤️ {who} оценил(а) вашу запись','Запись от {date}','💬 {who} прокомментировал(а) вашу запись','💬 {who} ответил(а) на ваш комментарий','🎉 {who} теперь в вашем дневнике','Заполняйте общий дневник вместе.'],
 tr:['Sevgilin','{name}','💌 {who} günlüğe yazdı','{date} gününün nasıl geçtiğine bak.','❤️ {who} günlüğünü beğendi','{date} tarihli günlüğün','💬 {who} günlüğüne yorum yaptı','💬 {who} yorumuna yanıt verdi','🎉 {who} ile bağlantı kuruldu','Ortak günlüğünüzü birlikte doldurun.'],
 ar:['شريكك','{name}','💌 كتب {who} يومية جديدة','اقرأ كيف كان يوم {date}.','❤️ أُعجب {who} بيوميتك','يوميتك بتاريخ {date}','💬 علّق {who} على يوميتك','💬 ردّ {who} على تعليقك','🎉 تم الربط مع {who}','املآ يومياتكما المشتركة معًا.'],
 hi:['आपके साथी','{name}','💌 {who} ने नई डायरी लिखी','देखें {date} का दिन कैसा रहा।','❤️ {who} को आपकी डायरी पसंद आई','{date} की डायरी','💬 {who} ने आपकी डायरी पर टिप्पणी की','💬 {who} ने आपकी टिप्पणी का जवाब दिया','🎉 {who} से जुड़ गए','साथ मिलकर अपनी डायरी भरें।']
};
const CATALOG=Object.fromEntries(Object.entries(ROWS).map(([lang,row])=>[lang,Object.fromEntries(KEYS.map((k,i)=>[k,row[i]]))]));
const LANGUAGES=Object.keys(CATALOG);
function resolveLanguage(value){
 if(typeof value!=='string')return 'en';if(CATALOG[value])return value;
 const lower=value.toLowerCase();
 if(lower.startsWith('zh'))return /hant|tw|hk|mo/.test(lower)?'zh-Hant':'zh-Hans';
 if(lower.startsWith('pt'))return 'pt-BR';
 const base=lower.split(/[-_]/)[0];return CATALOG[base]?base:'en';
}
const fill=(template,params)=>template.replace(/\{(\w+)\}/g,(_,k)=>params[k]??'');
function formatDay(date,lang){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';
 try{return new Intl.DateTimeFormat(lang,{month:'long',day:'numeric',timeZone:'UTC',calendar:'gregory',numberingSystem:'latn'}).format(new Date(date+'T00:00:00Z'));}
 catch{return date.slice(5);}
}
function preview(text,max=100){const value=String(text||'').replace(/\s+/g,' ').trim();return [...value].length>max?[...value].slice(0,max-1).join('')+'…':value;}
// kind: diary | like | comment | reply | connected
function render(kind,{name,date,text}={},language){
 const lang=resolveLanguage(language),m=CATALOG[lang],clean=typeof name==='string'?name.trim().slice(0,40):'';
 const who=clean?fill(m.who,{name:clean}):m.partner,params={who,date:formatDay(date,lang)};
 if(kind==='diary')return {title:fill(m.diaryTitle,params),body:fill(m.diaryBody,params)};
 if(kind==='like')return {title:fill(m.likeTitle,params),body:fill(m.likeBody,params)};
 if(kind==='comment'||kind==='reply')return {title:fill(m[kind+'Title'],params),body:preview(text)};
 if(kind==='connected')return {title:fill(m.connectedTitle,params),body:fill(m.connectedBody,params)};
 throw Error('Unknown push kind');
}
module.exports={render,resolveLanguage,LANGUAGES,KEYS};
