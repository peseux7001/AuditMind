# AuditMind Product Specification

This document captures the current product direction and agreed behavior. Update it whenever product scope, user flows, AI pipeline assumptions, or screen behavior change.

## 1. Product Position

AuditMind is a Finance Readiness Platform.

It helps startups and growth companies prepare scattered finance, accounting, tax, contract, and operating documents before external review. The product does not replace accountants, tax advisors, CFOs, or BPO operators. It prepares the source materials so those professionals and their AI tools can work on clearer, traceable evidence.

One-line definition:

> AuditMind organizes, compares, and verifies scattered finance documents so they become Finance Ready for external advisory, tax review, audit, BPO, or investor diligence.

## 2. Core Principle

AuditMind should not claim that AI makes final accounting or tax judgments.

The product promise is:

- Detect likely missing, duplicate, old-version, period-mismatch, and number-mismatch issues.
- Show where the evidence came from.
- Suggest classification and reason candidates.
- Let humans make the final decision.
- Preserve review status and decisions as traceable workflow state.

## 3. Layers

AuditMind will be designed as two product layers.

### Customer Layer

The customer layer is the screen seen by the client company employee who needs to submit documents.

The customer layer focuses on:

- Opening a dedicated link received by KakaoTalk or email.
- Understanding who the request is for.
- Seeing the requested document list.
- Uploading many files at once.
- Uploading or replacing files per checklist item.
- Seeing whether each item is completed, being analyzed, needs resubmission, or still needs a first upload.
- Understanding the submission deadline and remaining time.

### Accountant Layer

The accountant layer is for accountants, tax advisors, reviewers, or BPO operators.

This layer is not being designed yet in the current UI. Keep it separate until the customer layer is clearer.

Expected future responsibilities:

- Create or customize document request lists.
- Send dedicated submission links.
- Review automatically classified files.
- Inspect Evidence Trace results.
- Approve, reject, or request resubmission.
- Generate Finance Readiness reports.

## 4. Customer Access

Customers enter through a dedicated link sent by the accountant via KakaoTalk or email.

MVP access model:

- No customer login.
- Each recipient gets a long, unguessable dedicated submission link.
- The link identifies the company, request package, recipient, expiry, and allowed scope.
- The link can expire.
- The accountant can revoke or reissue the link.

Future security options:

- Email or phone last-four confirmation.
- One-time passcode.
- SSO or account-based access for enterprise customers.

## 5. Customer Portal Screen

The current implemented page is the customer submission portal.

Current visible structure:

- Header with configurable brand symbol, page title, and company badge.
- Request summary card.
- Submission progress card.
- Deadline card with remaining-time progress.
- Bulk file upload section.
- Vertical checklist of requested documents.
- Right sidebar with next steps only. Submission state and access notice blocks were removed to keep the customer screen quieter.

Current sample customer:

- `샘플테크 주식회사`

Current sample accountant or service-provider name:

- `AuditMind`

Current default brand symbol:

- Text fallback: `AM`
- Optional future image: `brand.symbolImage`

The brand symbol in the header should be configurable from a future administrator screen. The MVP uses the text fallback, but the data model already allows replacing it with the accountant firm or service provider's own logo image.

Current sample request title:

- `2025년 1기 부가가치세 신고 검토 자료 제출 요청`

## 6. Customer Checklist

The checklist is the center of the customer experience.

It should feel like a task list, not a file archive. The customer should immediately understand:

- What they need to submit.
- What has already been submitted.
- What is still missing.
- What needs correction or resubmission.
- Where to upload or replace a file.

Current status labels:

- `검수완료`
- `반려`
- `미접수`
- `접수완료`

Files that are being read or matched in the background should show a compact spinner with the label `분석 중`, visually aligned with the status badges. The `반려`, `분석 중`, `미접수`, `검수완료`, and `접수완료` status bubbles should share the same compact width based on the `분석 중` pill, not expand to the longest label.

After the customer has uploaded files and the system has started classification, checklist rows should prioritize current attention:

- `분석 중`
- `반려`
- `미접수`
- `검수완료`
- `접수완료`

Checklist filters:

- `전체` shows every checklist row.
- `미접수` shows rows that are not yet ready for final accountant submission. In the current UI, this means `분석 중`, `반려`, and `미접수`; `검수완료` and `접수완료` rows are hidden.

Upload action wording:

- Use `파일 업로드` for every row-level upload action.
- Do not split row-level copy into `파일 갱신` and `신규 업로드`; that distinction was removed because it made the customer screen harder to scan.

