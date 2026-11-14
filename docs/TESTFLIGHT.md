# 첫 내부 TestFlight 빌드

- 앱: 우리의 공간 - 커플 다이어리 / 6834614043
- Bundle ID: com.interest.couplediary
- 버전: 1.0 / 빌드: 2026111401
- 서버: couple-diary-comino-staging (실제 운영 데이터 복사 없음)
- Cloud Functions: diary, accountDeletion 두 개만 배포. minInstances 0 / maxInstances 2. Scheduler·Apple 결제 서버는 배포하지 않음.
- 이메일/비밀번호 로그인과 Firestore·Storage 규칙 활성화. 실제 스테이징 테스트 계정 생성→초기화→공간 생성→일기 저장→멤버십 조회 성공.
- 월 10000 KRW 알림은 운영·스테이징 합산으로 업데이트. 스테이징 함수 빌드 이미지는 1일 정리 정책 적용.
- 광고: 공식 테스트 ID. 결제: 비활성. 이번 빌드는 텍스트 일기·커플 연결 등 기기 테스트용.
- Xcode archive 및 App Store Connect 업로드 성공. Apple SDK 광고 프레임워크 두 개의 dSYM 미포함 경고가 있었으나 업로드는 성공했다.

## 재빌드

`npm run build:staging` → `npx cap sync ios` → `node scripts/configure-ios.cjs` 순서로 구성한다. 일반 `ios:sync`는 기본 빌드이므로 TestFlight의 스테이징 설정을 재현하려면 반드시 staging 빌드를 쓴다.

첫 내부 테스트 배포에서는 functions/package.json의 main을 testflight.cjs로 사용한다. 결제 비밀과 스케줄 작업을 제외하기 위한 테스트 진입점이다. 전체 운영 서버를 배포하기 전 main을 index.cjs로 복원하고 출시 점검을 수행해야 한다.

검증한 아카이브: /private/tmp/couple-diary-testflight-staging.xcarchive
업로드 로그: /private/tmp/couple-diary-upload.log

임시 파일이 지워질 수 있으므로 재빌드는 위 순서와 새 CURRENT_PROJECT_VERSION으로 수행한다. App Store 공개 심사 제출은 하지 않았다.

## Apple 처리 결과

업로드와 Apple 처리가 완료되어 TestFlight에서 1.0 (2026111401)이 테스트 준비 완료로 표시되었다. COMINO Internal 그룹을 생성하고 이 빌드 1개를 연결했다. 향후 빌드 자동 배포는 껐다. 테스터는 아직 0명이며 누구에게도 초대하지 않았다. 설치용 초대에는 테스트할 Apple ID 이메일이 필요하다.

확인 화면: https://appstoreconnect.apple.com/teams/cd1d0f62-715b-4adf-94a8-8049396c984b/apps/6834614043/testflight/groups/3bb3de2c-1058-4d93-ac0b-099a84886ed6/builds

## 2026-11-14 — build 2026111402

- First launch opens four swipeable Korean onboarding pages before Firebase startup. Skip and existing-account login are available; completion persists locally.
- Fixed iOS email Auth initialization: `initializeAuth` with IndexedDB/local persistence, without popup redirect resolver. Firebase's default `getAuth` proactively awaits a web iframe on iOS even for password login. Actual browser SDK reproduction under an iPhone user agent: default blocked / email-only ready.
- Signup verification mail no longer blocks navigation. Auth requests return a helpful retry message after 25 seconds. Startup recovery buttons appear only after a delay or failure.
- Verified onboarding → signup → connect, logout → login → connect using local Auth/Functions emulators; staging real signup/create/save passed. Unit tests: 47 passed. Release archive/export/upload succeeded.
- Actual iPhone retry is still required; no iOS simulator runtime was installed on this Mac.
- Native AdMob app identifier now matches the verified account app. Official test banner/interstitial units remain enabled; actual app approval/store linkage is pending.
- Monthly IAP `com.interest.couplediary.plus.monthly` (Apple ID 6834702626), KRW 4,900; yearly `com.interest.couplediary.plus.yearly` (Apple ID 6834705789), KRW 39,900. Korean metadata and availability configured in existing group 22577704.
- User approved creation and Firebase storage of the IAP signing key. Private material remains outside source control, in staging Secret Manager; local one-time backup is owner-readable only.
- Staging `appleBilling` / `appleNotifications` deployed without Scheduler. Authenticated availability/account binding passed; forged JWS rejected. Sandbox notification URL saved. Apple test notification API initially returned 4040007 (URL not found); delivery not yet verified. Real StoreKit sandbox purchase/restore and subsequent photo upload still require device testing. App Store production charging requires review/release and a production backend.

App Store Connect confirmed build 1.0 (2026111402), build UUID `4269a7a0-dc06-4103-b089-cf5b90463cae`, as **Testing** in COMINO Internal with the existing 3 testers. No new testers were invited by the agent.

## 2026111402 실기기 오류 보고 후 정정

사용자가 1402에서 회원가입 `network-request-failed`를 보고했다. 실제 업로드 아카이브의 login/couple-connect JS에 외부 CDN Firebase Auth 모듈이 남는 빌드 결함을 확인했다. 현재 맥 소스에서 쿼리 문자열이 붙은 스크립트 변환을 수정하고 외부 SDK 잔존 검사를 빌드에 추가했다. 1402는 수정되지 않은 설치본이므로 정상 가입이 된다고 안내하면 안 된다. 수정 iOS 빌드는 아직 제작/업로드하지 않았으며 사용자 요청으로 추가 TestFlight 업로드를 보류한다. 로컬 검증 결과는 AUTH_UX_REVIEW.ko.md를 참조한다.

## 2026-11-14 — 2026111403 디자인·로그인 수정 재배포

- 밝은 표면·진한 시스템 타이포그래피·라즈베리 포인트와 간결한 카드/탐색 체계로 홈, 기록, 로그인/복구, 초대, 설정, Plus, 온보딩을 정리했다.
- 1402의 외부 Firebase 인증 모듈 혼용 결함을 수정했다. 1403 실제 아카이브에서 외부 SDK 잔존 검사를 통과했다.
- 검사 54개, 구문/빌드 검사, Release archive 및 App Store Connect 업로드 성공.
- 에뮬레이터가 아닌 스테이징 서버에 동일 배포 파일로 새 회원가입/연결 화면 진입 및 리뷰 계정 로그인/일기/댓글 조회를 검증했다. 실제 iPhone 재검증은 여전히 필요하다.
- build UUID: e7435559-7b1c-403a-8ef6-8a8fdfabe5b3. 기존 COMINO Internal 그룹을 대상으로 배포한다.
- 리뷰용 계정 2개는 스테이징에 생성하고 연결했으며 가상 일기 2개와 댓글 1개를 준비했다. 비밀번호는 저장소에 넣지 않는다.
- 이전 데이터 백업 작업은 실행하지 않았다.

App Store Connect에서 2026111403이 COMINO Internal(기존 테스터 3명) 그룹의 **테스트 중** 상태로 표시됨을 확인했다. 확인 화면은 `/private/tmp/couple-diary-testflight-2026111403.jpg`에 저장했다. 새로 테스터를 초대하지 않았다.
