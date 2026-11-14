# COMINO 계정 삭제 운영 절차

운영자: COMINO · cs@comino.app · 앱 접수 후 원칙적으로 7일 이내 처리.

사용자는 설정의 **계정 삭제**에서 비밀번호를 다시 확인하고 요청한다. 이메일을 보내야만 접수되는 구조가 아니다. 서버가 현재 공유를 중단하고 기록 접근을 차단한다. 삭제 상태는 임의 접수번호로 조회한다. Apple 구독은 별도로 해지해야 한다.

## 관리자 수동 처리

운영자가 매일 대기 요청을 확인하고, 지연되지 않게 처리한다. 자동 이메일 발송이나 자동 영구 삭제는 추가하지 않았다.

Firebase Admin Application Default Credentials와 해당 프로젝트 권한을 갖춘 관리자 컴퓨터에서만 실행한다. 비밀 서비스 계정 JSON을 저장소에 넣지 않는다. `PROJECT_ID`, `BUCKET`, `UID`는 실제 확인한 값으로 바꾼다. 운영 버킷은 `.appspot.com`과 `.firebasestorage.app` 중 어느 것인지 확인하고 명시한다.

```sh
# 접수된 요청 목록 (최대 50개)
node scripts/account-deletions.cjs --project PROJECT_ID

# 특정 요청 미리보기: 삭제하지 않음
node scripts/account-deletions.cjs --project PROJECT_ID --uid UID

# 실제 삭제: 미리보기로 본 계정 UID를 명시적으로 재입력
node scripts/account-deletions.cjs --project PROJECT_ID --bucket BUCKET --uid UID --execute --confirm UID
```

한 번에 최대 30개의 제한된 처리 단계를 수행한다. pending이면 같은 명령을 다시 실행해 이어서 처리한다. 대량 데이터는 여러 실행이 필요할 수 있다. 실패해도 진행 상태를 남기며 다른 관리자가 작업 중이면 중복 실행을 거부한다.

완료 시 표시된 가입 이메일로 COMINO가 완료 안내를 직접 보낸다. 계정 삭제 완료, 본인 기록·사진 삭제, 상대방 작성 일기 보존, Apple 구독 별도 관리 안내를 포함한다. 전송 완료를 확인한 뒤 다음 명령으로 요청에 남은 연락처를 제거한다.

```sh
node scripts/account-deletions.cjs --project PROJECT_ID --bucket BUCKET --uid UID --execute --confirm UID --notified
```

위 명령은 메일을 보내지 않고 **이미 보낸 사실만 기록**한다. 메일 주소·UID가 포함된 관리자 출력은 공개하거나 이슈에 붙이지 않는다.

## 삭제 범위와 안전장치

- 현재·이전 커플 공간을 차례로 찾아 공유를 닫고 상대방 보관함을 남긴다.
- 본인이 작성한 일기(휴지통 포함), 사진·업로드 예약, 상대 일기에 남긴 본인 댓글·좋아요를 제거한다.
- 상대방 작성 일기와 상대방 사진은 보존한다. 귀속이 구분되지 않는 공유 기념일·관계 날짜는 삭제한다.
- 닉네임 등 본인 설정, 개인 보관함 목록, 사진 한도, 결제 연결 정보, Firebase Auth 계정을 삭제한다.
- 접근 차단 표식이 기존 로그인 토큰과 지연 결제 알림에 의한 프로필 재생성을 막는다. 표식과 개인정보 없는 접수 상태는 완료 후 30일이 지나면 시간별 정리 작업에서 제거한다. 완료 알림 이메일은 알림 확인 즉시 제거하며, 누락되어도 이 정리 시점에 삭제된다.
- 이전 schemaVersion 2가 아닌 공간은 자동 처리하지 않는다. 원본을 훼손하지 않고 오류로 중단한다. 기존 데이터 이전·백업 삭제 절차는 출시 전 별도 검증해야 한다.
- 다운로드·내보내기된 다른 기기 복사본은 원격 삭제할 수 없다.

## 로컬 검증

`tests/emulator.cjs`는 별도 임의 테스트 계정을 생성해서만 삭제한다. 사용자가 맥북에서 만든 테스트 계정을 삭제하지 않는다. 운영 프로젝트에 테스트를 실행하지 않는다.

확인: 최근 인증·예상 계정 일치 검증, 타인 요청 차단, 삭제 요청 즉시 접근 차단, 페이지 단위 처리, Auth 삭제 직전 네트워크 실패 후 재개, 상대 일기·사진 보존, 본인 댓글·좋아요·레거시 사진·결제 매핑 제거, 접수 상태 완료.

공식 기준: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion
