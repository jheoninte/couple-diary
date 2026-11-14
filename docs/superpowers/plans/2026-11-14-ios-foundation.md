# iOS Foundation Implementation Plan

> Execute inline with superpowers:executing-plans; user authorized recovery against the current code.

**Goal:** 기존 클라이언트를 작동시키는 안전한 서버와 iOS 개발 빌드를 복구한다.
**Architecture:** Firebase callable + transaction service, Vite bundle + Capacitor + StoreKit 2.
**Tech Stack:** Node 22, JavaScript, Firebase, Swift, Capacitor 8.
**Spec:** ../specs/2026-11-14-ios-foundation-design.md

## Constraints

요금 4,900/39,900원. 사진 1,440px/256KiB 목표/512KiB 상한. 일 6·월 90회. 운영 배포 없음. 테스트 광고.

## Review Focus

외부 사용자 접근, 동시 수정 충돌, 구독 만료·계정 전환, 예약 재사용, 기존 데이터 보존.

## Tasks

- [x] 1. `tests/service.test.cjs`에 무인증·타인 접근·연결·수정 충돌·사진 제한 테스트를 작성해 실패를 확인한다. `functions/service.cjs`의 `createService(store)`와 `execute(uid, data)`를 구현해 통과시킨다. 저장소 어댑터는 Firestore 트랜잭션과 테스트용 메모리 저장소를 사용한다.
- [x] 2. `functions/index.cjs`, `functions/billing.cjs`에 callable과 Apple 검증·알림 연결을 복구한다. 미구성 결제 차단과 위조 거래 거부를 테스트한다. 의존성과 잠금 파일을 설치한다.
- [x] 3. `scripts/`의 로컬 서버·검사·에뮬레이터·iOS 설정·출시 검사를 복구한다. 정책 페이지는 출시용 확정본과 구분한다. 웹 빌드를 실행한다.
- [x] 4. Capacitor iOS 프로젝트와 `DiaryStore` 플러그인을 생성하고 공식 테스트 AdMob 설정을 적용한다. 동기화와 시뮬레이터 빌드를 확인한다.
- [x] 5. 에뮬레이터로 실제 두 계정과 규칙을 검증한다. 전체 테스트·빌드와 코드 검토 후 WEB_STATUS/FIREBASE_GUIDE에 확인된 결과와 외부 설정 잔여 작업을 기록한다.

## 실행 기록

2026-11-14: 서버·빌드 복구와 테스트 광고 iOS 프로젝트 구현. 독립 코드 리뷰에서 다중 구독 이력, 계정 혼합 복원, 사진 정리 문제를 발견해 회귀 테스트와 함께 수정했다. 정리는 매시간 200개로 제한하고 적체 경고를 남긴다. 운영 배포·실기기 결제 검증·기존 데이터 이전·계정 삭제는 다음 출시 작업으로 WEB_STATUS에 기록했다.
