# 푸시 알림

## 보내는 알림

| 상황 | 받는 사람 | 한국어 문구 (제목 / 본문) | 설정 토글 |
|---|---|---|---|
| 상대방이 새 일기 작성 | 상대방 | 💌 {이름}님의 일기가 도착했어요 / 11월 15일, 어떤 하루였는지 읽어보세요. | 상대방의 새 일기 |
| 내 일기에 하트 | 일기 작성자 | ❤️ {이름}님이 내 일기에 공감했어요 / 11월 15일의 일기를 다시 열어보세요. | 하트·댓글 |
| 내 일기에 댓글 | 일기 작성자 | 💬 {이름}님이 댓글을 남겼어요 / (댓글 앞 100자) | 하트·댓글 |
| 내 댓글에 작성자가 답글 | 댓글 단 상대방 | 💬 {이름}님이 답글을 남겼어요 / (답글 앞 100자) | 하트·댓글 |
| 초대 코드로 연결 완료 | 초대한 사람 | 🎉 연인과 연결되었어요 / 이제 둘만의 일기장을 함께 채워가요. | 항상 |

- 이름은 상대방이 `나의 공간`에 설정한 닉네임. 없으면 "연인"(en: Your partner, ja: パートナー).
- 일기 본문은 잠금 화면 노출을 막기 위해 알림에 넣지 않는다. 댓글은 미리보기를 넣는다(iOS의 "미리보기 표시" 설정을 따름).
- 중복 방지: 일기 알림은 일기당 1회(수정·삭제·복원 시 재발송 없음, `announcedAt`). 하트는 사람·일기당 1회(`likeNotified`), 같은 일기의 알림은 `apns-collapse-id`로 합쳐짐. 같은 일기의 반응은 `thread-id`로 묶임.
- 문구는 기기가 등록한 앱 언어로 서버에서 만든다(`functions/push-messages.cjs`, 18개 언어; ko/en/ja 외는 임시 번역).
- 알림을 누르면 앱이 열리고 해당 날짜의 일기로 이동한다. 연결 해제된 공간·보관함의 알림은 무시.

## 구조

- 서버: `diary` 함수의 `saveEntry`/`like`/`commentAdd`/`join`이 트랜잭션 커밋 후 이벤트를 넘기고 `functions/push.cjs`가 APNs(HTTP/2, .p8 토큰 인증)로 직접 보낸다. 외부 SDK 없음. 발송 실패는 사용자의 저장을 실패시키지 않는다.
- 토큰: `pushDevices/{uid}`(최대 5대), `pushTokens/{sha256}`(기기에서 다른 계정으로 로그인 시 이전 계정에서 제거). 서버 전용(Firestore 규칙 기본 거부). 410/BadDeviceToken 응답 시 자동 삭제. 로그아웃·계정 삭제 시 삭제.
- 설정: `users/{uid}.notify = {diary, reactions}` (`pushPrefs` 액션).
- iOS: `ios/App/App/DiaryPush.swift`(권한·토큰·탭), `AppDelegate`가 알림 델리게이트와 토큰 콜백 연결, `App.entitlements`의 `aps-environment`.
- 웹: `push-client.js`. 앱 실행 때는 시스템 권한 창을 띄우지 않는다(ATT 팝업과 겹치지 않도록). **첫 일기 저장 직후** 한 번 안내 모달 → "알림 받기"를 누르면 시스템 권한 창. 이후에는 `나의 공간 > 알림`에서 켜기/설정 열기.

## 켜는 방법 (사람이 해야 하는 일)

1. Apple Developer > Identifiers > `com.interest.couplediary` 에서 **Push Notifications** capability 활성화 (Xcode 자동 서명이면 빌드 시 자동 반영될 수 있음).
2. Apple Developer > Keys 에서 **APNs** 키(.p8) 생성. 기존 App Store Connect API 키와는 별개. Key ID 기록.
3. 시크릿 저장 (프로젝트별):
   ```sh
   firebase functions:secrets:set APNS_AUTH_KEY --data-file AuthKey_XXXXXXXXXX.p8 --project couple-diary-comino-staging
   ```
4. `functions/.env.<프로젝트>`에 `PUSH_ENABLED=true`, `APNS_KEY_ID=<Key ID>` 추가 후 `firebase deploy --only functions:diary`.
5. iOS: `npm run build:staging` → `cap sync ios` → `node scripts/configure-ios.cjs` → 실기기 빌드. 개발 빌드는 sandbox, TestFlight/App Store는 production APNs로 자동 구분.

`PUSH_ENABLED`가 없거나 false면 토큰 등록만 되고 발송은 하지 않는다(배포가 시크릿 없이도 깨지지 않음).

## 검증 상태

- 단위 테스트: `tests/push.test.cjs`(이벤트 생성·중복 방지·설정·토큰 이동·18개 언어·APNs JWT 서명), `tests/push-client.test.js`(권한 흐름·탭 라우팅).
- **실기기 수신, APNs 실제 발송, Xcode 빌드는 아직 검증하지 않았다.**

## 추가 제안 (미구현)

1. **기념일 알림** — 기념일 전날 저녁/당일 아침, 100일·N주년 등 자동 D-day. 둘 다에게. (Scheduler 함수 필요; 현재 베타 배포에서 Scheduler 제외 중)
2. **"오늘은 내 차례" 리마인더** — 상대방은 오늘 썼는데 나는 아직 안 썼을 때 밤 9시경 1회: "💌 {이름}님은 오늘 일기를 썼어요. 당신의 하루도 들려주세요." 상대 일기를 근거로 하므로 일반 리마인더보다 덜 귀찮다. 기본 꺼짐 또는 하루 최대 1회.
3. **1년 전 오늘** — 1년 전 같은 날 둘 중 누군가 쓴 일기가 있으면 아침에: "📖 1년 전 오늘, 우리는 이런 하루를 보냈어요." (앱의 추억 기능과 연결)
4. **Plus 구독 상태** — 결제 갱신 실패(빌링 재시도)·만료 임박 시 결제한 사람에게, 상대방이 Plus를 시작하면 "상대방 덕분에 Plus 혜택이 열렸어요". Apple 서버 알림(`appleNotifications`)에서 바로 연결 가능.
5. 연결 해제 알림은 **권장하지 않음**(민감한 상황에서 푸시는 상처가 될 수 있음).
