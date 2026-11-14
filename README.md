> **Claude 인수인계:** 현재 작업은 `codex/ios-foundation` 브랜치에 있습니다. 마지막 TestFlight는 2026111403이며, 다국어 현지화는 진행 중입니다. 재개 전 [인수인계 문서](docs/CLAUDE_HANDOFF.md)를 읽어주세요.

# 우리의 공간 · 커플 다이어리

각자 이메일 계정으로 연결해 일기·기분·댓글·기념일을 공유하는 앱입니다. Vite 웹앱을 Capacitor iOS 프로젝트에 포함합니다.

- 무료: 텍스트 기록, 기존 사진 조회. iOS에서는 동의 상태와 빈도 제한을 적용한 배너·전면 광고.
- **우리의 공간 Plus**: 월 **4,900원**, 연 **39,900원**. 한 명이 구독하면 현재 연결된 두 사람에게 사진 업로드·앨범·광고 제거를 제공합니다. 실제 결제 금액은 App Store 상품 가격을 표시합니다.
- 사진: 기기에서 긴 변 1,440px·목표 256KiB·최대 512KiB로 압축. 1인 일 6회·월 90회 업로드 예약, 일기당 최대 3장.

**현재는 로컬 개발 복구본이며 운영 배포·App Store 제출을 하지 않았습니다.** Apple 서버 키·상품 등록과 실기기 검증 전에는 결제가 비활성입니다. 광고는 Google 공식 테스트 ID를 사용합니다. 정책 페이지는 초안입니다. 계정 삭제는 앱 내 접수 후 COMINO가 수동 처리하며 [운영 절차](docs/ACCOUNT_DELETION.md)를 따릅니다.

## 실행

Node.js 22와 Java 21 이상을 준비합니다. `.nvmrc`는 22입니다.

```sh
npm ci
npm --prefix functions ci
npm test
npm run check
npm run build
npm run test:emulator
```

로컬 앱: `npm run build` 후 `npm run emulators`를 실행하고 `http://127.0.0.1:5500/login.html?emulator=1`에 접속합니다. 반드시 `?emulator=1`을 유지하세요. 해당 플래그 없이 실행한 앱은 현재 소스에 설정된 실제 Firebase 프로젝트를 사용합니다. 에뮬레이터는 `demo-couple-diary`를 사용합니다.

```sh
npm run ios:sync
npm run ios:open
npm run ios:release-check
```

macOS와 Xcode가 필요합니다. iOS 프로젝트가 처음부터 있으므로 `cap add ios`를 다시 실행할 필요는 없습니다. `ios:release-check`는 아직 남아 있는 출시 요건을 표시하고 실패합니다.

상세 구현·검증 결과: [WEB_STATUS](docs/WEB_STATUS.md) · 배포 준비: [Firebase 가이드](FIREBASE_GUIDE.md) · 광고·구독·비용: [MONETIZATION](docs/MONETIZATION.ko.md).

스테이징 빌드는 `.env.staging`의 별도 공개 설정과 `npm run build:staging`을 사용합니다. 운영 백업·이전과 사용자가 정한 월 10,000원 예산 알림 준비는 [Firebase 운영 절차](docs/FIREBASE_OPERATIONS.md)를 참고하세요. 실제 클라우드 적용은 계정 연결 후 진행합니다.
