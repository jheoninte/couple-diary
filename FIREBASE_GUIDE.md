# 웹 v2 Firebase 설정·이전·배포 가이드

이 문서는 2026-11-14 웹 수정본용입니다. 예전의 자기 `users` 문서만 허용하는 규칙과 단일 커플 문서 저장 방식은 더 이상 사용하지 않습니다. 이번 작업에서는 운영 서버에 배포하거나 운영 계정·기록을 변경하지 않았습니다.

**구독 준비본 주의:** 현재 새 사진은 서버가 확인한 Plus 구독에만 허용됩니다. 토스 PG·실제 결제 발급 경로·광고 계정은 아직 연결되지 않았고 결제 버튼은 비활성화되어 있습니다. 이 상태로 운영 배포하면 신규 사진을 결제해 해금할 수 없으므로, [광고·구독 준비 상태](docs/MONETIZATION.ko.md)의 PG 연결 작업을 먼저 완료하세요. 무료 텍스트와 기존 사진 조회는 유지됩니다.

## 1. 로컬 격리 검증

Node.js 22 및 Java 21 이상을 준비하고 다음을 실행합니다.

```powershell
npm ci
npm --prefix functions ci
npm test
npm run check
npm run test:emulator
```

브라우저 점검: `npm run emulators`를 실행한 뒤 `http://127.0.0.1:5000/login.html?emulator=1`에서 테스트 계정을 만듭니다. 이때만 `firebase-config.js`가 `demo-couple-diary`와 로컬 에뮬레이터를 사용합니다. 실제 계정이나 실제 프로젝트 데이터는 사용하지 않습니다.

에뮬레이터 밖에서 `npm run dev`로 정적 파일만 제공할 수도 있지만, **`?emulator=1` 없이 접속하면 설정된 실제 Firebase 프로젝트를 가리킵니다.** 운영 데이터 테스트용으로 사용하지 마세요.

## 2. 별도 스테이징 준비

1. 운영과 분리된 Firebase 프로젝트에서 Authentication 이메일/비밀번호, Firestore, Storage, Cloud Functions를 준비합니다. 기본 Functions 리전은 `asia-northeast3`입니다. Firestore/Storage의 기존 위치와 비용도 확인합니다.
2. 스테이징 브랜치 또는 배포용 복사본의 `firebase-config.js`를 해당 프로젝트의 공개 웹 설정으로 교체합니다. 버킷명은 Firebase 콘솔의 실제 값을 사용합니다. 서비스 계정 비밀키를 프런트엔드에 넣지 않습니다.
3. Functions 실행 서비스 계정에 필요한 Firestore 및 Storage 객체 접근 권한이 있어야 합니다. Storage 규칙의 Firestore 조회에 필요한 서비스 연결 권한도 Firebase 안내에 따라 설정합니다.
4. Functions와 예약 재시도 작업은 유료 플랜 및 관련 Google Cloud API가 필요할 수 있습니다. 예산 알림과 로그 보관을 설정합니다. 함수 인스턴스 제한은 일반 callable 10개입니다.
5. Firebase Authentication의 승인 도메인과 재설정/인증 메일 템플릿을 설정합니다. 실제 메일 전달과 재설정 링크를 테스트합니다.

## 3. 배포할 파일과 명령

아래 명령의 `PROJECT_ID`는 배포 대상으로 확인한 프로젝트 ID로 바꿉니다. 로그인된 Google 계정의 권한을 먼저 확인합니다. 구형 정적 페이지를 계속 사용하는 도중 규칙을 바꾸면 저장이 차단되므로 운영 전환에는 짧은 점검 시간을 둡니다.

```powershell
npx firebase login
npx firebase deploy --project PROJECT_ID --only functions,firestore,storage
npx firebase deploy --project PROJECT_ID --only hosting
```

Functions에는 인증된 `diary` callable과 `retryPhotoRevocation` 예약 함수가 포함됩니다. 예약 함수는 연결 해제 후 Storage 토큰 철회가 실패한 관계를 15분마다 재시도합니다. 예약 작업 실패 경보를 설정하세요.

클라이언트 쓰기는 모두 서버 명령을 통해 처리하므로 **새 Functions와 규칙 없이 HTML만 GitHub Pages에 배포하면 안 됩니다.** 정적 화면은 기존 GitHub Pages에 유지할 수도 있지만 Functions·규칙·인덱스·CORS는 Firebase/Google Cloud에 별도 적용해야 합니다.

`firebase.json`은 테스트·서버 소스·보고서·설정 문서·의존성을 호스팅에서 제외합니다. 다른 호스팅을 쓰면 동일한 제외 목록을 적용하세요. JavaScript와 HTML은 `no-cache`로 재검증하도록 설정했습니다.

## 4. Storage CORS

새 화면은 토큰 URL을 저장하지 않고 인증된 Storage 요청으로 사진을 Blob으로 읽습니다. 실제 웹 출처가 버킷 CORS에 있어야 합니다.