Each checklist row also has a `최종 접수` button next to the upload action. This button represents sending that specific file package to the accountant for actual review. It should be enabled only when the row is `검수완료`. When clicked, that row becomes `접수완료`, the review line changes to `최종 접수가 완료되었습니다.`, and both `파일 업로드` and `최종 접수` become disabled. For `분석 중`, `반려`, `미접수`, and `접수완료`, `최종 접수` remains visible but disabled so the customer understands the next milestone without being able to submit incomplete, rejected, processing, or already-submitted material.

Upload actions also follow processing safety:

- `분석 중` rows keep `파일 업로드` visible but disabled while the uploaded file is being processed.
- `반려`, `미접수`, and `검수완료` rows allow `파일 업로드`.
- `접수완료` rows keep `파일 업로드` visible but disabled.

Current state-to-action pairing:

- `분석 중`: spinner status, `파일 업로드` disabled, `최종 접수` disabled.
- `반려`: rejected status, `파일 업로드` enabled, `최종 접수` disabled.
- `미접수`: missing status, `파일 업로드` enabled, `최종 접수` disabled.
- `검수완료`: approved status, `파일 업로드` enabled, `최종 접수` enabled.
- `접수완료`: submitted status, `파일 업로드` disabled, `최종 접수` disabled.

Checklist row copy structure:

- First line: bold requested-document title. Keep this stable.
- Second line: AI review state, not a generic document description. For `검수완료`, show the AI review completion percentage. For `미접수`, ask the customer to find and upload the document. For `분석 중`, say that analysis is in progress. For `반려`, show the rejection reason.
- Third line: only after a file is successfully attached and approved, show the attached filename as a clickable download link with the submitted time.

Avoid exposing internal classification controls such as `직접 지정` on the customer page for now. If manual file-to-item assignment is needed later, it should be designed as a clearer customer-facing interaction instead of exposing internal workflow language.

Current sample checklist items:

- 부가세 신고서
- 카드매출 내역
- 매출 세금계산서 합계표
- 통장 입금 내역
- PG 정산자료
- 주요 매출계약서

Customer-facing copy may use `#####` as a placeholder token for the accountant firm or service-provider name. The current default value is `AuditMind`, so `##### 내부에서만 사용됩니다` renders as `AuditMind 내부에서만 사용됩니다`.

### Customer Message

Below the request title, the portal uses the open blank space on the left side of the summary card for a customer-facing guidance message. Do not render it as a separate card, bubble, or checklist section.

Priority:

- If the accountant writes a manual message for the customer, display that message below the request title.
- If the accountant leaves the message empty and enables AI auto-fill in the settings screen, Qwen writes a soft encouragement message.
- During local development, the customer page calls Qwen on each refresh through `/api/qwen/chat/completions`, which is proxied to `http://gx10-f0e1:8000/v1/chat/completions`.

Qwen generation rules:

- Use `Qwen3.6-35B-A3B-NVFP4`.
- Turn reasoning mode off for this short customer-facing message using `enable_thinking: false` and `chat_template_kwargs.enable_thinking: false`.
- Use the current 자료 제출률, 접수 마감일, and 미접수 or rejected document context.
- Tone should be gentle, supportive, and non-pressuring.
- Include one additional sentence that directly encourages the person preparing the materials.
- Avoid unnecessary subjects such as `회계사가`; keep the message customer-centered and neutral.
- Avoid meta phrases such as `이 페이지를 보는 담당자`, `이 페이지를 보는 분`, or `이 화면을 보는`.
- Emphasize 자료 제출률 and 접수 마감일 in bold and underline when shown in the customer message. Do not add underline to the summary card labels or values.
- If Japanese, Chinese, or other unintended non-Korean CJK characters appear in the generated output, discard it and regenerate.
- Stream the message to the UI only after the final sentence has been generated and validated. The customer should see the validated final text appear progressively, not raw partial model output.
- If Qwen is unreachable, show the validated local fallback message so the portal remains usable.

## 7. Upload Experience

The customer should not be forced to upload files one by one.

Default behavior:

1. Customer uploads many files at once.
2. AuditMind stores the files and marks them as received.
3. Matching files are attached to the correct checklist items.
4. OCR, text extraction, and classification continue in the background even if the customer leaves the page.
5. Ambiguous or rejected items are surfaced as `반려`.
6. The customer can upload new files or refresh existing files per checklist item.

Customer-facing upload principle:

