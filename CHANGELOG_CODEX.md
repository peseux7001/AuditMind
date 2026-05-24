# AuditMind Change Log (Codex)

이 문서는 Codex가 작업한 변경 사항을 기록합니다.

## 2026-05-23

### 서비스 관리 - DB/API 연동

- **파일**: `backend/api/server.mjs`, `src/accountantTemplateManagement.js`, `nginx.conf`, `vite.config.mjs`, `tests/auditmind.spec.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - `GET /api/request-templates`로 서비스, 요청자료 매핑, 자료 마스터, 필수 항목을 조회
  - `POST /api/request-templates`로 신규 서비스 등록
  - `PUT /api/request-templates/{code}`로 서비스 기본정보와 요청자료 매핑 저장
  - `DELETE /api/request-templates/{code}`로 서비스 삭제
  - `PUT /api/document-types/{code}/required-fields`로 요청자료의 필수 항목 저장
  - 서비스 관리 화면이 API 사용 가능 시 DB 값을 읽고 쓰도록 변경
  - 서비스 관리 Playwright 테스트가 기존 seed 서비스를 DB에 저장해 훼손하지 않도록 조정
- **원칙**:
  - 서비스 관리 화면의 seed 파싱은 API가 없을 때만 쓰는 개발 fallback이다. 실제 서비스 등록, 저장, 삭제, 필수 항목 수정은 DB/API에 반영되어야 한다.

### 서비스 관리 - 필수 항목 우클릭 수정 팝업

- **파일**: `src/accountantTemplateManagement.js`, `tests/auditmind.spec.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - `필수 필드` 화면 용어를 `필수 항목`으로 변경
  - 요청 자료 행을 우클릭하면 `필수 항목 수정` 카드 팝업이 뜨도록 추가
  - 필수 항목은 쉼표 또는 줄바꿈 기준으로 편집하고 저장하면 표에 즉시 반영
- **원칙**:
  - 필수 항목 편집 UI는 서비스 관리 화면 안에 상시 노출하지 않는다. 예외적으로 우클릭 팝업으로 열어 화면 복잡도를 낮춘다.

### 회계사 콘솔 - 서비스 용어 정리

- **파일**: `src/accountantShell.js`, `src/accountantConsoleContent.js`, `src/accountantSubmissionRequests.js`, `src/accountantTemplateManagement.js`, `src/accountantCustomerManagement.js`, `database/seeds/003_request_template_seed.sql`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 화면과 문서의 기존 업무 묶음 표현을 `서비스` 또는 `서비스 관리` 기준으로 변경
  - 자료제출 요청 화면의 오른쪽 카드, 검색창, 표 헤더를 `서비스` 용어로 정리
  - 관리 메뉴와 관리 화면을 `서비스 관리`, `서비스 목록`, `서비스 설정`, `신규 서비스 등록`로 변경
  - 서비스 seed 설명의 기존 자료 요청 표현을 `자료 요청 서비스`로 변경
- **원칙**:
  - 회계사가 고객에게 제공하는 업무 묶음은 화면에서 `서비스`로 부른다. 내부 DB 테이블명과 코드 식별자는 현재 구조 안정성을 위해 유지한다.

### 서비스 관리 - 한 화면 스크롤 구조 보정

- **파일**: `src/accountantTemplateManagement.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 서비스 관리 작업영역을 화면 높이 안에 고정
  - 긴 서비스 목록과 요청 자료 목록이 각각 카드 내부에서 스크롤되도록 보정
- **원칙**:
  - 긴 목록 하나 때문에 전체 페이지가 아래로 늘어나면 안 된다. 회계사 콘솔의 작업 화면은 한 화면 안에서 카드별 스크롤을 가져야 한다.

### 서비스 관리 - 요청 자료 필수 항목 표시

- **파일**: `src/accountantTemplateManagement.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 오른쪽 `포함 자료` 명칭을 `요청 자료`로 변경
  - 요청 자료 표에서 `분류` 컬럼 제거
  - `database/seeds/002_document_required_fields_seed.sql`의 `is_required=true` 필드를 읽어 `필수 항목` 컬럼에 표시
- **원칙**:
  - 서비스 관리에서 중요한 것은 문서 카테고리가 아니라 고객 업로드 통과에 필요한 OCR/Qwen 필수 인식 항목이다.

### 제출자료 검토 - 메모 라벨과 안내문 정리

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 오른쪽 검토 패널의 `내부 메모` 라벨을 `메모`로 변경
  - 메모 입력 placeholder를 `내부 검토 기록을 입력하세요.`로 축약
