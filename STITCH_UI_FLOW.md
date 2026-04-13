# Stitch UI 통합 플로우 가이드

이 문서는 현재 앱의 UI 분기 흐름을 Stitch에서 한 번에 설계/제작할 수 있도록 화면 단위로 통합한 스펙입니다.
캡처 없이 이 문서만으로 와이어/컴포넌트/전이 맵을 만들 수 있게 정리했습니다.

## 1) 전역 상태(Flow를 가르는 핵심 값)
- `activeTab`: `persona | chat | settings` (메인 화면 하단 탭)
- `activeChatId`: 현재 열린 채팅방 ID (`null`이면 메인)
- `selectedPids`: 새 채팅/초대 모달에서 선택한 페르소나 배열
- `_selectedPersonaPid`: 페르소나 탭에서 단일 선택된 페르소나
- `_inputTab`: 채팅 입력 모드 `chat | image | context`
- `newChatMode`: 새 채팅 응답 모드 `auto | all | random`
- `session.responseMode`: 그룹 채팅 응답 모드 `auto | all | random`
- `session.chatProfileOverride`: 채팅 헤더 프로필 표시 오버라이드 `on | off | null`

## 2) 화면 정보 구조(최상위 IA)
- 메인 화면 `mainScreen`
- 페르소나 패널 `personaPane`
- 채팅 목록 패널 `chatPane`
- 설정 패널 `settingsPane`
- 페르소나 편집 화면 `editScreen`
- 채팅 대화 화면 `chatScreen`

Stitch에서는 아래 6개를 "기본 화면 세트"로 먼저 만들고, 모달/드로어를 오버레이로 붙이면 됩니다.

## 3) 통합 전이(Primary Journey)
1. 앱 시작
2. `mainScreen` 진입
3. 하단 탭으로 `personaPane | chatPane | settingsPane` 전환
4. 채팅 시작 경로
5. `chatScreen` 진입
6. 채팅 내 세부 오버레이(드로어/모달/팝업) 사용
7. 뒤로가기(`goMain`)로 `mainScreen` 복귀

## 4) 채팅 시작 경로를 하나로 통합
Stitch에서는 아래 3개 시작 경로를 "Start Chat"이라는 단일 유즈케이스로 합치면 됩니다.

- 경로 A: 페르소나 탭 단일 선택 후 시작
  - 트리거: 페르소나 카드 선택 -> `startChatFromPersona()`
  - 결과: 1:1 채팅 세션 생성 후 `openChat()`

- 경로 B: 새 채팅 모달에서 다중 선택 시작
  - 트리거: 채팅 탭 FAB -> `openNewChatModal()` -> `startNewChat()`
  - 결과: 그룹/단일 세션 생성 후 `openChat()`

- 경로 C: 기존 1:1 재진입
  - 트리거: 페르소나 더블탭 -> `openLatestOneOnOneChatForPersona()`
  - 결과: 최근 1:1 세션 있으면 바로 `openChat()`, 없으면 경로 A로 폴백

권장 Stitch 처리:
- Entry를 여러 개 두지 말고 `Chat Session Resolver` 1개 노드로 통합
- Resolver 내부에서
  - 기존 세션 있으면 reopen
  - 없으면 create
  - 마지막은 항상 `chatScreen`

## 5) 화면별 액션/전이 표

### A. `mainScreen > personaPane`
- 주요 UI
  - 페르소나 그리드
  - 선택 액션 바(채팅 시작/편집)
- 액션
  - 카드 단일탭: 선택 상태 토글
  - 카드 더블탭: 최근 1:1 열기 시도
  - 추가 카드: 신규 페르소나 생성 편집 화면
- 전이
  - 편집 -> `editScreen`
  - 채팅 시작/재진입 -> `chatScreen`

### B. `mainScreen > chatPane`
- 주요 UI
  - 채팅 리스트(검색, 숨김 필터, 스와이프 액션)
  - 새 채팅 FAB
  - 복원 모달 진입
- 액션
  - 리스트 아이템 클릭: `openChat(id)`
  - 스와이프: 숨김/삭제
  - FAB: 새 채팅 모달
- 전이
  - 채팅 열기 -> `chatScreen`
  - 새 채팅 -> `newChatModal` -> `chatScreen`
  - 복원 -> `restoreModal`

### C. `mainScreen > settingsPane`
- 주요 UI
  - 사용자 프로필(이미지/이름/소개)
  - 기본 탭/아바타 스타일/폰트 크기
  - 메모리 패널
- 액션
  - 저장: 프로필/설정 반영
- 전이
  - 화면 이동 없음(같은 패널 내 갱신)

### D. `editScreen`
- 주요 UI
  - 페르소나 기본 정보
  - 감정 이미지 업로드(단일/멀티)
  - 성향/색상/모델 설정
  - 하단 액션(생성/저장/삭제/취소)
- 전이
  - 취소/저장/삭제 -> `mainScreen` 복귀

### E. `chatScreen`
- 주요 UI
  - 상단 헤더(프로필 토글/새로고침/설정)
  - 메시지 영역
  - 입력 탭(`chat | image | context`)
- 액션
  - 전송: `sendMessage()`
  - 설정 버튼: 채팅 드로어
  - 뒤로가기: `goMain()`
- 전이
  - `chatDrawer`, `promptModal`, `inviteModal`, `ratioModal`, `imagePopup` 오버레이 진입
  - 뒤로가기 시 `mainScreen`

## 6) 오버레이(모달/드로어) 매트릭스
- `newChatModal`: 페르소나 선택 + 응답모드 + 월드컨텍스트 -> 세션 생성
- `inviteModal`: 현재 채팅에 페르소나 추가
- `restoreModal`: 삭제 채팅 복원/영구삭제
- `promptModal`: 시스템 프롬프트 확인
- `ratioModal` + `ratioPopup`: 이미지 비율 선택
- `chatDrawer`: 채팅방 설정 허브(이름/모드/참여자/메모리/리셋/삭제)
- `profilePopup`: 메시지 아바타 상세
- `imagePopup`: 이미지 확대/다운로드
- `cropOverlay`, `cropOverlayAvatar`: 이미지 크롭

Stitch 권장:
- 위 오버레이를 "Global Overlay Set"으로 묶어 재사용
- `chatDrawer`를 하위 허브로 두고 `inviteModal`, `promptModal` 분기

## 7) 백/ESC 통합 규칙(중요)
실제 코드 기준 닫힘 우선순위:
1. 이미지 팝업
2. 열려 있는 모달/드로어(프롬프트/초대/복원/새채팅/비율/프로필)
3. 크롭 오버레이
4. `editScreen` 또는 `chatScreen`이면 `goMain()`
5. 메인에서 탭이 persona가 아니면 persona 탭으로 이동
6. persona 탭에서 선택 상태면 선택 해제

Stitch에서도 동일 우선순위의 Back stack 규칙을 적용하면 실제 앱과 UX가 맞습니다.

## 8) Stitch 제작용 최종 묶음(추천)
- `App Shell`
  - `Main Screen` (3탭)
  - `Edit Screen`
  - `Chat Screen`
- `Chat Session Resolver` (create/reopen 통합)
- `Global Overlay Set` (모달/드로어/팝업)
- `Back Navigation Policy` (우선순위 기반)

위 4개 블록으로 만들면 현재 코드의 분기 구조를 유지하면서도 UI 제작은 일괄 처리할 수 있습니다.

## 9) 코드 근거 파일
- `/js/ui.js`
- `/js/app.js`
- `/js/data.js`
- `/index.html`
