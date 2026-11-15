# 사진 캐시

## 동작
- **iPhone 앱**: `Library/Caches/diary-photos`(iCloud 백업 제외)에 파일로 저장(`ios/App/App/DiaryPhotoCache.swift`). 사진 파일은 UUID 이름이라 내용이 바뀌지 않으므로 한 번 받으면 다시 받지 않는다. 1,500MB를 넘으면 오래 안 본 순서로 90%까지 정리.
- 없는 사진만 화면 단위로 모아(최대 60장) `photoUrls` 1회 호출 → 서버는 권한만 확인하고 15분짜리 서명 URL 반환 → 기기가 Storage에서 직접 병렬 다운로드. 사진 데이터는 함수를 거치지 않는다.
- 서명 URL을 만들 수 없거나 직접 다운로드가 실패하면 기존 방식(`readPhoto`)으로 받아 역시 디스크에 저장.
- **웹 브라우저**: Cache Storage + 사용 기록 색인, 같은 1,500MB 한도.
- **삭제 시점**: 로그아웃(모든 화면), 계정 삭제 요청, 커플 연결 해제, 다른 계정/공간으로 로그인 시.
- **썸네일**: 새로 올리는 사진은 기기에서 긴 변 400px(최대 96KB) 사본 `<uuid>.t.jpg`를 함께 업로드, 일기 문서 `thumbs`에 기록. 앨범 그리드와 작성 화면 미리보기에서 사용, 피드·크게 보기는 원본(피드 사진이 화면 너비라 썸네일은 흐려 보임). 기존 사진은 원본 사용.

## 필수 설정 (사람이 할 일, 프로젝트마다 1회)
서명 URL을 만들려면 함수 서비스 계정에 **서비스 계정 토큰 생성자(Service Account Token Creator)** 역할이 필요하다. 없어도 앱은 기존 방식으로 동작하지만 이점이 줄어든다(로그에 `Photo URL signing failed`).

Google Cloud 콘솔 → IAM → 아래 계정의 연필 아이콘 → 역할 추가 → "서비스 계정 토큰 생성자":
- 운영: https://console.cloud.google.com/iam-admin/iam?project=couple-diary-75157 — `681335251233-compute@developer.gserviceaccount.com`
- 스테이징: https://console.cloud.google.com/iam-admin/iam?project=couple-diary-comino-staging — `532300754240-compute@developer.gserviceaccount.com`

## 검증 상태
단위 테스트(`tests/photo-cache.test.js`). Swift 컴파일, 실기기 캐시·서명 URL 다운로드는 미검증.
