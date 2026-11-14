# 상용 출시(App Store 심사 제출) 준비 점검

최초 점검 2026-11-14 · 같은 날 운영 전환 작업 반영

## 현재 상태

코드·서버 쪽 출시 차단 항목은 처리했다. 남은 것은 **실기기 검증, App Store Connect 입력, 개인정보 처리방침·약관 교체(사용자가 별도 작성 예정)**이다.

- 🧑‍💻 코드 · 👤 사용자(콘솔/결정) · 📱 실기기

## 처리 완료 (2026-11-14)

### 운영 서버 전환 — 운영 프로젝트 `couple-diary-75157` 사용
- 선택 이유: 출시 스크립트·네이티브 기본 설정·운영 문서가 이미 운영 프로젝트를 가리키고, 스테이징을 운영으로 쓰면 개발/운영 분리가 사라진다.
- Functions(Seoul `asia-northeast3`) `diary`, `accountDeletion`, `appleBilling`, `appleNotifications` 배포. 진입점 `billing-enabled.cjs`(Scheduler 정리 작업 제외 — 스테이징과 동일).
- Firestore 규칙·인덱스, Storage 규칙 배포. Cloud Run/Eventarc 등 필요한 API는 배포 시 활성화됨. 함수 이미지 1일 정리 정책 적용.
- `APPLE_PRIVATE_KEY`를 스테이징 Secret Manager에서 운영으로 복사(값은 출력·저장하지 않음). `functions/.env.couple-diary-75157`(Git 제외): `APPLE_ENVIRONMENT=Production`, 결제 활성.
- 기존 구 스키마 커플 1쌍(`couple_1774401459601`, 일기 11·사진 1): 점검 상태 백업 → 검증 → 미리보기 → v2 이전 완료. 백업 `.backups/before-migration-couple_1774401459601`(Git 제외, 개인정보 — 7일 내 정리 권장). 예전 웹 호스팅은 이미 내려가 있어 쓰기 중인 구 클라이언트 없음.
- 운영 실검증: 리뷰 계정 로그인 → 이메일 인증됨 → 연결 확인 → 일기 2개·댓글 1개 규칙 통과 조회 → 멤버십 조회 → `appleBilling` availability = true.

### 구독 결제 (심사자 Sandbox 결제 허용)
- 운영 서버는 Production으로 먼저 검증하고 Apple이 환경 불일치(INVALID_ENVIRONMENT)를 알릴 때만 Sandbox로 재검증한다. 위조 서명 등 다른 실패는 재시도하지 않는다. 스테이징(Sandbox) 서버는 Production 거래를 받지 않는다.
- 거래별 환경을 구독 체인에 저장해 상태 조회(`getAllSubscriptionStatuses`)·복원도 같은 환경 API를 쓴다. 서버 알림도 같은 방식.
- 테스트: `tests/billing.test.cjs`에 3개 추가.

### 카메라·앨범
- 사진 영역에 **사진 찍기**(카메라 바로 실행)와 **앨범에서 선택**(시스템 사진 선택기, 최대 3장) 버튼. 둘 다 Plus 확인을 거쳐 기존 JPEG 재인코딩(EXIF/GPS 제거) 경로로 처리.
- `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` 추가(ko 기본, ko/en/ja 현지화). `scripts/configure-ios.cjs`가 동기화 때마다 적용.

### 광고 추적(ATT)
- 순서: 광고 동의(UMP) → ATT 팝업 → 광고 SDK 초기화. `ads-tracking.js`.
- 이미 결정된 경우(UMP의 IDFA 안내가 먼저 물은 경우 포함) 다시 묻지 않음. 앱이 화면에 보일 때까지 기다린 뒤 요청하고, iOS가 비활성 상태라 요청을 무시하면 1회 재시도. 실패해도 일기·광고는 막히지 않음(거부 시 비개인화 광고).
- 설정의 "광고 개인정보 설정"에서 동의를 바꾼 뒤에도 미결정이면 요청.
- 팝업은 무료 사용자가 로그인해 멤버십이 확인된 뒤(광고가 실제로 나갈 때) 뜬다. Plus 사용자에게는 뜨지 않는다.
- 테스트: `tests/ads-tracking.test.js` 5개.

