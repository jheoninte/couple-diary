# Firebase Operations Implementation Plan

> Execute inline using superpowers:executing-plans; user authorized the next release-preparation stage.

**Goal:** 격리된 Firebase 설정, 검증 가능한 이전용 백업/복구와 구형 데이터 변환, 비용 제한을 준비한다.
**Architecture:** 기존 Firebase 유지. Admin CLI 기본 dry-run, 제한된 읽기·로컬 백업, 안전한 v1→v2 변환과 트랜잭션, 클라이언트 env 분리.
**Tech Stack:** Node 22, Firebase Admin, Vite.
**Spec:** ../specs/2026-11-14-firebase-operations-design.md

## Global Constraints

운영 쓰기·결제 활성화 없음. 사용자 데이터는 로컬 비공개 백업. 프로젝트·버킷 명시. 모호한 데이터는 중단.

## Review Focus

다른 프로젝트/버킷 혼선, 원본 동시 수정, 백업 변조·타입 손실, 부분 실패·기존 데이터 덮어쓰기, 삭제된 계정 부활.

- [x] 1. 설정 격리와 서버 작업 제한 테스트를 작성하고 환경 구성·빈도 제한·긴급 스위치를 구현한다.
- [x] 2. 실제 Git 이력을 기준으로 구형 문서 변환·사진 경로 검증을 테스트 후 구현한다.
- [x] 3. 커플 단위 백업·검증·빈 테스트 공간 복구·이전 CLI와 운영 전체 백업 절차를 만든다.
- [x] 4. 에뮬레이터에서 사진 포함 백업·복구·이전·실패 재개를 검증하고 독립 코드 리뷰 후 문서를 갱신한다.

검증 기록: 단위·회귀 42개와 Firebase 통합 3개. 원본 해시·사진 bytes, 별도 프로젝트 복구, 복구 중단 후 재개, 토큰 응답 유실 후 비공개 이전 재개, 이전 중 삭제 접수 차단을 확인했다. 실제 클라우드 적용은 Firebase CLI/ADC 인증과 프로젝트·예산 정보 확인이 필요해 미실행이다. 사용자 예산 선택은 월 10,000원이다.
