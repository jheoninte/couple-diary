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
// Reminder and subscription messages: key -> one text per language, in LANGUAGE_ORDER.
const LANGUAGE_ORDER=["ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "pt-BR", "fr", "id", "vi", "de", "th", "ms", "it", "ru", "tr", "ar", "hi"];
const EXTRA={
"soonBody": [
"특별한 하루가 내일이에요. 미리 마음을 준비해보세요.",
"Your special day is tomorrow. Time to get ready!",
"特別な日は明日です。心の準備をしておきましょう。",
"特别的日子就在明天，提前准备一下吧。",
"特別的日子就在明天，提前準備一下吧。",
"Su día especial es mañana. ¡Prepárense!",
"O dia especial de vocês é amanhã. Preparem-se!",
"Votre jour spécial, c’est demain. Préparez-vous !",
"Hari spesial kalian besok. Yuk, bersiap!",
"Ngày đặc biệt là ngày mai rồi. Chuẩn bị thôi!",
"Euer besonderer Tag ist morgen. Bereitet euch vor!",
"วันพิเศษคือพรุ่งนี้แล้ว เตรียมตัวกันเลย!",
"Hari istimewa anda esok. Bersedialah!",
"Il vostro giorno speciale è domani. Preparatevi!",
"Ваш особенный день — завтра. Пора готовиться!",
"Özel gününüz yarın. Hazırlanmaya başlayın!",
"يومكما المميز غدًا. استعدّا!",
"आपका खास दिन कल है। तैयारी कर लें!"
],
"anniversaryTodayBody": [
"오늘이에요! 둘만의 특별한 하루를 일기에 남겨보세요.",
"It’s today! Capture your special day in the diary.",
"今日です！ふたりの特別な一日を日記に残しましょう。",
"就是今天！把你们的特别一天记进日记吧。",
"就是今天！把你們的特別一天記進日記吧。",
"¡Es hoy! Guarden este día especial en el diario.",
"É hoje! Registrem este dia especial no diário.",
"C’est aujourd’hui ! Gardez une trace de ce jour spécial.",
"Hari ini! Abadikan hari spesial kalian di buku harian.",
"Chính là hôm nay! Hãy lưu lại ngày đặc biệt vào nhật ký nhé.",
"Heute ist es so weit! Haltet euren besonderen Tag im Tagebuch fest.",
"วันนี้แล้ว! บันทึกวันพิเศษของเราไว้ในไดอารี่กันนะ",
"Hari ini! Abadikan hari istimewa anda dalam diari.",
"È oggi! Ricordate questo giorno speciale nel diario.",
"Это сегодня! Сохраните этот особенный день в дневнике.",
"Bugün! Bu özel günü günlüğe kaydedin.",
"إنه اليوم! وثّقا يومكما المميز في اليوميات.",
"आज ही है! इस खास दिन को डायरी में संजो लें।"
],
"daysTodayTitle": [
"💕 함께한 지 {n}일",
"💕 {n} days together",
"💕 一緒に{n}日",
"💕 在一起{n}天",
"💕 在一起{n}天",
"💕 {n} días juntos",
"💕 {n} dias juntos",
"💕 {n} jours ensemble",
"💕 {n} hari bersama",
"💕 {n} ngày bên nhau",
"💕 {n} Tage zusammen",
"💕 ครบ {n} วันที่อยู่ด้วยกัน",
"💕 {n} hari bersama",
"💕 {n} giorni insieme",
"💕 {n} дней вместе",
"💕 Birlikte {n} gün",
"💕 {n} يومًا معًا",
"💕 साथ के {n} दिन"
],
"daysTodayBody": [
"오늘은 함께한 지 {n}일째 되는 날이에요. 축하해요!",
"Today marks {n} days together. Congratulations!",
"今日で一緒に{n}日目。おめでとうございます！",
"今天是你们在一起的第{n}天，恭喜！",
"今天是你們在一起的第{n}天，恭喜！",
"Hoy cumplen {n} días juntos. ¡Felicidades!",
"Hoje vocês completam {n} dias juntos. Parabéns!",
"Aujourd’hui, cela fait {n} jours que vous êtes ensemble. Félicitations !",
"Hari ini genap {n} hari kalian bersama. Selamat!",
"Hôm nay tròn {n} ngày bên nhau. Chúc mừng!",
"Heute seid ihr {n} Tage zusammen. Herzlichen Glückwunsch!",
"วันนี้ครบ {n} วันที่อยู่ด้วยกันแล้ว ยินดีด้วย!",
"Hari ini genap {n} hari bersama. Tahniah!",
"Oggi sono {n} giorni insieme. Congratulazioni!",
"Сегодня {n} дней вместе. Поздравляем!",
"Bugün birlikte {n}. gününüz. Tebrikler!",
"اليوم تكملان {n} يومًا معًا. تهانينا!",
"आज साथ के {n} दिन पूरे हुए। बधाई हो!"
],
"daysTomorrowTitle": [
"💕 내일은 함께한 지 {n}일",
"💕 Tomorrow: {n} days together",
"💕 明日で一緒に{n}日",
"💕 明天就在一起{n}天了",
"💕 明天就在一起{n}天了",
"💕 Mañana: {n} días juntos",
"💕 Amanhã: {n} dias juntos",
"💕 Demain : {n} jours ensemble",
"💕 Besok: {n} hari bersama",
"💕 Ngày mai: {n} ngày bên nhau",
"💕 Morgen: {n} Tage zusammen",
"💕 พรุ่งนี้ครบ {n} วัน",
"💕 Esok: {n} hari bersama",
"💕 Domani: {n} giorni insieme",
"💕 Завтра: {n} дней вместе",
"💕 Yarın: birlikte {n} gün",
"💕 غدًا: {n} يومًا معًا",
"💕 कल: साथ के {n} दिन"
],
"yearsTodayTitle": [
"💍 함께한 지 {n}주년",
"💍 {n}-year anniversary",
"💍 {n}周年",
"💍 {n}周年纪念日",
"💍 {n}週年紀念日",
"💍 {n}.º aniversario",
"💍 {n}º aniversário juntos",
"💍 Anniversaire : {n} an(s) ensemble",
"💍 Anniversary ke-{n}",
"💍 Kỷ niệm {n} năm",
"💍 {n}. Jahrestag",
"💍 ครบรอบ {n} ปี",
"💍 Ulang tahun ke-{n}",
"💍 {n}° anniversario",
"💍 {n}-я годовщина",
"💍 {n}. yıl dönümü",
"💍 الذكرى السنوية {n}",
"💍 सालगिरह: {n} साल"
],
"yearsTodayBody": [
"오늘은 우리의 {n}주년이에요. 축하해요!",
"Today is your {n}-year anniversary. Congratulations!",
"今日はふたりの{n}周年です。おめでとうございます！",
"今天是你们的{n}周年纪念日，恭喜！",
"今天是你們的{n}週年紀念日，恭喜！",
"Hoy celebran {n} año(s) juntos. ¡Felicidades!",
"Hoje vocês completam {n} ano(s) juntos. Parabéns!",
"Aujourd’hui, vous fêtez {n} an(s) ensemble. Félicitations !",
"Hari ini genap {n} tahun kalian bersama. Selamat!",
"Hôm nay là kỷ niệm {n} năm bên nhau. Chúc mừng!",
"Heute feiert ihr euren {n}. Jahrestag. Herzlichen Glückwunsch!",
"วันนี้ครบรอบ {n} ปีของเรา ยินดีด้วย!",
"Hari ini genap {n} tahun bersama. Tahniah!",
"Oggi è il vostro {n}° anniversario. Congratulazioni!",
"Сегодня ваша {n}-я годовщина. Поздравляем!",
"Bugün {n}. yıl dönümünüz. Tebrikler!",
"اليوم ذكراكما السنوية {n}. تهانينا!",
"आज आपके साथ के {n} साल पूरे हुए। बधाई हो!"
],
"yearsTomorrowTitle": [
"💍 내일은 {n}주년",
"💍 Tomorrow: {n}-year anniversary",
"💍 明日は{n}周年",
"💍 明天是{n}周年纪念日",
"💍 明天是{n}週年紀念日",
"💍 Mañana: {n}.º aniversario",
"💍 Amanhã: {n}º aniversário juntos",
"💍 Demain : {n} an(s) ensemble",
"💍 Besok: anniversary ke-{n}",
"💍 Ngày mai: kỷ niệm {n} năm",
"💍 Morgen: {n}. Jahrestag",
"💍 พรุ่งนี้ครบรอบ {n} ปี",
"💍 Esok: ulang tahun ke-{n}",
"💍 Domani: {n}° anniversario",
"💍 Завтра: {n}-я годовщина",
"💍 Yarın: {n}. yıl dönümü",
"💍 غدًا: الذكرى السنوية {n}",
"💍 कल: साथ के {n} साल"
],
"birthdayTodayTitle": [
"🎂 오늘은 {who}의 생일이에요",
"🎂 {who} has a birthday today",
"🎂 今日は{who}の誕生日です",
"🎂 今天是{who}的生日",
"🎂 今天是{who}的生日",
"🎂 {who} cumple años hoy",
"🎂 {who} faz aniversário hoje",
"🎂 {who} fête son anniversaire aujourd’hui",
"🎂 {who} berulang tahun hari ini",
"🎂 {who} có sinh nhật hôm nay",
"🎂 {who} hat heute Geburtstag",
"🎂 วันนี้วันเกิดของ{who}",
"🎂 {who} menyambut hari lahir hari ini",
"🎂 {who} compie gli anni oggi",
"🎂 {who}: сегодня день рождения",
"🎂 {who} bugün doğum gününü kutluyor",
"🎂 اليوم عيد ميلاد {who}",
"🎂 आज {who} का जन्मदिन है"
],
"birthdayTodayBody": [
"따뜻한 축하 한마디를 남겨보세요.",
"Send some warm birthday wishes.",
"心のこもったお祝いの言葉を伝えましょう。",
"送上一句温暖的生日祝福吧。",
"送上一句溫暖的生日祝福吧。",
"Envíale un cálido mensaje de felicitación.",
"Mande uma mensagem carinhosa de parabéns.",
"Envoyez-lui un petit mot chaleureux.",
"Kirimkan ucapan selamat yang hangat.",
"Hãy gửi một lời chúc thật ấm áp nhé.",
"Schick ein paar liebe Glückwünsche.",
"ส่งคำอวยพรอบอุ่น ๆ ให้กันนะ",
"Hantarkan ucapan selamat yang hangat.",
"Manda dei caldi auguri.",
"Отправьте тёплое поздравление.",
"Sıcak bir kutlama mesajı gönder.",
"أرسل تهنئة دافئة.",
"गर्मजोशी भरी शुभकामनाएं भेजें।"
],
"birthdayTomorrowTitle": [
"🎂 내일은 {who}의 생일이에요",
"🎂 {who} has a birthday tomorrow",
"🎂 明日は{who}の誕生日です",
"🎂 明天是{who}的生日",
"🎂 明天是{who}的生日",
"🎂 {who} cumple años mañana",
"🎂 {who} faz aniversário amanhã",
"🎂 {who} fête son anniversaire demain",
"🎂 {who} berulang tahun besok",
"🎂 {who} có sinh nhật vào ngày mai",
"🎂 {who} hat morgen Geburtstag",
"🎂 พรุ่งนี้วันเกิดของ{who}",
"🎂 {who} menyambut hari lahir esok",
"🎂 {who} compie gli anni domani",
"🎂 {who}: завтра день рождения",
"🎂 {who} yarın doğum gününü kutluyor",
"🎂 غدًا عيد ميلاد {who}",
"🎂 कल {who} का जन्मदिन है"
],
"birthdayTomorrowBody": [
"축하할 준비 됐나요? 🎁",
"Ready to celebrate? 🎁",
"お祝いの準備はできましたか？🎁",
"准备好庆祝了吗？🎁",
"準備好慶祝了嗎？🎁",
"¿Todo listo para celebrar? 🎁",
"Tudo pronto para comemorar? 🎁",
"Prêt(e) à fêter ça ? 🎁",
"Sudah siap merayakan? 🎁",
"Đã sẵn sàng để chúc mừng chưa? 🎁",
"Bereit zum Feiern? 🎁",
"พร้อมฉลองหรือยัง? 🎁",
"Sudah bersedia untuk meraikan? 🎁",
"Pronti a festeggiare? 🎁",
"Готовы поздравлять? 🎁",
"Kutlamaya hazır mısın? 🎁",
"هل أنت مستعد للاحتفال؟ 🎁",
"जश्न के लिए तैयार हैं? 🎁"
],
"plusStartedTitle": [
"🎁 {who}이 Plus를 시작했어요",
"🎁 {who} started Plus",
"🎁 {who}がPlusを始めました",
"🎁 {who}开通了 Plus",
"🎁 {who}開通了 Plus",
"🎁 {who} activó Plus",
"🎁 {who} assinou o Plus",
"🎁 {who} a activé Plus",
"🎁 {who} memulai Plus",
"🎁 {who} đã đăng ký Plus",
"🎁 {who} hat Plus gestartet",
"🎁 {who} เริ่มใช้ Plus แล้ว",
"🎁 {who} telah memulakan Plus",
"🎁 {who} ha attivato Plus",
"🎁 {who}: подписка Plus активна",
"🎁 {who} Plus’ı başlattı",
"🎁 فعّل {who} اشتراك Plus",
"🎁 {who} ने Plus शुरू किया"
],
"plusStartedBody": [
"이제 함께 사진을 올리고 앨범을 볼 수 있어요. 광고도 사라져요.",
"You can now add photos and use the album together — and ads are gone.",
"これからはふたりで写真を追加してアルバムを使えます。広告も表示されません。",
"现在你们可以一起上传照片、使用相册，广告也消失了。",
"現在你們可以一起上傳照片、使用相簿，廣告也消失了。",
"Ahora pueden subir fotos y usar el álbum juntos, y sin anuncios.",
"Agora vocês podem enviar fotos e usar o álbum juntos, sem anúncios.",
"Vous pouvez maintenant ajouter des photos et utiliser l’album ensemble, sans publicité.",
"Kini kalian bisa menambah foto dan memakai album bersama, tanpa iklan.",
"Giờ hai bạn có thể thêm ảnh, dùng album cùng nhau và không còn quảng cáo.",
"Ihr könnt jetzt gemeinsam Fotos hinzufügen und das Album nutzen – ohne Werbung.",
"ตอนนี้เพิ่มรูปและใช้อัลบั้มร่วมกันได้แล้ว และไม่มีโฆษณาอีกต่อไป",
"Kini anda boleh menambah foto dan menggunakan album bersama, tanpa iklan.",
"Ora potete aggiungere foto e usare l’album insieme, senza pubblicità.",
"Теперь вы вместе можете добавлять фото и пользоваться альбомом — без рекламы.",
"Artık birlikte fotoğraf ekleyip albümü kullanabilirsiniz; reklamlar da kalktı.",
"يمكنكما الآن إضافة الصور واستخدام الألبوم معًا، بلا إعلانات.",
"अब आप साथ में फ़ोटो जोड़ सकते हैं और एल्बम इस्तेमाल कर सकते हैं — बिना विज्ञापनों के।"
],
"billingIssueTitle": [
"⚠️ Plus 결제에 실패했어요",
"⚠️ Plus payment failed",
"⚠️ Plusの支払いに失敗しました",
"⚠️ Plus 扣款失败",
"⚠️ Plus 扣款失敗",
"⚠️ No se pudo cobrar Plus",
"⚠️ Falha no pagamento do Plus",
"⚠️ Échec du paiement de Plus",
"⚠️ Pembayaran Plus gagal",
"⚠️ Thanh toán Plus không thành công",
"⚠️ Plus-Zahlung fehlgeschlagen",
"⚠️ ชำระเงิน Plus ไม่สำเร็จ",
"⚠️ Pembayaran Plus gagal",
"⚠️ Pagamento di Plus non riuscito",
"⚠️ Не удалось оплатить Plus",
"⚠️ Plus ödemesi başarısız oldu",
"⚠️ تعذّر دفع اشتراك Plus",
"⚠️ Plus का भुगतान विफल रहा"
],
"billingIssueBody": [
"App Store 결제 정보를 확인해주세요. 확인하지 않으면 두 사람의 Plus 혜택이 곧 종료돼요.",
"Please check your App Store payment details, or Plus will soon end for both of you.",
"App Storeのお支払い情報をご確認ください。このままではふたりのPlus特典がまもなく終了します。",
"请检查 App Store 付款信息，否则你们两人的 Plus 权益即将结束。",
"請檢查 App Store 付款資訊，否則你們兩人的 Plus 權益即將結束。",
"Revisa tus datos de pago en App Store o Plus terminará pronto para ambos.",
"Verifique seus dados de pagamento na App Store, ou o Plus terminará em breve para vocês dois.",
"Vérifiez vos informations de paiement App Store, sinon Plus prendra bientôt fin pour vous deux.",
"Periksa info pembayaran App Store, atau Plus akan segera berakhir untuk kalian berdua.",
"Vui lòng kiểm tra thông tin thanh toán App Store, nếu không Plus của cả hai sẽ sớm kết thúc.",
"Bitte prüfe deine Zahlungsdaten im App Store, sonst endet Plus bald für euch beide.",
"โปรดตรวจสอบข้อมูลการชำระเงินใน App Store มิฉะนั้นสิทธิ์ Plus ของทั้งคู่จะสิ้นสุดเร็ว ๆ นี้",
"Sila semak maklumat pembayaran App Store, jika tidak Plus akan tamat tidak lama lagi untuk anda berdua.",
"Controlla i dati di pagamento dell’App Store, altrimenti Plus terminerà presto per entrambi.",
"Проверьте платёжные данные в App Store, иначе Plus скоро закончится для вас обоих.",
"App Store ödeme bilgilerini kontrol et; yoksa Plus ikiniz için de yakında sona erecek.",
"يرجى التحقق من معلومات الدفع في App Store، وإلا سينتهي Plus قريبًا لكليكما.",
"कृपया App Store की भुगतान जानकारी जांचें, वरना आप दोनों का Plus जल्द खत्म हो जाएगा।"
],
"plusExpiringTitle": [
"⏰ Plus가 {date}에 종료돼요",
"⏰ Plus ends on {date}",
"⏰ Plusは{date}に終了します",
"⏰ Plus 将于{date}到期",
"⏰ Plus 將於{date}到期",
"⏰ Plus termina el {date}",
"⏰ O Plus termina em {date}",
"⏰ Plus prend fin le {date}",
"⏰ Plus berakhir pada {date}",
"⏰ Plus sẽ kết thúc vào {date}",
"⏰ Plus endet am {date}",
"⏰ Plus จะสิ้นสุดในวันที่ {date}",
"⏰ Plus tamat pada {date}",
"⏰ Plus termina il {date}",
"⏰ Plus закончится {date}",
"⏰ Plus {date} tarihinde sona eriyor",
"⏰ ينتهي Plus في {date}",
"⏰ Plus {date} को समाप्त होगा"
],
"plusExpiringBody": [
"종료되면 두 사람 모두 새 사진 업로드와 광고 제거 혜택이 사라져요. 계속 쓰려면 구독을 다시 시작해주세요.",
"After that, new photo uploads and ad-free use end for both of you. Resubscribe to keep them.",
"終了するとふたりとも写真の追加と広告なしの特典がなくなります。続けるには再度ご登録ください。",
"到期后，你们两人都将无法上传新照片，也会出现广告。如需继续使用，请重新订阅。",
"到期後，你們兩人都將無法上傳新照片，也會出現廣告。如需繼續使用，請重新訂閱。",
"Después, ambos perderán la subida de fotos y el uso sin anuncios. Vuelve a suscribirte para conservarlos.",
"Depois disso, vocês dois perdem o envio de fotos e o uso sem anúncios. Assine de novo para manter.",
"Ensuite, l’ajout de photos et l’absence de publicité prendront fin pour vous deux. Réabonnez-vous pour les garder.",
"Setelah itu, unggah foto baru dan bebas iklan berakhir untuk kalian berdua. Berlangganan lagi untuk tetap menikmatinya.",
"Sau đó, cả hai sẽ không thể tải ảnh mới và sẽ thấy quảng cáo. Hãy đăng ký lại để tiếp tục.",
"Danach enden Foto-Uploads und werbefreie Nutzung für euch beide. Abonniere erneut, um sie zu behalten.",
"หลังจากนั้นทั้งคู่จะอัปโหลดรูปใหม่ไม่ได้และจะมีโฆษณา สมัครใหม่เพื่อใช้ต่อ",
"Selepas itu, muat naik foto baharu dan tanpa iklan tamat untuk anda berdua. Langgan semula untuk terus menikmatinya.",
"Dopo, il caricamento di foto e l’uso senza pubblicità termineranno per entrambi. Riabbonati per mantenerli.",
"После этого загрузка новых фото и отсутствие рекламы закончатся для вас обоих. Оформите подписку снова, чтобы сохранить их.",
"Sonrasında ikiniz için de yeni fotoğraf yükleme ve reklamsız kullanım sona erer. Devam etmek için yeniden abone ol.",
"بعدها سيتوقف رفع الصور الجديدة والاستخدام بلا إعلانات لكليكما. اشترك مجددًا للاحتفاظ بها.",
"इसके बाद आप दोनों के लिए नई फ़ोटो अपलोड और विज्ञापन-मुक्त अनुभव बंद हो जाएगा। जारी रखने के लिए फिर से सदस्यता लें।"
]
};
const CATALOG=Object.fromEntries(Object.entries(ROWS).map(([lang,row])=>[lang,{...Object.fromEntries(KEYS.map((k,i)=>[k,row[i]])),...Object.fromEntries(Object.entries(EXTRA).map(([k,texts])=>[k,texts[LANGUAGE_ORDER.indexOf(lang)]]))}]));
const LANGUAGES=Object.keys(CATALOG);
function resolveLanguage(value){
 if(typeof value!=='string')return 'en';if(CATALOG[value])return value;
 const lower=value.toLowerCase();
 if(lower.startsWith('zh'))return /hant|tw|hk|mo/.test(lower)?'zh-Hant':'zh-Hans';
 if(lower.startsWith('pt'))return 'pt-BR';
 const base=lower.split(/[-_]/)[0];return CATALOG[base]?base:'en';
}
const fill=(template,params)=>template.replace(/\{(\w+)\}/g,(_,k)=>params[k]??'');
// A calendar date (YYYY-MM-DD) is shown as is; a timestamp is shown in the device's time zone.
function formatDay(date,lang,at,timeZone){
 const options={month:'long',day:'numeric',calendar:'gregory',numberingSystem:'latn'};
 if(Number.isFinite(at)){try{return new Intl.DateTimeFormat(lang,{...options,timeZone:timeZone||'Asia/Seoul'}).format(new Date(at));}catch{return new Intl.DateTimeFormat(lang,{...options,timeZone:'Asia/Seoul'}).format(new Date(at));}}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';
 try{return new Intl.DateTimeFormat(lang,{...options,timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));}
 catch{return date.slice(5);}
}
// Names the app stores when a nickname is left empty; they read badly in a sentence ("나님"), so use the partner word.
const PLACEHOLDER_NAMES=new Set(['나','파트너']);
function preview(text,max=100){const value=String(text||'').replace(/\s+/g,' ').trim();return [...value].length>max?[...value].slice(0,max-1).join('')+'…':value;}
// kind: diary | like | comment | reply | connected | anniversary | days | years | birthday | plusStarted | billingIssue | plusExpiring
// when: today | tomorrow (reminders only)
function render(kind,{name,date,text,at,when,n,title,icon}={},language,timeZone){
 const lang=resolveLanguage(language),m=CATALOG[lang];let clean=typeof name==='string'?name.trim().slice(0,40):'';if(PLACEHOLDER_NAMES.has(clean))clean='';
 const who=clean?fill(m.who,{name:clean}):m.partner,params={who,date:formatDay(date,lang,at,timeZone),n:Number.isFinite(n)?new Intl.NumberFormat(lang,{numberingSystem:'latn'}).format(n):''};
 const soon=when==='tomorrow';
 if(kind==='anniversary'){const label=`${typeof icon==='string'&&icon?icon+' ':''}${String(title||'').trim().slice(0,80)}`;return {title:`${label} ${soon?'D-1':'D-day'}`,body:soon?m.soonBody:m.anniversaryTodayBody};}
 if(kind==='days')return {title:fill(soon?m.daysTomorrowTitle:m.daysTodayTitle,params),body:soon?m.soonBody:fill(m.daysTodayBody,params)};
 if(kind==='years')return {title:fill(soon?m.yearsTomorrowTitle:m.yearsTodayTitle,params),body:soon?m.soonBody:fill(m.yearsTodayBody,params)};
 if(kind==='birthday')return {title:fill(soon?m.birthdayTomorrowTitle:m.birthdayTodayTitle,params),body:soon?m.birthdayTomorrowBody:m.birthdayTodayBody};
 if(kind==='plusStarted')return {title:fill(m.plusStartedTitle,params),body:m.plusStartedBody};
 if(kind==='billingIssue')return {title:m.billingIssueTitle,body:m.billingIssueBody};
 if(kind==='plusExpiring')return {title:fill(m.plusExpiringTitle,params),body:m.plusExpiringBody};
 if(kind==='diary')return {title:fill(m.diaryTitle,params),body:fill(m.diaryBody,params)};
 if(kind==='like')return {title:fill(m.likeTitle,params),body:fill(m.likeBody,params)};
 if(kind==='comment'||kind==='reply')return {title:fill(m[kind+'Title'],params),body:preview(text)};
 if(kind==='connected')return {title:fill(m.connectedTitle,params),body:fill(m.connectedBody,params)};
 throw Error('Unknown push kind');
}
module.exports={render,resolveLanguage,LANGUAGES,KEYS,EXTRA_KEYS:Object.keys(EXTRA)};