### iPhone 전용
- `TARGETED_DEVICE_FAMILY = 1`, iPad 방향 설정 제거. 빌드 결과 `UIDeviceFamily = [1]` 확인. iPad 스크린샷 불필요.

### 리뷰 계정 (운영)
- `reviewer.20261114@comino.app`(민서), `reviewer.partner.20261114@comino.app`(지우). 이메일 인증, 서로 연결, 샘플 일기 2개·댓글 1개.
- 실제 서버 API로 생성: `REVIEW_PASSWORD_A=… REVIEW_PASSWORD_B=… node scripts/provision-review-accounts.mjs --project couple-diary-75157` (재실행 안전, 비밀번호는 저장소에 없음).

## 남은 일

### 👤 App Store Connect
- [ ] **App Store 서버 알림 — Production URL:** `https://asia-northeast3-couple-diary-75157.cloudfunctions.net/appleNotifications` (앱 정보 → App Store 서버 알림). Sandbox URL은 스테이징 그대로 둬도 된다.
- [ ] App Review 정보: 리뷰 계정 1개(민서)를 로그인 정보로, 메모에 "파트너 계정(지우)과 이미 연결됨. 초대 코드 흐름은 새 계정 가입 후 확인 가능. Plus는 Sandbox 구매로 확인 가능"과 파트너 계정 정보를 적는다.
- [ ] 첫 구독 2개를 앱 버전과 함께 제출(버전 페이지 "앱 내 구입 및 구독"), 구독별 심사용 스크린샷·현지화.
- [ ] 유료 앱 계약·세금·은행 정보 활성.
- [ ] 개인정보 라벨: 이메일, 사용자 콘텐츠(일기·사진·댓글), 사용자 ID, 기기 ID(추적 허용 시), 구매 내역, 광고 데이터. 추적 "예"(AdMob).
- [ ] 스크린샷 iPhone 6.9"(ko/ja/en), 설명·키워드·지원 URL, 연령 등급, EU 배포 시 DSA 판매자 상태.
- [ ] 개인정보 처리방침·이용약관 URL을 이 앱용 문서로 교체(사용자 작성 예정). 현재 링크는 게임용 일본어 공통 문서.

### 📱 실기기 (운영 빌드)
- [ ] 첫 실행 → 가입 → 이메일 인증 → 일기장 생성 → 초대 → 연결 → 저장.
- [ ] 광고 동의 → **ATT 팝업 표시** → 배너/전면, Plus 구매 후 광고 사라짐.
- [ ] Sandbox 계정으로 월/연 구매·복원 → Plus 반영 → **사진 찍기**(카메라 권한 팝업)·**앨범에서 선택**·업로드.
- [ ] 계정 삭제 접수, ko/ja/en 화면.

### 남은 개선(출시 후 가능)
- Scheduler 정리 작업(만료 초대·미부착 사진) 운영 배포 — 현재 제외. 사용량이 늘면 Storage에 남는 미부착 사진이 쌓일 수 있음.
- 빌드 번호 규칙 통일(`release-ios.sh` 시 단위 vs 이전 `YYYYMMDDNN`).
- App Check, i18n 번들 분할, 15개 언어 원어민 검수, 앱 `PrivacyInfo.xcprivacy`.
- 운영 Storage는 US-CENTRAL1(이전 설정 유지) — 처리방침 국외 이전 항목에 기재 필요.

## 확인 결과
- `npm test` 72/72, `npm run check`, 운영 빌드(`VITE_ADMOB_LIVE_ADS=true npm run build`: 스테이징 설정 없음·실광고 ID 포함), `cap sync ios` + `configure-ios`, Release 시뮬레이터 빌드 성공.
- 실기기·실결제·실광고 팝업은 아직 확인하지 않았다(이 Mac에서 실행 불가).
