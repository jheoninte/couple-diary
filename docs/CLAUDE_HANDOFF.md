# Claude 인수인계 — 2026-11-14

## 저장소 / 재개 위치

- 저장소: https://github.com/jheoninte/couple-diary
- 작업 브랜치: `codex/ios-foundation` (main에 병합하지 않음)
- 실제 프로젝트 경로: `/Users/jheoninte/Documents/ChatGPT/커플 다이어리 앱/couple-diary`
- 상위 폴더에도 별도 git이 있으므로 반드시 이 프로젝트 디렉터리에서 작업한다.
- 사용자 요청: 지금까지 작업을 GitHub에 저장하고, 이후 작업은 Claude에서 계속한다. 현지화를 완료했다고 간주하지 않는다.

## 마지막 실제 배포

- iOS Bundle ID: `com.interest.couplediary`, Apple Team `79978S7426`, App Store ID `6834614043`.
- TestFlight **1.0 (2026111403)**, COMINO Internal 기존 테스터 3명, 테스트 중 확인.
- Build UUID: `e7435559-7b1c-403a-8ef6-8a8fdfabe5b3`.
- 1403에는 디자인 개선·온보딩·로그인 SDK 수정·로그인 복구·초대 UX 개선이 포함됨. **현재 진행 중인 현지화는 포함되지 않음.**
- 1402는 로그인/가입 오류가 보고됨. `.js?v=...` 모듈을 Vite 변환기가 놓쳐 CDN Auth와 번들 Auth를 혼용하던 실제 배포 결함을 수정했다. `scripts/check-web-bundle.cjs`로 외부 Firebase SDK 잔존 시 빌드를 실패시킨다.
- 1403의 동일 웹 번들로 실제 스테이징 가입, 리뷰 계정 로그인, 공유 일기/댓글 읽기를 확인했다. 실제 iPhone에서 수정본의 검증 완료를 단정하지 않는다.

## 완료된 기본 구조

- Vite + HTML/JS/CSS + Capacitor iOS, StoreKit 2 로컬 플러그인 `DiaryStore.swift`.
- `design-refresh.css`: 흰색/진한 글자/라즈베리 포인트, 일기 중심 디자인.
- 첫 실행 4장 슬라이드 온보딩, 로그인/중복 가입/재설정 전용 화면/비밀번호 보기/지연 복구.
- 이메일 로그인은 `initializeAuth` + IndexedDB/local persistence, popup resolver 제외.
- 각자 Firebase 계정으로 공유 공간 연결. 16자리 무작위 초대 코드, 24시간/1회 사용. 코드 복사·공유, 기존 공간 자동 덮어쓰기 없음.
- 삭제 요청은 앱에서 재인증 후 접수. 접근 차단 후 COMINO가 수동 처리. 운영자 COMINO, 문의 cs@comino.app.
- 관련 문서: `AUTH_UX_REVIEW.ko.md`, `DESIGN_REFRESH.ko.md`, `ACCOUNT_DELETION.md`, `TESTFLIGHT.md`.

## Firebase / 결제 / 광고

- 운영: `couple-diary-75157`. 기존 사용자 데이터 마이그레이션·전체 운영 배포는 미완료.
- 스테이징: `couple-diary-comino-staging`. 현재 TestFlight는 이 서버를 사용한다.
- Functions 지역 Seoul `asia-northeast3`, Firestore/Storage 스테이징 Tokyo. `.firebaserc`, `ops/firebase-projects.json` 참고.
- 스테이징 배포 함수: `diary`, `accountDeletion`, `appleBilling`, `appleNotifications`. `functions/package.json` main은 `billing-enabled.cjs`, Scheduler 제외.
- Functions minInstances 0, maxInstances 2. 월 10,000원 예산 알림은 운영/스테이징 합산. 자동 지출 차단 아님.
- Plus: 월 4,900원 / 연 39,900원. App Store 상품 ID `com.interest.couplediary.plus.monthly` / `.yearly` 등록됨. 구독 검증은 현재 Sandbox.
- 구독 검증 키 생성·스테이징 Secret Manager 저장은 사용자가 승인함. 개인 키는 저장소에 없음.
- 실제 StoreKit 구매/복원·갱신/환불·사진 업로드의 실기기 검증은 남아 있음. Sandbox 알림 URL은 저장했으나 Apple 테스트 알림 API가 4040007을 반환해 전송 검증이 남음.
- AdMob 앱/광고 단위 소유권은 확인됨. 앱 스토어 미연결·심사 필요·송출 제한 상태라 공식 테스트 광고 유지. `native-config.js` 참고.
- 사진은 업로드 전 JPEG 긴 변 1440px, 목표 256KiB/상한 512KiB. 신규 사진은 구독 필요. 계정당 하루 6회/월 90회 예약 제한.
- 리뷰 계정 두 개는 스테이징에서 생성·연결·이메일 확인 처리했고 가상 일기 2개/댓글 1개가 있음. 비밀번호는 Git에 저장하지 않았으며 사용자에게 대화로 전달됨.

