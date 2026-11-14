# Account Deletion Implementation Plan

> Execute inline using superpowers:executing-plans. User approved sequential release preparation and prefers manual fulfillment.

**Goal:** 앱 내 삭제 접수와 안전한 관리자 수동 삭제를 제공한다.
**Architecture:** 최근 인증된 callable 접수, Firestore 차단 표식, 재개 가능한 관리자 작업과 익명 접수 상태.
**Tech Stack:** Firebase Functions/Admin, JavaScript, HTML.
**Spec:** ../specs/2026-11-14-account-deletion-design.md

## Global Constraints

운영자 COMINO, cs@comino.app, 처리 목표 7일. 이메일 필수 요청 금지. 운영 삭제 실행·메일 발송 없음.

## Review Focus

타인 삭제·오래된 로그인, 상대방 데이터 보존, 삭제 도중 실패, 지연 결제 알림 재생성, 알 수 없는 기존 스키마.

- [x] 1. 최근 인증·중복 요청·접근 차단 회귀 테스트 작성 후 접수 모듈과 기존 API 가드를 구현한다.
- [x] 2. 페이지 단위 삭제 실행기와 기본 dry-run CLI를 구현하고 에뮬레이터에서 자기 데이터 삭제·상대 기록 보존·재시도를 검증한다.
- [x] 3. 설정의 삭제 화면, 비밀번호 재확인·접수 상태·구독 안내·로컬 초안 정리를 구현한다.
- [x] 4. COMINO 정책 문서와 운영 절차를 갱신하고 전체 테스트·빌드·독립 코드 리뷰를 수행한다.

실행 기록: 단위·회귀 29개, Firebase 통합 2개. 계정 전환 중 오삭제 방지와 중복 요청 프로필 재생성 회귀 테스트를 포함했다. 실제 운영 삭제와 이메일 전송은 수행하지 않았다. 정책의 저장 위치·국외 이전·운영 백업 확인은 후속 단계로 남겼다.
