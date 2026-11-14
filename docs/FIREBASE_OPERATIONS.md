# Firebase 백업·이전·비용 보호

2026-11-14. Firebase CLI Google 로그인과 운영 프로젝트 `couple-diary-75157` 읽기 전용 조회를 완료했다. Firestore는 asia-northeast1(도쿄), Storage는 US-CENTRAL1이며 삭제 객체 보관 7일이 설정되어 있다. 이메일/비밀번호 Auth는 활성, App Check는 미설정, Cloud Functions API는 비활성으로 확인했다. 기본 gcloud/ADC는 아직 없지만 데이터 운영 도구는 --firebase-cli-auth로 이미 승인한 CLI 로그인을 메모리에서 재사용할 수 있다. 비밀 값을 추가 파일이나 출력에 저장하지 않는다. 아래 절차 중 운영 이전·서버 배포는 아직 수행하지 않았다.

## 현재 준비한 것

- `.env.example` 기반 스테이징 공개 설정. `npm run build:staging`은 필수 값이 없거나 알려진 운영 설정을 재사용하면 빌드부터 실패한다.
- 일반 localhost 접속은 `?emulator=1` 또는 명시적인 비운영 설정을 요구한다. 기존 운영 설정에 자동 연결하지 않는다. 내장 native 기본 설정은 유지한다.
- 쓰기 120회/분·1,000회/일, 일기장 생성 10회/일, 초대 생성 20회/일의 계정별 서버 제한. 사진 예약은 별도로 일 6회·월 90회다. 실패한 트랜잭션은 횟수를 소비하지 않지만 해당 요청의 서버 실행·읽기 비용 자체가 없어지는 것은 아니다.
- 서버 환경 변수 `DIARY_WRITES_ENABLED=false`, `PHOTO_UPLOADS_ENABLED=false`로 재배포하면 쓰기 또는 신규 사진 예약을 긴급 중지한다. 이미 발급한 사진 예약은 최대 10분의 유효 기간이 남을 수 있다. 계정 삭제 요청은 쓰기 점검 스위치로 막지 않는다.
- 커플 단위 백업·무결성 검증·별도 테스트 프로젝트 복구·기존 데이터 이전 CLI. 기본 restore/migrate는 미리보기다.

## 1. 계정과 프로젝트 연결

Firebase CLI 인증과 Admin SDK의 ADC는 서로 다르다. 이 문서의 firebase-operations 명령에는 --firebase-cli-auth를 추가해 현재 CLI 로그인을 재사용할 수 있으며 읽기 전용 inventory를 실제 검증했다. 계정 삭제 관리자 도구는 기존 ADC 방식을 유지한다. Firebase 배포 도구는 `npx firebase login`, 로컬 Admin 도구는 Google Cloud CLI 설치 후 `gcloud auth application-default login` 등 공식 ADC 절차가 필요하다. 서비스 계정 키를 채팅에 붙이거나 Git에 넣지 않는다. 연결할 계정이 운영 프로젝트·Firestore·Storage·Auth에 필요한 권한이 있는지 확인한다.

스테이징은 별도 프로젝트와 버킷을 사용한다. 프로젝트 ID뿐 아니라 API key, app ID, Auth domain, Storage bucket 모두 해당 스테이징 Web app에서 받은 공개 설정을 복사해 `.env.staging`에 넣는다. 명칭만 바꾸고 운영 키를 섞지 않는다. 실제 iOS/웹 SDK 통신과 보안 규칙을 스테이징에서 검증하기 전 운영을 전환하지 않는다.

```sh
# 아래 값은 콘솔에서 확인한 실제 값으로 바꾼다.
node scripts/firebase-operations.cjs inventory --project PROJECT_ID --bucket BUCKET_NAME --firebase-cli-auth
```

이 명령은 버킷 위치와 처음 50개 커플의 스키마 수만 출력한다. 일기 본문·이메일을 출력하지 않으며, 전체 커플 개수 통계가 아니다.

## 2. 운영 전체 백업

이번 커플 단위 백업은 Auth·전역 결제·다른 커플·모든 서버 설정을 포함하지 않는다. 이를 운영 전체 복구본으로 취급하지 않는다. 운영 전환 전에는 공식 관리형 Firestore export와 별도 Auth/Storage 백업을 준비하고 복구를 검증한다.

- Firestore: 같은 위치 제약·권한·결제 플랜을 확인한 비공개 백업 버킷에 관리형 export. 전체 데이터나 필요한 collection group을 빠뜨리지 않는다.
- Auth: 계정·비밀번호 해시·hash 설정이 포함될 수 있으므로 암호화된 비공개 저장소에서 다룬다. 스테이징에 실제 사용자 전체를 불필요하게 복제하지 않는다.
- Storage: 사진 바이트와 필요한 객체 메타데이터를 별도로 백업한다. Firestore export가 사진 파일을 포함하는 것은 아니다.
- 규칙·인덱스·CORS·함수 버전·서비스 계정·비밀 자원 연결도 배포 시점과 함께 기록한다. 비밀키 원문을 보고서나 Git에 넣지 않는다.
- 백업 버킷의 soft delete, versioning, retention policy를 확인한다. 버전·삭제 보관으로 예상보다 데이터가 오래 남거나 비용이 늘 수 있다.

