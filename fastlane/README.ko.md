# fastlane — iOS 배포 자동화

## 처음 한 번
1. App Store Connect API 키(`AuthKey_XXXX.p8`)를 `~/.appstore-keys/` 에 둡니다. 프로젝트 폴더에는 넣지 않습니다.
2. `cp fastlane/.env.example fastlane/.env` 후 `ASC_KEY_ID`, `ASC_ISSUER_ID` 를 채웁니다.
3. 연결 확인: `fastlane ios check`

## 명령
| 명령 | 하는 일 |
|---|---|
| `fastlane ios check` | 키 연결 확인 (빌드 없음) |
| `fastlane ios beta` | 웹 빌드 → `cap sync ios` → 서명·빌드 → TestFlight 업로드 |
| `fastlane ios release` | 같은 빌드를 App Store 심사용으로 업로드. 심사 제출은 직접 |

- 빌드 번호는 기존 규칙(YYYYMMDD+2자리 순번, 예: 2026111403)대로 자동 설정됩니다.
- 서명은 자동 서명(Xcode 로그인 없이 API 키로 인증서·프로비저닝 갱신)입니다.
- `release` 는 `native-config.js` 의 `testAds` 가 `true` 이면 멈춥니다.
- `ios/` 폴더가 없으면 `npx cap add ios` 로 새로 만듭니다.
