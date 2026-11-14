# 복구 전 iOS 출시 준비 진단

**이 문서는 복구 전 상태를 기록한 초기 진단입니다. 최신 구현·검증 결과는 [WEB_STATUS](WEB_STATUS.md)를 참고하세요.**

확인일: 2026-11-14 · 기준: `main` / `622f5a6`

## 소스 구조

- HTML/CSS와 모듈 JavaScript로 구성된 웹앱이며 Vite로 번들링하고 Capacitor로 iOS에 탑재하는 구성이다.
- Firebase Authentication은 이메일/비밀번호 가입·로그인·재설정을 담당한다.
- `diary-api.js`와 `firebase-sync.js`는 Firestore 실시간 조회, 사진 Storage, `diary` callable 기반 쓰기를 처리한다. 서버 리전은 `firebase-config.js`에서 지정한다.
- `app-ui.js`는 달력, 일기, 기분, 댓글, 기념일, 사진, 검색과 초안 UI를 담당한다.
- `monetization.js`는 Plus 화면과 구독 상태를, `native-billing.js`는 Apple 구매·복원·서버 검증 연결을 담당한다.
- `native-bridge.js`에는 사용자 정의 `DiaryStore` 플러그인과 AdMob 동의·광고 연동 인터페이스가 있다. 인터페이스 존재는 네이티브 구현 완료를 의미하지 않는다.

## 출시를 막는 확인된 누락

| 항목 | 확인 내용 | 영향 |
|---|---|---|
| 서버 | `functions/`가 없음 | `diary`, `appleBilling` 서버 구현·검증·재배포 불가. 현재 운영 배포 여부는 확인하지 않음 |
| 네이티브 | `ios/`와 `DiaryStore` Swift 구현이 없음 | Xcode 앱 빌드와 실제 StoreKit 구매 불가 |
| 빌드 입력 | `privacy.html`, `terms.html`이 없음 | Vite가 참조하는 엔트리가 누락됨. 의존성 설치 후 빌드 실행은 아직 하지 않음 |
| 실행 도구 | `scripts/`가 없음 | dev, check, emulator, iOS 설정·출시 점검 명령의 실행 파일 누락 |
| 검증 | `tests/`가 없음 | README에 기재된 회귀·에뮬레이터 검증을 재현할 수 없음 |
| 운영 정책 | 계정 영구 삭제 구현을 찾지 못함. 개인정보 처리방침과 데이터 보관 정책 미완성 | 데이터 삭제 범위·구독 관계·운영 절차를 정하고 구현·검증해야 함 |
| 문서 | README가 링크하는 기존 `docs/`, `audit/` 문서가 없음 | 이전 완료 범위와 잔여 사양의 근거 복구 필요 |

전체 원격 브랜치 목록에는 `main`만 있었다. 가져온 전체 Git 이력에서 `functions`, `scripts`, `tests`, `ios`, `privacy.html`, `terms.html` 경로의 커밋을 찾지 못했다. 따라서 GitHub 밖에 보관된 최신 작업본이 있는지 먼저 확인하는 편이 좋다.

Firestore 규칙은 클라이언트 쓰기를 차단하고 서버 검증에 의존한다. 누락된 서버를 우회하기 위해 클라이언트 쓰기를 허용하는 방향으로 변경하면 안 된다.

## 실행한 검증

- 저장소 복제 완료. 작업 파일 변경 전 기준 Git 상태는 깨끗함.
- `npm test`: 종료 코드 0이나 테스트 0개. 통과 근거로 사용 불가.
- `npm run check`: `scripts/check.cjs` 누락으로 실패.
- `npm run ios:release-check`: `scripts/release-check.cjs` 누락으로 실패.
- 로컬 환경: Node.js 26.13.1, npm 11.20.0, Xcode 27.2 / 27B52.
- Java 런타임 없음. README의 에뮬레이터 요구 환경은 Node.js 22와 Java 21 이상.
- 의존성 설치, 웹 빌드, 시뮬레이터 실행, 운영 Firebase 조회·변경, App Store Connect 조회·변경은 수행하지 않음.

## 후속 작업 순서

1. **최신 원본 복구:** 별도 작업본에서 서버·스크립트·테스트·iOS·정책 문서를 확보하고 기존 코드와 비교한다. 원본이 없다면 서버 API 계약부터 재구현 범위를 정한다.
2. **재현 가능한 개발 환경:** Node 버전과 잠금 파일 기준 의존성 설치, 누락 엔트리 해결, 웹 빌드와 실제 테스트 실행을 복구한다. 운영과 분리된 Firebase 스테이징을 사용한다.
3. **iOS 앱 구성:** Capacitor 프로젝트, 서명·번들 ID, 앱 아이콘·시작 화면, 안전 영역·키보드·사진 선택·외부 링크 동작을 구현하고 시뮬레이터와 실제 iPhone에서 확인한다.
4. **구독 완성:** `DiaryStore` StoreKit 구현과 서버 서명 검증·갱신·취소·환불 반영을 연결한다. 구매, 복원, 보류 거래, 계정 전환, 커플 연결 해제의 권한 처리를 Sandbox에서 검증한다.
5. **개인정보와 운영:** 계정 삭제, 기록·사진·백업 보관 정책, 개인정보 처리방침, 문의 경로를 완성한다. 광고 동의·사용 SDK의 개인정보 항목과 제출 시점 Apple 요구사항을 공식 문서로 재확인한다.
6. **출시 검증:** 두 계정 연결부터 저장·사진·구독·해제·삭제까지 통합 검증하고 TestFlight 검증 후 스토어 메타데이터·스크린샷·심사 정보를 준비한다.

번들 ID와 Apple·광고 식별자는 현재 소스의 설정값일 뿐이며, 계정 소유권·등록 상태·승인 상태는 별도로 확인해야 한다. 현재 `testAds`는 `true`이다.