공식 안내: https://firebase.google.com/docs/firestore/manage-data/export-import

## 3. 커플 단위 이전용 백업

원본 쓰기를 중단하고 관리자 삭제·기존 클라이언트 쓰기도 멈춘 점검 시간에 수행한다. 온라인 중인 모든 서브컬렉션의 단일 시점 스냅샷을 보장하는 도구가 아니다. 종료 시 읽었던 문서 변경과 삭제 접수를 확인하지만 새 문서의 동시 삽입을 완전히 감지하지는 않는다.

```sh
node scripts/firebase-operations.cjs backup --project SOURCE_PROJECT --bucket SOURCE_BUCKET --couple COUPLE_ID --out .backups/before-migration-COUPLE_ID --maintenance-confirmed
node scripts/firebase-operations.cjs verify --backup .backups/before-migration-COUPLE_ID
```

커플 문서·하위 문서, 멤버 프로필과 해당 보관함, 참조된 기존 사진 및 해당 공간의 미부착 사진을 포함한다. 기본 문서 2,000개·총 128MiB·객체 최대 2,000개를 넘으면 실패하며 잘린 백업을 완료본으로 표시하지 않는다. 원본 사진 하나가 30MiB를 넘으면 중단한다.

타임스탬프 나노초·바이너리·GeoPoint·참조 타입을 보존하고 문서·사진에 SHA-256을 기록한다. 해시는 손상 감지용이며 별도 전자서명은 아니다. 신뢰할 수 있는 비공개 로컬 백업만 사용한다. `manifest.json`이 마지막에 기록되므로 없는 폴더는 미완성이다. 미완성 파일도 개인정보로 취급한다.

프로젝트 안에서는 `.backups/`에만 저장하도록 제한하고 Git에서 제외했다. 다른 장소를 선택할 때도 공개 웹 폴더·공유 드라이브를 피한다. 백업과 미완성 파일은 원칙적으로 7일 이내 정리한다. 계정 삭제를 처리할 때 해당 UID가 포함된 백업도 확인하고 보관 기한을 지킨다.

## 4. 별도 빈 테스트 프로젝트에 복구

```sh
node scripts/firebase-operations.cjs restore --project STAGING_PROJECT --bucket STAGING_BUCKET --backup .backups/before-migration-COUPLE_ID --staging-target
node scripts/firebase-operations.cjs restore --project STAGING_PROJECT --bucket STAGING_BUCKET --backup .backups/before-migration-COUPLE_ID --staging-target --execute --confirm STAGING_PROJECT
```

원본과 다른 프로젝트·버킷이 필수다. 기존 운영 프로젝트는 CLI가 거부한다. 처음에는 공간·사용자·사진이 없는 대상만 허용한다. 복구 도중 실패했다면 같은 백업의 해시와 이미 복사한 문서·사진이 일치하는 경우에만 이어서 처리한다. 다르면 덮어쓰지 않고 중단한다. 원본 참조는 대상 프로젝트로, 이전 사진 URL은 인증된 객체 경로로 정규화하며 이전 공개 다운로드 토큰을 복구하지 않는다. 모든 자료가 준비된 뒤에만 루트 공간을 공개한다. Auth 계정은 별도로 준비해야 로그인할 수 있다.

## 5. v1 → v2 이전

별도 스테이징에 복구한 자료를 다시 백업하고 스테이징 안에서 먼저 이전한다. 이 도구는 백업의 프로젝트·버킷과 실행 대상을 일치시켜 잘못된 환경을 차단한다.

```sh
node scripts/firebase-operations.cjs migrate --project PROJECT_ID --bucket BUCKET --backup .backups/verified-backup
node scripts/firebase-operations.cjs migrate --project PROJECT_ID --bucket BUCKET --backup .backups/verified-backup --maintenance-confirmed --execute --confirm PROJECT_ID
```

Git `3493146`의 `myEntries[uid][date]` 형식만 지원한다. 루트·일기·댓글·기념일·설정의 알 수 없는 필드, 잘못된 작성자·날짜·사진 버킷은 중단한다. 원본 해시와 사용자 연결이 백업 시점과 달라도 중단한다.

예전 '나' 댓글은 실제 작성자를 특정할 수 없어 `legacy:unknown`으로 읽기 전용 보존한다. 예전 boolean 좋아요는 작성자를 추정하지 않고 `legacyLiked`로 보관한다. 예전 작성자 이메일·초대 코드 등 더 이상 쓰지 않는 알려진 필드는 앱용 v2 문서에 복제하지 않으며 원본 백업에는 남는다.