- **원칙**:
  - 검토 화면의 입력 안내문은 필요한 만큼만 짧게 쓴다.

### 제출자료 검토 - 하단 3단 헤더 높이와 제목 크기 재정렬

- **파일**: `src/accountantReview.js`
- **변경**:
  - 자료 목록, 선택 자료, 오른쪽 검토 패널 헤더의 강제 최소 높이 제거
  - 오른쪽 자료명 헤더의 낮은 높이를 기준으로 세 헤더를 다시 정렬
  - 가운데 `선택 자료`를 다른 헤더와 같은 제목 크기로 변경
- **원칙**:
  - 세 칼럼 높이를 맞출 때는 가장 큰 헤더를 키우는 방식이 아니라 기준 헤더에 맞춰 불필요한 여백을 줄인다.

### 회계사 콘솔 - 알림 행 정보 구조 정리

- **파일**: `src/accountantShell.js`, `src/accountantConsoleContent.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 알림 제목 줄은 고객사명만 표시
  - 알림 상세 줄은 자료명만 표시
  - 반복되던 `AI 검수 완료 후 제출자료 검토로 넘어왔습니다.` 문구 제거
- **원칙**:
  - 자료 접수 알림은 회사와 자료명을 분리해 읽을 수 있어야 한다.

### 제출자료 검토 - 자료 목록 헤더 정렬 인터랙션 추가

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 왼쪽 `자료 목록`의 `자료`, `상태` 헤더를 오른쪽 필수항목 표와 같은 클릭형 정렬 헤더로 변경
  - 자료명/상태 기준 오름차순·내림차순 정렬 상태 추가
- **원칙**:
  - 같은 화면의 표 헤더는 같은 정렬 문법과 시각 처리를 공유한다.

### 회계사 콘솔 - 알림 정책을 자료 접수 건별 표시로 변경

- **파일**: `src/accountantShell.js`, `src/accountantConsoleContent.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 종 알림 샘플을 `신규 제출 자료 N건` 집계형에서 문서 1건당 `자료 접수` 알림으로 변경
  - `고객사 요청사항` 알림 제거
  - 실시간 알림은 `review-ready` 성격의 자료 접수 이벤트만 받도록 방어 처리
- **원칙**:
  - 알림은 AI 검수가 끝나 회계사 검토 큐로 넘어온 자료 접수 건에만 발생한다.

### 제출자료 검토 - 고객사 선택 제출 칼럼 정렬 보정

- **파일**: `src/accountantReview.js`
- **변경**:
  - 고객사 선택 표의 `제출` 헤더를 중앙 정렬로 변경
  - 제출수 버블을 컴팩트한 최소 폭으로 두고 칼럼 중앙에 배치
- **원칙**:
  - 짧은 텍스트 헤더와 상태 버블은 같은 칼럼 중심선을 공유해야 한다.

### 제출자료 검토 - 검수완료 액션 제거

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 오른쪽 검토 패널 하단에서 `검수완료` 버튼 제거
  - 회계사 액션은 현재 `재요청`만 노출
  - `approved` 액션 클릭 핸들러 제거
- **원칙**:
  - 후속 시나리오가 정의되지 않은 버튼은 화면에 두지 않는다.

### 제출자료 검토 - 상태명 및 상태 칼럼 정렬 정리

- **파일**: `backend/api/server.mjs`, `src/accountantReview.js`
- **변경**:
  - 회계사용 제출자료 검토 화면에서 `submitted` 상태 표시명을 `최종 접수`에서 `접수완료`로 변경
  - 기존 `최종 접수` 값도 방어적으로 `submitted`로 저장되도록 유지
  - 왼쪽 자료 목록의 `상태` 헤더와 상태 버블을 같은 오른쪽 정렬 기준으로 맞춤
- **원칙**:
  - `최종 접수`는 고객이 누르는 행동명이고, 회계사 화면의 상태명은 `접수완료`다.

### 제출자료 검토 - 3단 작업영역 헤더 높이 통일

- **파일**: `src/accountantReview.js`
- **변경**:
  - 자료 목록, 파일 뷰어, 오른쪽 검토 패널의 상단 헤더가 같은 높이 클래스를 공유하도록 정리
  - 오른쪽 자료명 헤더 기준으로 세 작업영역의 상단 라인이 맞도록 보정
