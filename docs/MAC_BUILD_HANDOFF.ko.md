# Mac 빌드 인수인계 — 2026-11-20

작업 브랜치: `codex/post-launch-improvements`. `main`에는 아직 병합하지 않았다.

## 포함된 변경

- 초기 로딩: 영어 fallback과 선택한 언어만 로드한다. 16개 언어는 각각 별도 청크로 생성한다. 초기 정적 JavaScript는 온보딩 약 94%, 로그인 약 60% 감소했다. 일본어는 약 56 kB 추가 로드한다. [측정과 한계](LOADING_PERFORMANCE.ko.md).
- 무료 전면 광고: 첫 무료 상태 확인 후 48시간 보호, 새 일기 3개마다, 최소 24시간 간격·하루 1회·세션 1회. 앱 사용 2분 이후, 저장 후 30초~10분 사이의 직접적인 기록 ↔ 앨범 전환만 검토한다. 준비되지 않았거나 전환 후 1초를 넘기면 건너뛴다. 수정·재저장·저장 직후·앱 시작/복귀에는 표시하지 않는다.
- 무료 배너: 기록·작성·앨범 하단 탭 위에 표준 모바일 배너 하나를 유지한다. 입력·키보드·팝업·설정·결제·백그라운드 중에는 숨긴다. 빈 앨범과 초기 로딩 화면에서는 제외한다. Plus·구독 상태 미확인·동의 미확인 시 광고를 표시하지 않는다. [정책 상세](MONETIZATION.ko.md).
- 사진 유료 권한과 업로드 제한은 유지했다. 일본 스토어 페이지는 수정하지 않았다. ‘오늘 한 줄 + 감정’ UX는 제안만 했으며 구현하지 않았다.

## Mac에서 가져와 아카이브

기존 프로젝트 디렉터리에서 실행한다. 커밋하지 않은 Mac 작업은 먼저 보존한 뒤 브랜치를 전환한다. 최신 Node 22를 권장한다(`registerHooks` 테스트에 Node 22.15 이상 필요).

```sh
git fetch origin
git switch codex/post-launch-improvements
git pull --ff-only
nvm install 22
nvm use 22
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer bash scripts/release-ios.sh --no-upload
```

기존 릴리스 스크립트는 의존성 설치·테스트·운영 웹 빌드·Capacitor 동기화·iOS 설정 생성·Xcode 아카이브를 실행한다. `--no-upload`는 결과를 로컬로 내보내고 App Store Connect에 업로드하지 않는다. `build/ios/`에 산출물이 생성된다. Xcode 로그인과 서명 권한이 필요하며, 업로드까지 하려면 사용자가 의도적으로 `--no-upload`를 빼고 실행한다.

이 스크립트는 `VITE_ADMOB_LIVE_ADS=true`로 **실광고 ID**를 선택한다. 기기에서 개발 검증할 때는 Google 테스트 ID를 쓰는 아래 경로를 사용한다.

```sh
npm ci
npm --prefix functions ci
npm run ios:sync
npm run ios:open
```

테스트 광고를 사용하려면 셸과 `.env*`의 `VITE_ADMOB_LIVE_ADS`가 `true`로 설정되지 않았는지 확인한다. 두 빌드 경로 모두 기본 Firebase 대상은 운영 프로젝트이므로, 운영 기록을 변경하는 테스트는 피하고 별도 스테이징 설정을 사용할 수 있다.

## AdMob 콘솔 확인 결과

2026-11-20 로그인된 콘솔에서 다음 ID가 코드와 일치함을 확인했다.

- 앱: `ca-app-pub-6762072012517736~9647026272`
- 배너 `couplediary_ios_banner`: `ca-app-pub-6762072012517736/2402961079`
- 전면 `couplediary_ios_interstitial`: `ca-app-pub-6762072012517736/7387869458`
- App Store ID: `6834614043` 연결됨.

앱 상태는 **심사 필요·광고 송출 제한**이다. 인증 화면은 app-ads.txt의 정보가 AdMob 계정 정보와 일치하지 않는다고 표시했다. 스토어에 등록된 개발자 웹사이트의 `/app-ads.txt`에 아래 항목을 정확히 게시하고 AdMob에서 다시 확인해야 한다. 이 작업에서는 웹사이트 게시나 콘솔 설정 변경을 수행하지 않았다.

```text
google.com, pub-6762072012517736, DIRECT, f08c47fec0942fa0
```

콘솔의 앱·전면 광고 단위 빈도 상한은 모두 ‘없음’이다. 새 제한은 앱 코드에서 적용한다. 계정 상단에는 AdSense 지급 계정 확인 필요 알림도 있었다.

Windows에서 웹 테스트·빌드까지 검증했다. iOS 아카이브·실제 기기의 배너 위치/키보드/전면 광고 닫기/Plus 전환·운영 배포는 수행하지 않았다.
