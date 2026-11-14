const fs=require('node:fs');const errors=[];
for(const p of ['ios/App/App.xcodeproj/project.pbxproj','ios/App/App/DiaryStore.swift','functions/index.cjs'])if(!fs.existsSync(p))errors.push('Missing '+p);
for(const p of ['privacy.html','terms.html'])if(!fs.existsSync(p)||/data-release-status="draft"/.test(fs.readFileSync(p,'utf8')))errors.push(p+' 정책 확정 필요');
errors.push('실기기 StoreKit Sandbox 구매·복원·갱신·환불 및 TestFlight 검증 기록 필요');
errors.push('AdMob 실광고 단위·동의 메시지·app-ads.txt와 App Store 개인정보 신고 확인 필요');
errors.push('계정 삭제 운영 절차·백업 삭제 확인 및 기존 데이터 이전·사진 토큰 철회 검증 필요');
console.error(errors.join('\n'));process.exitCode=1;
