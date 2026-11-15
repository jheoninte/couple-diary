# 푸시 알림

## 보내는 알림

| 상황 | 받는 사람 | 한국어 문구 (제목 / 본문) | 설정 토글 |
|---|---|---|---|
| 상대방이 새 일기 작성 | 상대방 | 💌 {이름}님의 일기가 도착했어요 / 11월 15일, 어떤 하루였는지 읽어보세요. | 상대방의 새 일기 |
| 내 일기에 하트 | 일기 작성자 | ❤️ {이름}님이 내 일기에 공감했어요 / 11월 15일의 일기를 다시 열어보세요. | 하트·댓글 |
| 내 일기에 댓글 | 일기 작성자 | 💬 {이름}님이 댓글을 남겼어요 / (댓글 앞 100자) | 하트·댓글 |
| 내 댓글에 작성자가 답글 | 댓글 단 상대방 | 💬 {이름}님이 답글을 남겼어요 / (답글 앞 100자) | 하트·댓글 |
| 초대 코드로 연결 완료 | 초대한 사람 | 🎉 연인과 연결되었어요 / 이제 둘만의 일기장을 함께 채워가요. | 항상 |
| 기념일 (직접 등록) | 두 사람 | 전날 20시: ✈️ 첫 여행 D-1 / 특별한 하루가 내일이에요. 미리 마음을 준비해보세요. · 당일 9시: ✈️ 첫 여행 D-day / 오늘이에요! 둘만의 특별한 하루를 일기에 남겨보세요. | 기념일·생일 |
| 100일 단위 | 두 사람 | 💕 내일은 함께한 지 300일 · 💕 함께한 지 300일 / 오늘은 함께한 지 300일째 되는 날이에요. 축하해요! | 기념일·생일 |
| N주년 (사귄 날 기준) | 두 사람 | 💍 내일은 2주년 · 💍 함께한 지 2주년 / 오늘은 우리의 2주년이에요. 축하해요! | 기념일·생일 |
| 생일 | 상대방만 | 🎂 내일은 지수님의 생일이에요 / 축하할 준비 됐나요? 🎁 · 🎂 오늘은 지수님의 생일이에요 / 따뜻한 축하 한마디를 남겨보세요. | 기념일·생일 |
| 상대방이 Plus 구독 시작 | 상대방 | 🎁 민준님이 Plus를 시작했어요 / 이제 함께 사진을 올리고 앨범을 볼 수 있어요. 광고도 사라져요. | 항상 |
| 구독 갱신 결제 실패 | 결제한 사람 | ⚠️ Plus 결제에 실패했어요 / App Store 결제 정보를 확인해주세요. 확인하지 않으면 두 사람의 Plus 혜택이 곧 종료돼요. | 항상 |
| 자동 갱신 꺼짐 + 종료 3일 전 | 결제한 사람 | ⏰ Plus가 11월 18일에 종료돼요 / 종료되면 두 사람 모두 새 사진 업로드와 광고 제거 혜택이 사라져요. … | 항상 |

- 이름은 상대방이 `나의 공간`에 설정한 닉네임. 없거나 기본값("나")이면 "연인"(en: Your partner, ja: パートナー).
- 날짜 알림은 **각자의 기기 시간대** 기준 전날 20시·당일 9시. 시간대는 알림 등록 때 기기에서 받아 공간 문서(`timeZones`)에 저장, 없으면 Asia/Seoul. 사귄 날이 1일째(앱과 동일), 2월 29일은 평년에 2월 28일.
- 생년월일은 `나의 공간 > 내 생일`(선택). 전체 날짜는 본인 `users/{uid}.birthDate`에만, 공간 문서(`birthdays`)에는 월-일만 저장. 비우면 삭제.
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

## 날짜·구독 알림 구조

- `pushReminders`(매시 정각, UTC): 활성 공간을 300개씩 읽어 `functions/reminders.cjs`로 대상 계산. 같은 알림은 `pushLog/{키}`(`create` 선점, 7일 후 삭제)로 재시도 시에도 1회만.
- 비용: 시간당 활성 공간 수만큼 문서 읽기(공간 1,000개 기준 월 약 72만 회). Cloud Scheduler 작업 1개.
- Plus 시작: `applyTransaction`에서 공간의 Plus가 꺼짐→켜짐으로 바뀐 경우에만 상대방에게. 갱신 실패: Apple `DID_FAIL_TO_RENEW`. 자동 갱신 해제: `DID_CHANGE_RENEWAL_STATUS`로 `billingAccounts/{uid}.autoRenewOff` 저장 → 종료 3일 이내 진입 시 1회.
- `appleBilling`, `appleNotifications`, `pushReminders`도 `APNS_AUTH_KEY` 시크릿을 쓴다(`PUSH_ENABLED=true`일 때만). `pushReminders`는 그때만 배포된다.

## 켜는 방법 (사람이 해야 하는 일)

1. Apple Developer > Identifiers > `com.interest.couplediary` 에서 **Push Notifications** capability 활성화 (Xcode 자동 서명이면 빌드 시 자동 반영될 수 있음).
2. Apple Developer > Keys 에서 **APNs** 키(.p8) 생성. 기존 App Store Connect API 키와는 별개. Key ID 기록.
3. 시크릿 저장 (프로젝트별):
   ```sh
   firebase functions:secrets:set APNS_AUTH_KEY --data-file AuthKey_XXXXXXXXXX.p8 --project couple-diary-comino-staging
   ```
4. `functions/.env.<프로젝트>`에 `PUSH_ENABLED=true`, `APNS_KEY_ID=<Key ID>` 추가 후 `firebase deploy --only functions` (Cloud Scheduler API 사용 설정 필요).
5. iOS: `npm run build:staging` → `cap sync ios` → `node scripts/configure-ios.cjs` → 실기기 빌드. 개발 빌드는 sandbox, TestFlight/App Store는 production APNs로 자동 구분.

`PUSH_ENABLED`가 없거나 false면 토큰 등록만 되고 발송은 하지 않는다(배포가 시크릿 없이도 깨지지 않음).

## 검증 상태

- 단위 테스트: `tests/reminders.test.cjs`(날짜 계산·시간대·생일·저장), `tests/push.test.cjs`(이벤트 생성·중복 방지·설정·토큰 이동·18개 언어·APNs JWT 서명), `tests/push-client.test.js`(권한 흐름·탭 라우팅).
- **실기기 수신, APNs 실제 발송, Xcode 빌드는 아직 검증하지 않았다.**

## 제외하기로 한 것

- 내가 안 쓴 날 리마인더: 상대방 일기 알림으로 충분하고 부담스러울 수 있어 제외.
- 1년 전 오늘, 연결 해제 알림: 제외.
