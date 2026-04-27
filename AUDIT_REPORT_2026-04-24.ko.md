# 감사 보고서 2026-04-24

## 범위
- 정적 저장소 감사만 진행했습니다. 앱/서버는 실행하지 않았습니다.
- 안전한 정리는 허용 범위로 보고 `codex/audit-cleanup` 브랜치에서 진행했습니다.

## 정리 완료
- 추적 중이던 `backend/node_modules/`를 제거했습니다.
  - 이유: 생성되는 의존성 산출물이며 `backend/package-lock.json`으로 재현 가능합니다.
- 추적 중이던 `source/backup_20260418_115326/`를 제거했습니다.
  - 이유: 날짜가 붙은 백업 사본이고 현재 코드 참조가 발견되지 않았습니다.
- `.gitignore`를 추가했습니다.
  - `node_modules/`, `.wrangler/`, `dist/`, `build/`, `*.log` 재유입을 막습니다.

## 검증
- `git diff --cached --check`: 커밋 전 통과했습니다.
- `git ls-files backend/node_modules`: 정리 후 0개입니다.
- `git ls-files source/backup_20260418_115326`: 정리 후 0개입니다.
- `npm audit`: 개발 의존성 취약점 6개가 발견되었습니다.
  - 주요 경로: `wrangler` / `miniflare` / `undici` / `vite`.
  - `npm audit fix --force`는 `wrangler@4.84.1`로 점프하므로 자동 적용하지 않았습니다.

## 높은 우선순위 발견사항
- 백엔드 write/delete 라우트에 명확한 인증 가드가 보이지 않습니다.
  - 영향 라우트: `/personas`, `/profile`, `/sessions`, `/session/*`, `/image`, `/image/*`, `/memory/*`.
  - 위험: Worker URL에 접근 가능한 누구나 앱 데이터를 쓰거나 삭제할 수 있습니다.
- `/image-fetch`가 열린 HTTP(S) fetch 프록시입니다.
  - 위험: 대역폭 남용, 런타임/네트워크가 허용하는 경우 SSRF 성격의 내부/보호 대상 탐색 가능성.
  - 권장: 알려진 이미지 호스트 allowlist 또는 서명된 요청만 허용.
- `/image-list/*`가 임의 prefix 기준 R2 키 이름을 노출합니다.
  - 위험: 데이터 목록 노출.
  - 권장: prefix 제한 및 비공개 버킷 접근에는 인증 요구.
- 프론트엔드에서 `marked.parse()`와 `innerHTML` 경로가 많습니다.
  - 위험: 신뢰할 수 없는 모델/사용자 콘텐츠가 escaping을 우회하면 XSS 가능.
  - 기본 권장: markdown 렌더링 후 `DOMPurify` 적용.

## 중간 우선순위 발견사항
- `js/app.js`에 조기 `return` 뒤 도달 불가능한 startup 코드가 있습니다.
  - 현재 블록에는 cache warmup과 중복 persona sync 관련 주석이 포함되어 있습니다.
  - fallback/rollback 로직일 수 있어 아직 삭제하지 않았습니다.
- `js/ui.js`의 `handleMultiImageUpload()`와 `handleFileSelect()`에 `return` 뒤 legacy upload 코드가 있습니다.
  - 현재 업로드 파이프라인이 모든 케이스를 커버하는지 확인한 뒤 제거하는 것이 안전합니다.
- `js/ui.js`에 `copyImageToClipboard()`가 두 번 정의되어 있습니다.
  - 뒤쪽 정의가 앞쪽 정의를 덮어씁니다.
  - URL fallback이 필요한지 결정한 뒤 비활성 버전을 삭제해야 합니다.
- `WORKER_URL`이 `js/data.js`와 `emotion-manager.html`에 하드코딩되어 있습니다.
  - 권장: 중앙 config 또는 환경별 치환 방식으로 이동.
- `emotion-manager.html`에 직접적인 R2 삭제 호출이 있습니다.
  - 권장: 더 넓게 쓰기 전에 서버 측 인증과 감사 로그 추가.

## 비효율 지점
- 시작 시 cache/index/persona/archive 비교와 여러 `no-store` fetch가 발생합니다.
  - 개선: `/bootstrap` 엔드포인트 하나에서 personas, session index, archive manifest signature, memory meta를 함께 반환.
- 프론트엔드는 파일이 나뉘어 있지만 `js/ui.js`가 여전히 거대합니다.
  - 권장: 테스트 확보 후 기능 단위로 분리: chat, persona editor, archive, memory, image popup.
- R2 이미지 목록 조회가 prefix별로 반복됩니다.
  - 권장: 서버 관리 manifest + ETag/signature + paginated delta fetch.
- 이미지/썸네일 캐시 파이프라인이 custom이고 복잡합니다.
  - Library-first 경로: 요구사항이 단순하면 canvas resize 유지. 복잡해지면 `browser-image-compression` 또는 `pica` 검토.

## 사용자 불편 가능성
- 초기 로딩이 막힐 수 있고, 숨겨진 long-press recovery에 의존합니다.
  - 보이는 `오프라인으로 계속` / `동기화 재시도` 액션 추가 권장.
- 삭제/위험 작업이 브라우저 `confirm()`에 의존합니다.
  - 대상, 개수, undo/recover 가능 여부를 보여주는 일관된 모달로 교체 권장.
- Emotion Manager가 별도 페이지로 열립니다.
  - 같은 상태와 복귀 동선을 가진 인앱 route/modal이 더 좋습니다.
- Memory 컨트롤이 빽빽하고 언어가 섞여 있습니다.
  - `메모리 보기/수정`과 `최적화/재생성` 작업을 분리하는 것이 좋습니다.
- 이미지 외 파일 첨부 지원이 미완성입니다.
  - 기존 TODO 권장: Uppy/FilePond, pdf.js, Readability + DOMPurify, mammoth.

## 권장 다음 작업
1. Worker write/delete 라우트에 인증 또는 서명 요청 가드 추가.
2. markdown 렌더링에 DOMPurify 추가.
3. 열린 `/image-fetch`를 allowlist 프록시 또는 서명 엔드포인트로 교체.
4. 확인된 unreachable 프론트엔드 블록 제거.
5. session 저장/삭제/복구 및 memory upsert/delete 최소 테스트 추가.
6. 개발 의존성 경고 해소를 위해 `wrangler` / `vitest-pool-workers` 업그레이드를 통제된 작업으로 계획.