## 현지화 — 진행 중, 다음 작업 최우선

요청 언어는 한국어 포함 18개: ko, en, ja, zh-Hant, zh-Hans, es, pt-BR, fr, id, vi, de, th, ms, it, ru, tr, ar, hi. 미지원 시스템 언어는 영어로 fallback.

추가한 파일:
- `i18n-core.js`: 언어 해석, 번역 조회, DOM 텍스트/속성 적용, 사용자 콘텐츠 보호, lang/dir.
- `i18n.js`: 시스템 언어 기본값, `diary.language.v1` 기기 저장, 설정/첫 화면 선택기, MutationObserver.
- `locales/*.tsv`: 언어별 문구 원본. **열 순서**는 `scripts/build-locales.cjs`의 codes 배열과 같음. 중국어 TSV 열은 간체 → 번체이며 선택기 표시 순서와 다르니 주의.
- `npm run locales:build`: 174개 키 × 18개 언어의 `locales/catalogs.json` 재생성. 빌드 시 자동 실행.
- `tests/i18n.test.js`: 언어 해석·핵심 항목·사용자 작성 글 보호·RTL 기본 검사.

남은 작업:
1. 번역 전체 커버리지 미완료. 긴 안내, 오류/알림, 구독 상세·삭제 안내·법률 문서 등 미등록 문구가 한국어로 남는다. 언어팩에 누락되면 영어를 조회하지만 영어 키 자체가 없으면 원문이 남는 구조다.
2. 동적 날짜/시간/요일/숫자·구독 금액·만료일 문자열은 여전히 `ko-KR` 또는 한국어 템플릿을 쓰는 곳이 있다. 검색해서 `Intl` 기반으로 정리해야 한다. 사용자 작성 일기/댓글/닉네임은 번역하거나 바꾸지 않는다.
3. 언어 변경 시 모든 선택기의 선택값/‘시스템 언어’ 옵션 문구 동기화, 기기 언어 변경/저장 실패 fallback, 초기 Auth 메일 언어 적용 순서 검증 필요.
4. 아랍어 RTL CSS는 기초만 추가함. 긴 독일어/러시아어, 태국어, 아랍어 화면·입력·온보딩 스크롤·접근성 실검증 필요. 온보딩의 슬라이드 이동은 LTR 유지 의도.
5. iOS 앱 메타데이터/시스템 권한 문구(InfoPlist.strings 등) 현지화는 아직 안 함.
6. 현지화 작업의 브라우저 E2E QA/새 네이티브 빌드/배포는 아직 안 함. 현지화를 1403에서 확인하려고 하면 안 된다.
7. DOM 번역 전략을 유지할 경우 사용자 콘텐츠 보호 셀렉터를 확장 검토할 것. 안전한 명시적 `data-i18n`/키 기반 적용으로 점진 이관하는 것도 검토할 수 있다.

## 실행 / 검증

Node 22 권장 (`.nvmrc`). 루트와 functions에서 각각 `npm ci`.

```sh
npm run check
npm test
npm run build:staging
npm run dev
```

로컬 앱: `http://127.0.0.1:5173/index.html?emulator=1`.
기존 에뮬레이터가 켜져 있으면 중복 실행하지 않는다. Auth 9099, Firestore 8080, Storage 9199, Functions 5001, Hosting 5500. Vite 5173, 빌드 preview 5174가 남아 있을 수 있다.

스테이징 iOS 동기화 순서:
```sh
npm run build:staging
node node_modules/@capacitor/cli/bin/capacitor sync ios
node scripts/configure-ios.cjs
```

`npm run ios:sync` 기본값은 일반 build이므로 스테이징 목적에 그대로 사용하지 말 것. 기기 포함 웹 파일은 ignored 산출물이며 마지막 동기화는 1403 때다.

`.env.staging`, `functions/.env.couple-diary-comino-staging`, CLI 로그인, Secret Manager, 로컬 개인 키/리뷰 비밀번호는 Git 제외. 같은 맥에는 기존 설정이 남아 있지만 다른 컴퓨터에서는 Firebase 공개 SDK 설정과 권한 있는 로그인/시크릿 구성을 복구해야 한다. `.env.example`과 운영 문서 참고.

최종 커밋 직전 `npm test`와 `npm run build:staging` 결과는 이 인수인계 저장 작업에서 확인한다. 실패를 숨기거나 현지화 완료로 표시하지 않는다. 사용자는 백업에 시간·토큰을 쓰지 말라고 요청했다. 이번 작업에서 신규 백업을 실행하지 않았다.

## 현지화 진행 현황 (Claude 세션 업데이트)

완료 아님. 지역화는 계속 미완료로 취급합니다.

- 18개 언어 카탈로그: `locales/*.tsv` → `locales/catalogs.json` (444 keys × 18). `npm run locales:build`
- 날짜·숫자·가격은 `Intl` 기반 `fmt` 헬퍼 사용 (그레고리력·라틴 숫자). 언어 변경 시 `diaryUI.relocale()` 호출.
- 공휴일 이름, 구독/결제 문구, 로그인/연결/동기화 메시지 번역 추가.
- `npm run locales:coverage`: 미번역 문자열 검사. `tests/i18n-catalog.test.js`가 placeholder 보존과 커버리지를 검증.
- `npm test`: 63/63 통과 (functions/ 에서 `npm ci` 필요).

### 남은 일
1. privacy/terms/licenses 법적 문서(36개 문자열)는 기계번역하지 않음 → 사람/법무 검수 필요. terms·licenses는 언어 전환 UI 없음.
2. 모든 번역은 원어민 검수 필요 (특히 th, ms, hi, ar).
3. 아랍어 RTL 및 긴 문장 레이아웃 QA.
4. iOS InfoPlist.strings 현지화.
5. Auth 메일 언어 우선순위, functions/ 서버 오류 메시지.
6. 브라우저 E2E QA와 네이티브 빌드 (이 세션에서는 `.env.staging` 부재로 `build:staging` 미실행).
7. 보호 셀렉터 확장 또는 명시적 키 전환.

TestFlight 1403에는 현지화가 포함되어 있지 않습니다. main 머지/백업/푸시는 하지 않았습니다.

## 출시 준비 업데이트 (2026-11-14 저녁)

- 개인정보 처리방침/이용약관은 앱에 포함하지 않고 https://www.comino.app/girl-privacy , https://www.comino.app/girl-service 로 연결. `privacy.html`, `terms.html` 삭제. `licenses.html`(공휴일 데이터 CC BY-SA 고지)은 유지.
- 18개 언어는 모두 제공하되 ko/ja/en만 품질 확보 대상이며 나머지는 임시 번역(다음 업데이트에서 검수).
- `scripts/configure-ios.cjs`가 ko/en/ja `InfoPlist.strings`(앱 이름, 추적 허용 문구)와 `CFBundleLocalizations`를 설정. 앱 이름: 한국어 우리의 공간(유지), 일본어 今日のふたり, 영어 Our Diary로 확정. 다른 언어 번역(Our Space 계열)은 다음 업데이트에서 이름을 맞출 것. App Store Connect 표기와 맞는지 확인.
- `scripts/release-ios.sh`: Mac에서 실행하는 운영 빌드·아카이브·TestFlight 업로드. 운영 Firebase(couple-diary-75157) + AdMob 실광고(`VITE_ADMOB_LIVE_ADS=true`). 서버 배포·심사 제출은 하지 않음. 빌드 후 스테이징 설정/실광고 ID 포함 여부를 점검.
- 심사 제출 전 사람이 확인할 것: 운영 Functions(`functions/package.json` main=billing-enabled.cjs)/appleBilling/규칙/인덱스 배포 상태, 실기기 StoreKit Sandbox 구매·복원, App Store Connect의 약관(EULA) 링크, IAP 심사 제출 상태.

## 현지화 업데이트 (2026-11-14, Claude 이어서)

- 서버(Cloud Functions) 사용자 노출 오류 39개를 `locales/messages-server.tsv`로 18개 언어 추가 (483 keys). 서버 코드는 그대로 두고 클라이언트 DOM 번역기가 `error.message`를 조회한다. `deletion-worker.cjs`(관리자 전용)·`legacy-migration.cjs`(내부 오류→일반 메시지)는 제외.
- `npm run locales:coverage`가 `functions/*.cjs`의 `fail/DomainError/HttpsError` 한국어 메시지도 검사한다.
- 언어 선택기 버그 수정: `<option>`이 번역 보호 대상이라 '시스템 언어 사용' 문구가 첫 언어로 고정되고 `#languageSelect`만 값이 동기화되던 문제. `i18n.js`의 `syncPickers()`가 모든 `[data-language-picker]`를 갱신. `tests/i18n-picker.test.js` 추가.
- `npm test` 64/64, `npm run build:staging` 통과. 로컬 Vite에서 de/ar 전환 시 선택기·RTL 확인 (에뮬레이터 없이 온보딩 화면만).
- 남은 일 목록의 5번 중 '서버 오류 메시지'는 처리됨. Auth 메일 언어는 `firebase-config.js`에서 `auth.languageCode`를 언어 변경 이벤트로 갱신하는 것을 확인했으나 실제 메일 수신 검증은 안 함.
- 참고: `i18n` 청크가 약 770kB(전체 18개 언어 카탈로그 포함). 언어별 지연 로딩은 미착수.