안전 순서: 일기를 신규 생성/동일 내용 확인 → schemaVersion 2와 `status=migrating`으로 접근 차단 → 사진 토큰 철회 진행 저장 → 모두 완료한 뒤 `active`. 요청 중 끊겨도 같은 백업으로 재개한다. 토큰 철회 전에 옛 스키마의 URL을 깨지 않으며, 철회가 일부 진행된 상태는 사용자에게 정상 완료로 표시하지 않는다. 이전 중 새 삭제 접수는 데이터 변경 없이 재시도를 안내한다. 복구 사진은 백업의 바이트 해시로 검증하며, 이전 시 객체 generation 변경을 확인한다.

오류 때 예전 HTML만 재배포하거나 과거 다운로드 토큰을 무조건 복원하지 않는다. 그 방식은 이미 철회한 공개 링크를 되살릴 수 있다. 원본 백업을 유지하고 점검 상태에서 같은 이전을 재개한다.

## 6. 월 10,000원 예산 알림

사용자가 선택한 기준은 월 10,000원이다. `ops/budget-10000krw.example.json`에 월간·프로젝트 단위 필터와 실제 지출 50/80/100%, 예상 지출 100% 경고를 준비했다. 실제 프로젝트 번호로 교체하고 결제 계정 통화가 KRW인지 먼저 확인한다. 다른 통화면 10,000 KRW 그대로 생성할 수 없으므로 기준을 다시 맞춘다. 기본 수신 대상은 결제 계정 권한자이며, 다른 메일을 추가하려면 수신 채널 확인이 필요하다.

예산 알림은 청구 차단이나 강제 상한이 아니다. 2026-11-14에 운영 프로젝트 번호 681335251233만 대상으로 예산을 생성하고 재조회로 검증했다. Budget API를 활성화했으며, 월 KRW 10000과 위 네 경고 규칙이 적용되었다. 기본 결제 계정 권한자와 프로젝트 소유자 수신을 사용한다. 스테이징은 결제 미연결 상태이며 아직 이 예산 필터에 포함하지 않았다. 자동 결제 계정 해제는 앱 장애·데이터 접근 문제를 일으킬 수 있어 추가하지 않았다.

`ops/backup-lifecycle.example.json`은 **비공개 백업 버킷의 couple-diary-backups/ 접두사만** 7일 후 정리하는 gcloud-compatible 예시다. 앱 사진 버킷에 무조건 적용하지 않는다. 적용 전 기존 lifecycle과 soft delete·retention·versioning을 확인한다. 생명주기 삭제 완료가 정확히 7일 시각에 실행된다고 보장하지 않는다.

실제 남은 설정: App Check 웹·네이티브 제공자 등록/측정 후 강제, Auth 가입 남용 방지, 오류·정리 적체·미처리 삭제 요청 알림, 로그 보관 기간. 현재 빈도 제한은 정상 인증 계정의 대량 요청을 제한할 뿐 전체 청구 금액을 고정하지 않는다.

공식 안내: https://firebase.google.com/docs/projects/billing/avoid-surprise-bills
https://cloud.google.com/billing/docs/how-to/budgets
https://cloud.google.com/docs/authentication/provide-credentials-adc

## 실제 연결 후 확인한 상태

- 운영 커플 1개에 일기 11개, 참조 사진 1개가 있었다. 원문·이메일은 보고서에 출력하지 않았다.
- .backups/diagnostic-2026-11-14T05-14-20-187Z에 문서 3개(커플·사용자 프로필), 사진 1개, 총 198933바이트를 저장하고 해시를 확인했다. 온라인 진단본이므로 전체 프로젝트 복구본이나 운영 이전 승인용으로 사용할 수 없다. 이전 실행기는 maintenance-confirmed 백업만 허용한다. 이전 시에는 쓰기를 중단한 별도 백업을 다시 만든다.
- 실제 자료에서 기존 likedBy 배열을 확인해 실제 멤버만 허용하는 보존 변환과 회귀 테스트를 추가했다.
- couple-diary-comino-staging (프로젝트 번호 532300754240)과 Web 앱 식별자를 생성했다. 결제 계정 연결·운영 데이터 복사·유료 서버 배포는 하지 않았다.
- 운영 백업을 외부로 업로드하거나 공개하지 않았다. 전체 Auth/전역 결제/운영 설정 복구와 실제 스테이징 서버 검증은 후속 작업이다.

일반 `backup` CLI는 점검 시간 확인을 필수로 요구한다. 개발 중 만든 online-diagnostic 진단본은 해시가 맞더라도 migrate가 거부한다. 실서버의 신규 백업은 운영 쓰기 중단과 관리자 작업 중지를 확인한 뒤 quiesced 방식으로 다시 만든다.
