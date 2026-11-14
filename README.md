# 우리의 공간 · 커플 다이어리 웹

각자 계정으로 연결해 일기·기분·사진·댓글·기념일을 공유하는 웹앱입니다. 2026-11-14 웹 안정화 작업에서 저장 구조와 권한 검증을 다시 구성했습니다. iOS 프로젝트는 아직 추가하지 않았습니다.

**현재 변경은 로컬 구현과 에뮬레이터 검증 단계이며 운영 사이트에는 배포하지 않았습니다.** 새 화면은 Cloud Functions와 새 규칙이 필요하므로 HTML만 GitHub Pages에 올리면 동작하지 않습니다.

- 변경 사항과 후속 사양: [docs/WEB_STATUS.md](docs/WEB_STATUS.md)
- 광고·구독 요금 및 미연결 항목: [docs/MONETIZATION.ko.md](docs/MONETIZATION.ko.md). 월 2,900원·연 24,900원 요금 안내와 사진 권한 검사는 반영했으나 실제 PG·광고 송출은 아직 연결되지 않았습니다. PG 연결 전 운영 배포하지 않습니다.
- 설치·배포·기존 데이터 이전: [FIREBASE_GUIDE.md](FIREBASE_GUIDE.md)
- 최초 진단(수정 전 기준): [audit/REVIEW.ko.md](audit/REVIEW.ko.md)

## 개발과 검증

Node.js 22와 Java 21 이상이 필요합니다. 개발용 에뮬레이터는 실제 Firebase 프로젝트와 분리된 `demo-couple-diary`만 사용합니다.

```powershell
npm ci
npm --prefix functions ci
npm test
npm run check
npm run test:emulator
```

브라우저로 시험하려면 `npm run emulators` 실행 후 아래 주소를 엽니다.

```text
http://127.0.0.1:5000/login.html?emulator=1
```

에뮬레이터 테스트를 이미 실행 중인 서버에 연결하려면 `node --test tests/emulator.cjs`를 사용합니다. `npm run test:emulator`는 에뮬레이터가 꺼진 상태에서 시작하는 명령입니다. 계정·기록은 테스트용이며 운영 계정을 사용하지 않습니다.

이 작업 환경에는 `.tools/java`에 테스트용 JRE가 준비되어 있으며 실행 스크립트가 우선 사용합니다. 다른 환경에서는 Java 21을 설치하고 `JAVA_HOME`을 설정하세요. 첫 실행에는 Firebase 에뮬레이터 다운로드가 필요합니다.

## 구성

| 파일 | 역할 |
|---|---|
| `index.html`, `app-ui.js`, `web-improvements.css` | 기존 화면, 안전한 렌더링, 날짜·초안·사진 편집 |
| `firebase-config.js` | Firebase 연결과 로컬 에뮬레이터 전환 |
| `firebase-sync.js`, `diary-api.js` | 인증, 실시간 조회, 저장 상태, 서버 명령 |
| `login.js`, `couple-connect.js` | 가입·로그인·초대·연결 해제·보관함 |
| `functions/service.cjs` | 트랜잭션과 작성자·버전 검증 |
| `functions/index.cjs` | 인증된 callable, 이전 작업, 사진 토큰 철회·재시도 |
| `firestore.rules`, `storage.rules` | 회원·보관함·사진 접근 제한 |
| `tests` | 회귀 검사와 Firebase 에뮬레이터 통합 검사 |

일기는 `couples/{id}/entries/{uid}_{date}` 문서로 나눴습니다. 댓글은 안정적인 ID를 가지며 해당 일기 트랜잭션에서 갱신합니다. 문서 크기를 제한하기 위해 일기 20,000자, 사진 3장, 댓글 200개/각 1,000자, 기념일 30개로 제한합니다.

공휴일은 2025–2035년 데이터를 포함합니다. `npm run update:holidays`로 다시 생성할 수 있으며 임시공휴일·선거일은 정부 발표에 맞춰 별도 갱신해야 합니다. 데이터 출처와 라이선스는 [licenses.html](licenses.html)에 있습니다.
