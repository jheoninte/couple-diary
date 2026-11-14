# Firebase 개발·배포 준비 가이드

2026-11-14 복구본. **현재 운영 배포 금지:** 계정 삭제 운영·정책 확정·기존 데이터 이전·실기기 결제 검증이 남아 있다. 이 문서는 배포 명령을 자동 실행하지 않는다.

## 로컬

Node 22, Java 21 이상, Xcode(macOS iOS 빌드)를 설치한다.

```sh
npm ci
npm --prefix functions ci
npm test
npm run check
npm run build
npm run test:emulator
npm run emulators
```

에뮬레이터는 `demo-couple-diary`로만 실행한다. 웹 주소는 `http://127.0.0.1:5500/login.html?emulator=1`이다. 5000번은 macOS의 기존 서비스와 충돌할 수 있어 5500번을 쓴다. 환경에 따라 `JAVA_HOME`과 `PATH`를 Java 21·Node 22에 맞춘다. 처음에는 에뮬레이터 다운로드가 필요하다. 테스트는 실제 Firebase 계정을 사용하지 않는다. 웹 소스를 수정한 후에는 에뮬레이터 실행 전 `npm run build`로 dist를 갱신한다.

## 스테이징

1. 운영과 분리된 프로젝트에 이메일/비밀번호 Auth, Firestore, Storage, Cloud Functions를 준비하고 결제 플랜과 예산 알림을 확인한다. Functions 리전은 `asia-northeast3`이다.
2. `.env.example`을 참고해 `.env.staging`에 해당 스테이징 프로젝트의 공개 설정을 넣고 `npm run build:staging`으로 빌드한다. 알려진 운영 설정을 재사용하면 빌드가 거부된다. 현재 운영 공개 식별자를 자격증명으로 오해하거나 Admin 비밀키를 앱에 넣지 않는다.
3. Hosting은 `dist/`만 제공한다. 서버·테스트·로그·키 파일이 정적 사이트에 노출되지 않게 한다. GitHub Pages에 HTML만 올리는 방식은 새 서버 명령을 제공하지 않는다.
4. Firestore/Storage 규칙, entries 복합 인덱스, photoReservations collection-group 만료 인덱스가 필요하다. Storage 규칙의 Firestore 조회 권한을 Firebase 콘솔에서 승인해야 할 수 있다.
5. `storage.cors.json`을 스테이징·운영 웹 도메인에 맞추고 버킷 CORS에 적용한다. iOS `capacitor://localhost`를 포함한다. 모든 출처 허용으로 넓히지 않는다.
6. 기본 minInstances 0·maxInstances 2, 매시간 정리 작업이다. Scheduler·Functions·Storage·Firestore 비용, 오류와 정리 적체 로그에 알림을 설정한다.

검증을 마친 뒤 사용자가 배포 대상을 확인하고 실행하는 명령:

```sh
npx firebase deploy --project STAGING_PROJECT_ID --only functions,firestore,storage
npx firebase deploy --project STAGING_PROJECT_ID --only hosting
```

## Apple 구독 서버

`functions/.env.example`의 공개 설정을 참고해 배포 대상별 `.env.PROJECT_ID`를 준비한다. `.env*`는 저장소에서 제외한다. `APPLE_BILLING_ENABLED=false`가 기본이다.

- Sandbox: `APPLE_ENVIRONMENT=Sandbox`. 운영: Production과 정확한 APPLE_APP_ID.
- APPLE_ISSUER_ID, APPLE_KEY_ID는 App Store Connect에서 확인한다. APPLE_PRIVATE_KEY는 Firebase Secret Manager에 넣는다. 로컬 테스트용 비밀은 Git에서 제외된 `functions/.secret.local`에만 둔다.
- 비밀키가 연결된 callable을 배포하기 전에 Secret Manager 자원을 준비해야 한다. 키가 없으면 결제 endpoint 배포를 진행하지 않는다.
- 루트 인증서는 Apple 공식 `AppleRootCA-G3.cer`를 포함했다. 앱·상품·환경·계정 token 검증을 우회하지 않는다.
- App Store Connect의 월/연 상품을 같은 구독 그룹에 등록하고 한국 가격을 4,900/39,900원으로 설정한다. 실제 지원 가격·승인 상태는 콘솔에서 확인한다.
- App Store Server Notifications V2 URL은 배포된 `appleNotifications` endpoint로 지정한다. Sandbox와 Production은 별도 스테이징 프로젝트에서 운영한다.
- 거래는 Apple 서버 최신 상태를 확인해 권한 저장 후 기기에서 finish한다. 다른 앱 계정의 거래는 소유권 이전 없이 보류한다.

## 기존 운영 기록

앱 initialize는 여전히 기존 스키마를 자동 덮어쓰지 않는다. 이제 관리자 전용 커플 백업·검증·별도 테스트 프로젝트 복구·v1→v2 이전 CLI가 있다. 먼저 원본 전체 백업과 쓰기 점검을 확보하고 스테이징에서 검증한다. 실제 운영에서는 아직 실행하지 않았다. [백업·이전·예산 운영 절차](docs/FIREBASE_OPERATIONS.md)를 따른다.

[구현·검증과 남은 일](docs/WEB_STATUS.md) · [광고·비용 제어](docs/MONETIZATION.ko.md)

## 계정 삭제 운영

앱 내 접수 callable `accountDeletion`과 접근 차단 규칙이 추가되었다. 실제 삭제는 관리자 전용 CLI로 수동 처리하며 [계정 삭제 운영 절차](docs/ACCOUNT_DELETION.md)를 따른다. 기존 `cleanupPhotos` 작업이 완료 후 30일 지난 차단 표식·접수 상태도 제한된 양씩 정리한다. 추가 상시 서버나 메일 서비스는 사용하지 않는다. 운영자가 매일 요청을 확인해야 한다.