`storage.cors.json`의 허용 도메인을 실제 배포 출처와 맞춘 다음 인증된 Google Cloud CLI에서 실행합니다.

```powershell
gcloud storage buckets update gs://ACTUAL_BUCKET_NAME --cors-file=storage.cors.json
```

현재 파일에는 기존 GitHub Pages 도메인 및 기존 프로젝트의 Firebase Hosting 도메인이 들어 있습니다. 임의 출처 전체 허용으로 넓히지 마세요. 에뮬레이터의 사진 요청 성공이 운영 CORS 성공을 보증하지 않습니다.

## 5. 기존 기록 이전

운영 전환 전에 Firestore와 Storage를 별도로 백업하고 스테이징에서 복구를 확인합니다. 자동 이전 백업만을 유일한 복구 수단으로 삼지 마세요.

새 화면에 로그인하면 `initialize` 명령이 현재 커플을 확인하고 필요한 경우 다음을 수행합니다.

1. 현재 사용자가 기존 커플의 실제 멤버인지 확인합니다.
2. 기존 커플 문서를 서버 전용 `legacyBackups/{coupleId}`에 최초 한 번 보관합니다.
3. `myEntries/{uid}/{date}`의 내용을 `couples/{id}/entries/{uid}_{date}`에 최초 한 번 복사합니다. 댓글에는 안정적인 ID를 붙입니다. UID가 명확하지 않은 구형 ‘나’ 댓글은 다른 사용자가 수정하지 못하도록 읽기용 작성자로 남깁니다.
4. 기존 Firebase Storage URL을 같은 버킷의 `photos/{author}/...` 경로로 바꾸고 이전 다운로드 토큰을 교체합니다. 이는 과거의 복사된 사진 URL을 무효화하기 위한 동작입니다. 이미 내려받은 사진 파일은 철회할 수 없습니다.
5. 모든 복사가 성공한 후에만 `schemaVersion:2`로 표시하고 커플 문서의 `myEntries`를 제거합니다. 원본은 서버 백업에 유지됩니다.

중간에 실패하면 완료된 문서를 덮어쓰지 않고 다음 호출에서 이어서 처리합니다. 이전이 끝나기 전에는 새 서버 저장 명령을 허용하지 않습니다. 잘못된 날짜·다른 버킷·예상 외 사진 경로 등은 원본을 보존한 채 실패합니다. 이런 경우 임의로 빈 데이터로 초기화하지 말고 관리자가 백업을 확인해야 합니다.

매우 많은 파일은 540초 함수 시간 제한에 걸릴 수 있습니다. 이 경우 반복 호출로 이어서 처리하거나 관리자가 이전 작업을 나눠 실행합니다. 큰 운영 데이터는 사전 점검이 필요합니다.

## 6. 운영 확인 순서

- 서로 다른 두 계정으로 초대 수락과 동시 댓글·수정 동작을 확인합니다.
- 로그아웃 후 다른 계정으로 전환했을 때 이전 화면과 초안이 보이지 않는지 확인합니다.
- 자기 일기만 수정하고 자기 댓글만 수정·삭제할 수 있는지 확인합니다.
- 브라우저를 새로고침해 기념일과 닉네임이 유지되는지 확인합니다.
- 사진 업로드·조회·압축·업로드 실패 시 입력 보존·휴지통 복원을 확인합니다.
- 연결 해제 후 두 사용자 포인터가 비워지고 자기 보관함만 읽을 수 있는지 확인합니다.
- 연결 전 받은 사진 토큰 URL이 실제 운영 버킷에서 더 이상 통하지 않는지 확인합니다. 로컬 에뮬레이터는 토큰 메타데이터 교체 방식이 운영과 달라 로컬에만 별도 관리자 토큰 철회 처리가 있습니다.
- 네트워크 끊김·한국 자정·다른 시간대·강제 종료 후 초안을 확인합니다.
- 실제 iPhone Safari와 데스크톱 Chrome/Firefox에서 파일 선택·키보드·화면 크기·재로그인을 확인합니다.
- 사진 일부 조회 실패가 표시되며 일기 저장이 기존 사진 경로를 삭제하지 않는지 확인합니다.

## 7. 복구와 공개 전 남은 일

v2 이전 후에는 예전 `index.html`만 다시 배포해 롤백할 수 없습니다. 예전 앱은 원본 커플 문서의 `myEntries`에 의존합니다. 장애 시 새 앱에서 쓰기를 중지하고 원본 백업과 v2 변경 기록을 함께 확인하여 복구 계획을 세워야 합니다. 과거 토큰을 무조건 복원해 이미 철회한 링크를 다시 열지 마세요.

계정 영구 삭제, 개인정보 처리방침, 사진 포함 백업/가져오기, 휴지통·원본 백업의 보관 기간은 아직 운영 정책과 구현을 마무리해야 합니다. 상세 우선순위는 [docs/WEB_STATUS.md](docs/WEB_STATUS.md)에 있습니다. 이 항목들과 스테이징 검증을 마친 뒤 운영 전환하는 것이 웹 버전의 다음 완료 기준입니다.