- **원칙**:
  - 제출자료 검토의 3단 작업영역은 같은 행 높이를 공유해야 시선 흐름이 흔들리지 않는다.

### 제출자료 검토 - 자료 목록 카드 헤더 단순화

- **파일**: `src/accountantReview.js`
- **변경**:
  - 왼쪽 자료 목록 카드 헤더에서 고객사명/서비스명 보조 문구 제거
  - `자료 목록` 제목만 크게 표시하도록 정리
  - 가운데 파일 뷰어 헤더와 높이·톤을 맞춤
- **원칙**:
  - 왼쪽 자료 목록은 자료 탐색 영역이므로 헤더에는 영역명만 남긴다.

### 제출자료 검토 - 고객사 선택 표 정렬 보정

- **파일**: `src/accountantReview.js`
- **변경**:
  - 고객사 선택 카드의 헤더와 행을 같은 스크롤 컨테이너 안에서 렌더링하도록 조정
  - 고객사/제출요청일/제출마감일/제출 칼럼 폭을 공통 그리드 클래스로 통일
  - 날짜 칼럼은 중앙 정렬과 `tabular-nums`를 적용해 행마다 눈금이 흔들리지 않도록 정리
- **원칙**:
  - 스크롤바가 있는 표는 헤더와 본문이 같은 폭 계산 기준을 써야 한다.

### 제출자료 검토 - 고객 반려 업로드를 미제출 항목으로 정규화

- **파일**: `backend/api/server.mjs`, `src/accountantReview.js`, `ProductSpec.md`, `Development.md`, `database/README.md`
- **변경**:
  - `/api/review-items`가 `not_received`, `processing`, `approved`, `submitted`, `rejected` 상태의 요청 항목을 회사별 자료 목록 맥락으로 반환하도록 조정
  - `rejected` 업로드는 회계사용 응답에서 `미제출`로 정규화하고 파일명, 파일 URL, 필드, 신뢰도는 숨김
  - 제출자료 검토 화면은 `오류`/`rejected` 행만 방어적으로 제외
  - `not_received` 행은 회계사용 자료 목록에 `미제출`로 표시
  - `미제출` 행 선택 시 파일 뷰어는 빈 상태를 표시하고 재요청 버튼은 비활성화
  - 검토 가능한 자료가 0건이면 fallback 목업을 다시 띄우지 않고 빈 상태 표시
  - 고객 제출단에서 `오류`/`rejected` 처리된 파일 자체는 회계사 검토 큐에 파일로 노출하지 않음
  - 회계사가 `재요청`을 누르면 해당 자료를 즉시 화면 큐에서 제거하고 API에 `rejected`로 저장
- **원칙**:
  - 제출자료 검토 화면은 회계사가 실제로 볼 자료와 회사별 미제출 맥락을 함께 보여준다.
  - 고객에게 되돌아간 업로드 파일은 고객 포털에서 재업로드할 문제이며, 회계사 화면에는 해당 요청 항목만 `미제출`로 남긴다.

### 제출자료 검토 - 자료 목록 정보 축소

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 왼쪽 `자료 목록` 카드 헤더의 `완료/전체 완료` 버블 제거
  - 왼쪽 `자료 목록` 테이블에서 `신뢰도` 컬럼 제거
  - 왼쪽 목록은 자료 탐색용으로 `자료`와 `상태`만 표시
- **원칙**:
  - 신뢰도는 오른쪽 필수항목 표에서 항목별로만 본다.
  - 왼쪽 자료 목록은 회계사가 해당 회사/서비스에서 무엇이 제출됐고 무엇이 미제출인지 확인하는 내비게이션 영역이다.

### 제출자료 검토 - 오른쪽 패널 헤더 및 신뢰도 문구 정리

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 오른쪽 검토 패널 제목 옆 상태 버블 2개 제거
  - 오른쪽 패널 헤더는 자료명만 표시
  - 필수항목 표의 신뢰도 값 `미확인`을 사용자 화면에서는 `확인 필요`로 표시
- **원칙**:
  - 상태 요약은 자료 목록과 필수항목 표에서 충분히 확인한다.
  - `미확인`은 내부 판정 상태로 유지하되, 사용자가 보는 신뢰도 표현은 자연어에 가깝게 정리한다.

