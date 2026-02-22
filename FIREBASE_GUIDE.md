# 🔥 Firebase 연동 완료 가이드

## 📦 파일 목록

지금까지 만든 파일 4개를 GitHub에 업로드하세요:

1. **index.html** (기존 파일 - 그대로 유지)
2. **login.html** (새로 만든 로그인 페이지)
3. **firebase-config.js** (Firebase 설정 파일)
4. **firebase-sync.js** (Firebase 동기화 스크립트)

---

## 📤 GitHub 업로드 방법

1. https://github.com/jheoninte/couple-diary 접속
2. `Add file` → `Upload files` 클릭
3. 다음 3개 파일을 드래그:
   - `login.html`
   - `firebase-config.js`
   - `firebase-sync.js`
4. Commit message: `Add Firebase integration`
5. `Commit changes` 클릭

---

## ✏️ index.html 수정

`index.html` 파일을 열어서 `<script>` 태그 **바로 앞**에 다음을 추가하세요:

### 추가할 위치:
`</body>` 태그 바로 위, `<script>` 태그 바로 앞

### 추가할 코드:
```html
    <!-- Firebase SDK -->
    <script type="module" src="firebase-sync.js"></script>
    
    <script>
```

**전체 구조 예시:**
```html
    <!-- 확인 팝업 모달 -->
    <div class="confirm-modal" id="confirmModal">
        ...
    </div>

    <!-- Firebase SDK -->
    <script type="module" src="firebase-sync.js"></script>

    <script>
        // 전역 변수
        let currentDate = new Date();
        ...
    </script>
</body>
</html>
```

---

## 🔒 Firebase 보안 규칙 설정

Firebase Console에서 보안 규칙을 설정해야 합니다!

### 1. Firestore 보안 규칙

1. https://console.firebase.google.com 접속
2. 프로젝트 선택: `couple-diary-75157`
3. 좌측 메뉴: `Firestore Database`
4. 상단 탭: `규칙` 또는 `Rules`
5. 다음 규칙으로 변경:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

6. `게시` 또는 `Publish` 클릭

**설명**: 로그인한 사용자만 자신의 데이터에 접근 가능

---

### 2. Storage 보안 규칙

1. 좌측 메뉴: `Storage`
2. 상단 탭: `규칙` 또는 `Rules`
3. 다음 규칙으로 변경:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{userId}/{filename} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

4. `게시` 또는 `Publish` 클릭

**설명**: 로그인한 사용자만 자신의 사진 업로드/다운로드/삭제 가능

---

## 🧪 테스트 방법

### 1단계: 한 분이 회원가입

1. https://jheoninte.github.io/couple-diary/login.html 접속
2. **회원가입** 탭 클릭
3. 이메일과 비밀번호 입력 (예: `couple@example.com` / `password123`)
4. **회원가입** 클릭
5. 자동으로 `index.html`로 이동
6. 일기를 몇 개 작성해보세요

### 2단계: 다른 분도 같은 계정으로 로그인

1. **다른 기기**나 **다른 브라우저**에서 접속
2. https://jheoninte.github.io/couple-diary/login.html
3. **같은 이메일과 비밀번호**로 로그인
4. 첫 번째 사람이 쓴 일기가 보여야 합니다! ✨

### 3단계: 실시간 동기화 테스트

1. 두 기기를 나란히 놓고
2. 한쪽에서 일기 작성
3. 다른 쪽에서 자동으로 업데이트되는지 확인!

---

## ✅ 작동하는 기능

- ✅ 로그인/회원가입
- ✅ 로그인 안 하면 메인 페이지 접근 불가
- ✅ 일기 실시간 동기화
- ✅ 사진 Firebase Storage 업로드
- ✅ 댓글, 좋아요, 기념일 모두 동기화
- ✅ 설정(테마, 아이콘) 동기화
- ✅ 로그아웃 버튼 (우측 상단 🚪)

---

## 🎯 주요 변경사항

### Before (기존):
- localStorage에 데이터 저장
- 각자의 브라우저에만 저장
- 서로 볼 수 없음

### After (Firebase):
- Firebase Firestore에 데이터 저장
- 실시간 동기화
- 같은 계정으로 로그인하면 같은 데이터 공유!

---

## ⚠️ 중요 사항

### 같은 계정 공유
- **한 분이 회원가입**
- **다른 분은 같은 계정으로 로그인**
- 이렇게 해야 같은 데이터를 볼 수 있습니다!

### 보안
- 이메일과 비밀번호는 두 분만 아는 것으로 설정
- 절대 다른 사람에게 공유하지 마세요

---

## 🐛 문제 해결

### 로그인 후 빈 화면만 보이는 경우
1. F12 키를 눌러 개발자 도구 열기
2. Console 탭에서 에러 메시지 확인
3. 에러 메시지를 알려주세요

### "permission-denied" 에러
- Firebase 보안 규칙이 제대로 설정되었는지 확인
- 위의 "Firebase 보안 규칙 설정" 부분 다시 확인

### 실시간 동기화가 안 되는 경우
- 두 분 모두 같은 계정으로 로그인했는지 확인
- 새로고침(F5) 해보세요

---

## 📞 도움이 필요하면

에러 메시지나 문제 상황을 스크린샷으로 보내주세요!
브라우저 콘솔(F12)의 에러 메시지도 함께 보내주시면 더 빠르게 해결할 수 있습니다.

---

## 🎉 완성!

이제 두 분이 어디서든 같은 다이어리를 공유할 수 있습니다!
사랑스러운 추억을 함께 기록하세요! 💕