- Do not block the customer because OCR is slow.
- Once upload transfer and server receipt are complete, the customer can safely leave the page.
- During active file transfer, dim the whole screen and show a centered upload progress overlay with selected file count and progress percentage.
- During active upload, the overlay title should stay `파일 업로드 중`.
- The upload-progress overlay body copy should also be split by sentence line: `선택한 파일을 안전하게 접수하고 있습니다.` / `이 단계가 끝나면 분석은 백그라운드에서 계속 진행됩니다.`
- When upload transfer completes, keep the overlay open, change the title to `파일 분석 시작`, and show the body copy on separate sentence lines: `파일 업로드가 완료되었습니다.` / `문서 분류와 분석은 이 페이지를 나가셔도 계속 진행됩니다.`
- The upload-progress and analysis-start overlay cards should keep a stable height between states.
- After the customer clicks `확인`, the checklist should temporarily show every item as `분석 중` while document classification and analysis are simulated or processed.
- When analysis finishes, rows move into their classified results: `검수완료`, `미접수`, or `반려`.
- Long PDFs, scanned documents, and large archives should move through a background queue.
- Analysis progress should be simplified on the customer page as `분석 중`; detailed processing state belongs in the future accountant layer.

Current accepted upload guidance:

- Supported: PDF, Excel, Word, HWP/HWPX, CSV/TSV, image files including JPG/JPEG/PNG/HEIC/HEIF/WEBP/TIFF/TIF, and archives including ZIP/7Z.
- The customer upload area shows a compact `지원파일` tooltip beside the upload guidance copy so the detailed allowlist is discoverable without making the page text heavier.
- Unsupported: executable files, password-protected archives, corrupted files.

Processing guardrails:

- Ignore macros in uploaded spreadsheets such as XLSM; never execute them.
- Reject password-protected archives or documents that cannot be inspected safely.
- Enforce per-file size limits and archive expansion limits.
- Treat HEIC/HEIF, TIFF/TIF, HWP/HWPX, DOC, XLSM, and 7Z as supported but potentially heavier processing paths.
- Prefer text extraction over OCR when a PDF already has a reliable text layer.
- Avoid hard customer-facing OCR page limits. Use background queues, prioritization, sampling, and accountant-side follow-up for very large documents.

## 8. Document Types

AuditMind should eventually handle common documents received by accountants and tax advisors.

Document groups:

- Company basics: business registration, corporate registry, articles, shareholder list, organization chart, board minutes, policies.
- Accounting books and closing documents: general ledger, account ledger, trial balance, financial statements, vouchers, closing adjustments.
- Revenue documents: sales tax invoices, card sales, cash receipt sales, platform settlement files, POS data, revenue contracts, accounts receivable.
- Expense and purchase documents: purchase tax invoices, card statements, receipts, expense reimbursements, outsourcing contracts, approval evidence.
- Banking and cash documents: bank account list, balance certificates, transaction histories, loan agreements, card statements.
- Receivables and payables: AR/AP schedules, accrued/unpaid lists, advances, deposits, allowance evidence.
- Inventory and assets: inventory lists, stock movement records, fixed asset register, depreciation schedule, leases, development cost evidence.
- HR and payroll: employee list, employment contracts, payroll ledger, withholding tax, social insurance, stock option documents.
- Tax filings: VAT, corporate tax, income tax, tax adjustment and deduction support.
- Contracts and legal: sales, purchase, service, lease, loan, investment, shareholder, license, litigation, dispute evidence.
- Industry-specific: manufacturing, construction, ecommerce, healthcare, startup investment and grant documents.

MVP should stay narrower and use tax/startup-focused sample flows first.

## 9. Document Routing Pipeline

Document routing is the core backend process that turns a customer's messy uploaded file batch into checklist state. The target user is a Korean accounting firm, so sample documents, test fixtures, and customer-facing file examples should use Korean document names by default.

Primary goal:

```txt
uploaded files
-> safe, normalized document objects
-> candidate checklist matches
-> Qwen document judgment
-> checklist routing result
```

The customer may upload:

- A single file.
- Many unrelated files at once.
- A ZIP or 7Z archive.
- An archive with folders, mixed document types, and repeated filenames.
- Files with misleading names.
- Files with good names but wrong contents.
- Files that are incomplete, from the wrong period, duplicated, corrupted, unsupported, or password-protected.

Routing must not trust filenames alone. Filenames, folder paths, file signatures, extracted text, OCR output, table headers, sheet names, dates, periods, issuers, and amounts are all routing signals. Qwen makes the final document-fit judgment for whether a candidate file actually satisfies the requested checklist item.

### Routing Stages