### 제출자료 검토 - 업로드 시점 산출물만 표시하도록 정리

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 회계사 검토 화면의 프론트 fallback 목업 자료 제거
  - API 데이터를 불러오기 전에는 저장된 검토 결과 로딩 상태만 표시
  - 저장된 파일 URL이 없으면 가짜 PDF/문서 페이지를 만들지 않고 미리보기 없음 상태 표시
  - PDF는 저장된 파일 URL이 있을 때만 브라우저 PDF 뷰어로 임베드
- **원칙**:
  - 고객 업로드 시점에 OCR, Qwen, 변환, 필드 좌표, 오버레이 정보가 모두 계산·저장되어야 한다.
  - 회계사 화면은 저장된 검토 패키지를 표시하는 작업대이며 분석 엔진이 아니다.
  - 회계사 화면에서는 새 OCR 박스, 문서 위치, 신뢰도, 변환본을 즉석 생성하지 않는다.

### 제출자료 검토 - 업무 묶음 선택을 서비스 선택으로 변경

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 상단 선택 카드 제목을 `서비스 선택`으로 정리
  - 관련 DOM 데이터 속성도 `data-select-template`에서 `data-select-service`로 정리
- **원칙**:
  - 제출자료 검토 화면에서 회계사가 고르는 것은 재사용 서비스이 아니라 해당 고객에게 제공한 실제 서비스/요청 패키지다.

### 제출자료 검토 - 고객사 선택 진행 버블 정책 변경

- **파일**: `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - 고객사 선택 오른쪽 버블에서 `남음` 문구 제거
  - 버블 숫자를 `제출수 / 전체수`로 변경
  - 제출 0개는 빨강, 일부 제출은 노랑, 전부 제출은 초록으로 표시
- **원칙**:
  - 고객사 선택 버블은 남은 일을 세는 표시가 아니라 제출 진행 상태를 빠르게 읽는 신호다.

### 제출자료 검토 - 고객사 선택 날짜 칼럼 추가

- **파일**: `backend/api/server.mjs`, `src/accountantReview.js`, `ProductSpec.md`, `Development.md`
- **변경**:
  - `/api/review-items`에 제출요청일 `requestedAt` 추가
  - 고객사 선택 행에 `제출요청일`, `제출마감일` 칼럼 추가
  - 고객사별 여러 서비스가 있을 경우 가장 이른 요청일과 가장 임박한 마감일을 표시
- **원칙**:
  - 고객사 선택 영역은 가로 공간을 활용해 어느 고객사가 언제 요청받았고 언제까지 제출해야 하는지 바로 보여준다.

### OCR 엔드포인트 - Tailscale IP 기준으로 변경

- **파일**: `backend/api/server.mjs`, `.env.example`, `ProductSpec.md`, `Development.md`, `backend/ocr/README.md`
- **변경**:
  - PaddleOCR-VL 기본 호출 주소를 내부 LAN IP 대신 Tailscale IP로 변경
  - 기본 Chat Completions URL: `http://100.126.53.70:8118/v1/chat/completions`
  - 문서의 VLM backend base도 `http://100.126.53.70:8118/v1` 기준으로 갱신
- **원칙**:
  - 서버 배포 환경에서는 내부 IP(`192.168.x.x`)에 의존하지 않는다.
  - 로컬/서버 공통 모델 호출은 Tailscale IP 또는 명시적 환경변수로 통일한다.

### 고객사 관리 - 사업자등록증 OCR/Qwen 자동입력

- **파일**: `backend/api/server.mjs`, `src/accountantCustomerManagement.js`
- **변경**:
  - `POST /api/customers/business-license/parse` 엔드포인트 추가
  - PDF 및 이미지 사업자등록증 업로드 검증 추가
  - PDF 텍스트 추출, 스캔 PDF 첫 페이지 이미지 변환 시도, PaddleOCR-VL OCR, Qwen3.6 구조화 추출 연결
  - 신규 고객사 추가 팝업에서 사업자등록증 업로드 시 고객사명, 사업자등록번호, 대표자명, 업태, 업종, 사업장 주소 입력란 자동 채움
  - 사업자등록증이 아닌 문서로 판단되면 경고만 표시하고 입력란은 덮어쓰지 않음
  - PaddleOCR-VL 접속 실패 시 전체 업로드를 실패시키지 않고 Qwen 멀티모달 판단과 추출 텍스트로 계속 진행
- **원칙**:
  - 자동입력은 저장 전 보조 기능이다.
  - 고객사 레코드는 사용자가 `추가` 버튼을 눌러야 생성된다.
  - PDF 변환기가 없으면 가능한 텍스트 증거만 사용하고 경고를 반환한다.
