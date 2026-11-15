# 홈 화면 날씨

- 위치: `우리의 기록` 상단(기존 인트로 카드 자리, 높이 약 1/3). 달력은 항상 월 전체 표시(주간 토글 삭제).
- 내 날씨: iOS 16+에서 Apple WeatherKit(`ios/App/App/DiaryWeather.swift`). **"📍 내 지역 날씨 보기"를 누를 때만** 위치 권한 요청, 대략적 위치(`kCLLocationAccuracyReduced`, `NSLocationDefaultAccuracyReduced`). 거절하면 도시 이름 직접 입력(눌러서 변경, 비우면 현재 위치). 30분 캐시. iOS 15·웹은 내 날씨 없음.
- 상대방 날씨: 기기가 요약(아이콘·기온·최고/최저·도시)만 `weather` 액션으로 공유 → `couples/{id}.weather[uid]`. 6시간 지나면 숨김. `나의 공간 > 날씨`에서 끄면 즉시 삭제, 이후 전송 안 함(`users/{uid}.shareWeather`).
- 일기: 오늘 날짜 일기를 처음 저장할 때 3시간 이내 날씨를 `entry.weather {icon,temp}`로 기록, 수정해도 유지. 카드 날짜 옆 표시.
- 단위: 기기 지역이 미국 등이면 °F, 그 외 °C(서버는 °C 저장).
- Apple 표기: 날씨가 보일 때 " Weather" 마크(가능하면 WeatherKit 제공 이미지)와 법적 고지 링크.

## 출시 전 사람이 할 일
1. Apple Developer > Identifiers > `com.interest.couplediary` 에서 **WeatherKit**을 Capabilities와 **App Services** 두 탭 모두에서 체크. (안 하면 아카이브 서명 실패)
2. App Store Connect > 앱 개인정보: **대략적 위치**(앱 기능, 사용자와 연결 안 됨) 추가.
3. 개인정보 처리방침 게시본에 날씨 항목 반영(`docs/PRIVACY_POLICY.ko.md`).
4. 서버 `diary` 함수 배포(스테이징/운영) 후 TestFlight 빌드.

## 검증 상태
단위 테스트(`tests/weather.test.js`)만. Swift 컴파일·실기기 위치/WeatherKit 호출은 미검증.