The product routing path is:

```txt
upload receipt
-> security scan
-> archive expansion
-> file normalization
-> type-specific extraction
-> candidate generation
-> Qwen document judgment
-> conflict resolution
-> checklist state update
-> evidence trace storage
```

### Security And Expansion

Before routing:

- Reject unsupported extensions and MIME/file-signature mismatches.
- Reject password-protected archives or documents.
- Reject corrupted files.
- Reject executable files.
- Ignore spreadsheet macros and never execute them.
- Enforce per-file size limits, archive expansion limits, and total batch limits.
- Prevent archive path traversal such as `../` or absolute internal paths.
- Treat archives as containers, not checklist documents. Route the expanded child files instead.

Archive child files should preserve provenance:

```json
{
  "uploadBatchId": "batch_123",
  "containerFile": "자료모음.zip",
  "internalPath": "매출/카드매출_1월.xlsx",
  "originalFilename": "카드매출_1월.xlsx"
}
```

### Normalized File Object

Every processable upload should become a normalized object before classification:

```json
{
  "fileId": "파일_123",
  "originalName": "매출세금계산서합계표_2025_1기.xlsx",
  "extension": "xlsx",
  "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "size": 123456,
  "source": "direct_upload | archive_child",
  "container": "자료모음.zip",
  "pages": [],
  "sheets": [],
  "text": "",
  "ocrText": "",
  "tables": [],
  "images": [],
  "metadata": {}
}
```

### Extraction Strategy

Use structured extraction before asking Qwen to judge:

- Text PDF: extract embedded text first.
- Scanned PDF: send pages through the official PaddleOCR-VL pipeline.
- Image files: send through PaddleOCR-VL after any needed format conversion.
- Excel/CSV/TSV: extract workbook metadata, sheet names, headers, row/column samples, date ranges, and numeric patterns.
- DOC/DOCX/HWP/HWPX: extract document text and obvious headings.
- ZIP/7Z: expand safely, then process each child file recursively.

Qwen should receive a compact evidence package, not raw huge files.

### Candidate Generation

Before Qwen judgment, generate candidate matches using cheaper deterministic signals:

- Original filename.
- Archive folder path.
- File type.
- Sheet names.
- Document title.
- OCR first-page text.
- Table headers.
- Dates and detected period.
- Issuer or platform names such as 홈택스, 카드사, 은행, PG사, 배달앱, 스마트스토어, 쿠팡, 또는 결제대행사.
- Business registration numbers, customer names, and amount patterns.

This stage proposes candidates; it does not finalize routing.

### Qwen Judgment

Qwen judges whether a candidate file or file bundle is actually the requested document. Qwen should return strict JSON.

Input shape:

```json
{
  "checklistItem": {
    "title": "카드매출 내역",
    "expectedEvidence": "카드사 또는 POS 월별 카드매출 자료",
    "period": "2025년 1기 또는 2025년 1분기"
  },
  "fileCandidate": {
    "filename": "카드매출_1월_2월.xlsx",
    "extractedText": "...",
    "sheets": ["1월", "2월"],
    "tableHeaders": ["거래일", "승인금액", "카드사", "매장명"],
    "detectedPeriod": ["2025-01", "2025-02"]
  }
}
```

Required output shape:

```json
{
  "isExpectedDocument": true,
  "targetChecklistItem": "카드매출 내역",
  "confidence": "medium",
  "coverage": 66,
  "status": "rejected",
  "reason": "2025년 1월과 2월 자료만 확인되고 3월 자료가 없습니다.",
  "evidence": [
    {
      "file": "카드매출_1월_2월.xlsx",
      "sheet": "1월",
      "basis": "카드매출 헤더와 승인금액 컬럼 확인"
    }
  ],
  "customerMessage": "3월 카드매출 자료가 빠진 것으로 보입니다. 1월, 2월 파일만 자동 매칭되었습니다."
}
```

### Routing Outcomes

Checklist state should be derived from routing results:

- `검수완료`: expected document, sufficient period/range, readable, and high or acceptable confidence.
- `반려`: document type may be right, but required period, page, file, evidence, or quality is insufficient.
- `미접수`: no candidate file matched the checklist item.
- `분석 중`: background processing has not finished.
- `확인필요`: ambiguous, low confidence, or conflict-heavy result that requires accountant review. This state may stay hidden from the current customer UI but must exist in the backend model.

### Conflict Cases

The routing engine must explicitly handle:

- One file matching multiple checklist items.
- Multiple files forming one checklist item.
- Duplicate uploads by file hash.
- Same filename with different content.
- Misleading filename with correct content.
- Correct filename with wrong content.
- Wrong tax period or stale version.
- Archive folder names that provide useful hints.
- Partial period coverage such as 1월과 2월 자료만 있고 3월 자료가 빠진 경우.
- Unmatched extra files that should be kept for accountant review but not shown as completed customer tasks.

### Routing Result Object

Target item result:

```json
{
  "checklistItemId": "매출세금계산서합계표",
  "title": "매출 세금계산서 합계표",
  "status": "processing | approved | rejected | missing | needs_review | submitted",
  "reviewCompletionRate": 72,
  "reviewMessage": "AI가 문서를 분석 중입니다.",
  "rejectionReason": null,
  "attachments": [
    {
      "fileId": "파일_123",
      "filename": "매출세금계산서합계표_2025_1기.xlsx",
      "downloadUrl": "/files/파일_123/download",
      "matchedBy": "qwen",
      "confidence": "high"
    }
  ],
  "evidence": []
}
```

Qwen is a routing judge, not an unquestionable source of truth. Every accepted or rejected decision must keep confidence, reason, evidence, and the original file location so a human can review it later.

### Current Frontend Simulation

The current frontend includes a generic document routing mock in `src/documentRouting.js`. It does not replace the future backend and must not infer document identity from frontend filenames. It exists only to prove the UI contract:

- Uploaded files are normalized.
- Backend-style mock routing results update checklist rows after the analysis phase.
- Approved rows receive downloadable attachment links.
- Rejected rows show rejection reasons.
- Missing rows ask the customer to upload the document.

Do not hardcode English sample filenames or English keyword matching into the customer frontend. The real matching path belongs in backend extraction and Qwen judgment.

## 10. AI Pipeline

AuditMind currently assumes two local AI services.

### PaddleOCR-VL

Role:

- OCR and document parsing.
- Extract text, tables, layout, and structured artifacts from uploaded PDFs/images.

Endpoint:

- `http://192.168.0.10:8118/v1`

Model:

- `PaddleOCR-VL-1.5-0.9B`

Product rule:

- Use the official PaddleOCR-VL pipeline.
- Do not use direct `/v1/chat/completions` calls as the product OCR path.
- Direct VLM calls are allowed only for experiments or fallback debugging.

Official product path:

```txt
uploaded file
-> official PaddleOCRVL pipeline
-> layout detection / crop / recognition / merge
-> JSON and Markdown artifacts
```

### Qwen3.6

Role:

- Reasoning and classification.
- Match OCR outputs to checklist items.
- Infer likely missing files, old versions, wrong periods, duplicate submissions, and candidate evidence relationships.

Endpoint:

- `http://192.168.0.10:8000/v1`

Model:

- `Qwen3.6-35B-A3B-NVFP4`

Assumption:

- Reasoning is enabled by default.

## 11. Evidence Trace

Evidence Trace is the core engine concept.

It should not only say that a number or document is wrong. It should preserve where the evidence came from.

Examples of trace targets:

- File name.
- Page number.
- Sheet name.
- Cell address.
- Section or paragraph.
- Extracted value.
- Confidence level.
- Human review decision.

For MVP, Evidence Trace can start as structured hints and become deeper as the backend matures.

## 12. Current Frontend Implementation

The current screen is implemented as a Vite + Tailwind static frontend.

Content lives in:

- `src/customerPortalContent.js`

Rendering and dev-only copy editing live in:

- `src/main.js`

The HTML shell is:

- `index.html`

Self-hosted font:

- `public/fonts/PretendardVariable.woff2`

Dev copy edit mode:

- Open `http://127.0.0.1:4173/?edit=1`
- Click visible text to edit.
- Local edits are stored in browser `localStorage`.
- Current storage key: `auditmind.customerPortal.copyOverrides.v3`

## 13. Non-Goals For Now

Do not implement these until explicitly requested:

- Full accountant review console.
- Production authentication.
- Real file upload backend.
- Real OCR execution from the browser.
- Database-backed CMS.
- Final Finance Readiness report generation.
- Full audit/tax judgment automation.

## 14. Open Questions

- What is the exact first customer scenario: VAT review, tax advisory, investor diligence, or BPO onboarding?
- Should the customer see accountant comments per checklist item?
- Should upload status distinguish `uploaded`, `parsed`, `matched`, and `accepted`?
- What exact file size and type limits should be enforced?
- Should customer links allow multiple people from the same company?
- Should the first backend be Node, Python, or split frontend + Python worker?
