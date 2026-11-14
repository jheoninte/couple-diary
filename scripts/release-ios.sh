#!/usr/bin/env bash
# Production iOS release build + TestFlight upload. Run on the Mac, from the repo root:
#   scripts/release-ios.sh            # build, archive, upload to App Store Connect
#   scripts/release-ios.sh --no-upload  # build and archive only
# Never deploys Firebase. Does not submit for App Review.
set -euo pipefail
cd "$(dirname "$0")/.."

[[ "$(uname)" == "Darwin" ]] || { echo "macOS에서만 실행할 수 있습니다."; exit 1; }
command -v xcodebuild >/dev/null || { echo "Xcode가 필요합니다."; exit 1; }
UPLOAD=1; [[ "${1:-}" == "--no-upload" ]] && UPLOAD=0

BRANCH=$(git branch --show-current)
echo "== 브랜치: $BRANCH"
[[ -z "$(git status --porcelain)" ]] || { echo "커밋되지 않은 변경이 있습니다. 먼저 정리하세요."; git status --short; exit 1; }
git pull --ff-only

echo "== 의존성 설치 및 테스트"
npm ci
(cd functions && npm ci)
npm test

echo "== 운영 설정 웹 빌드 (AdMob 실광고 ON, Firebase 운영 프로젝트)"
unset VITE_FIREBASE_TARGET VITE_FIREBASE_PROJECT_ID
VITE_ADMOB_LIVE_ADS=true npm run build

echo "== 빌드 산출물 점검"
if grep -rq "couple-diary-comino-staging" dist; then echo "오류: 스테이징 프로젝트가 번들에 포함되어 있습니다."; exit 1; fi
grep -rq "couple-diary-75157" dist || { echo "오류: 운영 프로젝트 설정이 번들에 없습니다."; exit 1; }
grep -rq "ca-app-pub-6762072012517736/2402961079" dist || { echo "오류: 실광고 배너 단위가 번들에 없습니다."; exit 1; }
if grep -rq "ca-app-pub-3940256099942544" dist; then echo "경고: 번들에 Google 테스트 광고 ID 문자열이 있습니다. 실제 사용 여부를 확인하세요."; fi

echo "== iOS 동기화"
npx cap sync ios
node scripts/configure-ios.cjs

PBX=ios/App/App.xcodeproj/project.pbxproj
BUILD=$(date +%Y%m%d%H)
sed -i '' -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = $BUILD;/" "$PBX"
echo "== 빌드 번호: $BUILD"

OUT=build/ios; rm -rf "$OUT"; mkdir -p "$OUT"
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>teamID</key><string>79978S7426</string>
<key>destination</key><string>$([[ $UPLOAD == 1 ]] && echo upload || echo export)</string>
<key>signingStyle</key><string>automatic</string>
<key>uploadSymbols</key><true/>
</dict></plist>
PLIST

echo "== Archive"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/App.xcarchive" \
  -allowProvisioningUpdates archive

echo "== Export / Upload"
xcodebuild -exportArchive -archivePath "$OUT/App.xcarchive" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export" -allowProvisioningUpdates

echo "완료: 빌드 $BUILD. App Store Connect에서 처리 상태를 확인하세요."
git checkout -- "$PBX" 2>/dev/null || true
