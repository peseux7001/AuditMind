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

Current responsibilities:

- Create or customize document request lists.
- Send dedicated submission links.
- Review automatically classified files.
- Inspect Evidence Trace results.
- Approve, reject, or request resubmission.
- Generate Finance Readiness reports.

The accountant layer uses a shared accountant shell with persistent left navigation, top header, notification bell, and account menu. Each menu item changes only the main white work area. Customer-facing pages and accountant-facing pages must remain separate page modules.

Accountant notification policy:

- The bell notification list is event-based, not aggregate-summary based.
- One notification represents one document that has completed customer-upload AI validation and has moved into the accountant review queue.
- Use `자료 접수` as the normal notification type for these review-ready document events.
- The notification title line should show the customer/company name only.
- The notification detail line should show the document name. Do not repeat generic copy such as `AI 검수 완료 후 제출자료 검토로 넘어왔습니다.` in every notification.
- Do not display grouped messages such as `신규 제출 자료 4건이 접수되었습니다.` in the bell menu.
- Do not display customer-written `요청사항` as bell notifications. Customer requests belong in the relevant review/request context, not as document-arrival alerts.

Implemented accountant work areas:

- `대시보드`: review queue dashboard and summary cards.
- `고객사 관리`: customer master data, contacts, save/delete workflow.
- `자료제출 요청`: request-package creation/editing workspace.
- `제출자료 검토`
- `서비스 관리`

Planned accountant work areas:

- `설정`

## 4. Customer Access

Customers enter through a dedicated link sent by the accountant via KakaoTalk or email.

MVP access model:

- No customer login.
- Each recipient gets one stable, long, unguessable dedicated submission link per request package.
- The link must not rotate on every visit. Customers should be able to return to the same KakaoTalk or email link throughout the request period.
- The link identifies the company, request package, recipient, expiry, and allowed scope.
- The link can expire.
- The accountant can revoke or reissue the link.
- Reissuing creates a new token and invalidates the old one; ordinary revisits do not create a new token.
- Store only the token hash in the database. The raw token appears only in the outbound URL sent to the customer.
- Track `last_accessed_at` and `access_count` for operational visibility, not for customer login.
- The customer frontend should support three access outcomes while keeping the same header/footer frame:
  - Valid link: show the normal submission page.
  - Expired or revoked link: show `이 링크는 더 이상 사용할 수 없습니다.` and `담당자에게 새 링크를 요청해 주세요.`
  - Invalid link: show `접근할 수 없는 제출 페이지입니다.` and `링크가 올바른지 확인해 주세요.`

Recommended URL shape:

```txt
https://auditmind.co.kr/submit/{raw_token}
```

Database model:

- `customer_submission_requests`: one request package.
- `customer_submission_access_tokens`: recipient-level stable link tokens with hashed token, optional recipient metadata, expiry, revoke state, and access tracking.

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
- Deadline card with elapsed-time progress from the day the accountant sends the request to the submission deadline.
- Bulk file upload section.
- Vertical checklist of requested documents.
- Full-width legal/business footer with provider identity, business registration details, contact information, privacy officer information, and policy links. The previous right sidebar and 참고사항 footer were removed to keep the customer screen quieter.

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

Progress calculation:

- The submission progress bar is calculated from `검수완료` plus `접수완료` rows divided by total requested rows.
- The deadline progress bar starts on the day the customer receives the submission request, meaning the day the accountant sends it.
- In the current MVP schema, the request sent date is represented by `customer_submission_requests.created_at`. If a future workflow separates draft creation from actual sending, add a dedicated `sent_at` field and use that instead.

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
- `오류`
- `미접수`
- `접수완료`

Files that are being read or matched in the background should show a compact spinner with the label `분석 중`, visually aligned with the status badges. The `오류`, `분석 중`, `미접수`, `검수완료`, and `접수완료` status bubbles should share the same compact width based on the `분석 중` pill, not expand to the longest label.

After the customer has uploaded files and the system has started classification, checklist rows should prioritize current attention:

- `분석 중`
- `오류`
- `미접수`
- `검수완료`
- `접수완료`

Checklist filters:

- `전체` shows every checklist row.
- `미접수` shows rows that are not yet ready for final accountant submission. In the current UI, this means `분석 중`, `오류`, and `미접수`; `검수완료` and `접수완료` rows are hidden.

Upload action wording:

- Use `파일 업로드` for every row-level upload action.
- Do not split row-level copy into `파일 갱신` and `신규 업로드`; that distinction was removed because it made the customer screen harder to scan.

Each checklist row also has a `최종 접수` button next to the upload action. This button represents sending that specific file package to the accountant for actual review. It should be enabled only when the row is `검수완료`. When clicked, that row becomes `접수완료`, the review line changes to `최종 접수가 완료되었습니다.`, and both `파일 업로드` and `최종 접수` become disabled. For `분석 중`, `오류`, `미접수`, and `접수완료`, `최종 접수` remains visible but disabled so the customer understands the next milestone without being able to submit incomplete, rejected, processing, or already-submitted material.

Before the row changes to `접수완료`, show a centered confirmation card:

- `이 자료를 최종 접수할까요?`
- `최종 접수하면 더 이상 수정할 수 없습니다.`

The confirmation actions are `취소` and `최종 접수`.

Upload actions also follow processing safety:

- `분석 중` rows keep `파일 업로드` visible but disabled while the uploaded file is being processed.
- `오류`, `미접수`, and `검수완료` rows allow `파일 업로드`.
- `접수완료` rows keep `파일 업로드` visible but disabled.

Current state-to-action pairing:

- `분석 중`: spinner status, `파일 업로드` disabled, `최종 접수` disabled.
- `오류`: rejected status, `파일 업로드` enabled, `최종 접수` disabled.
- `미접수`: missing status, `파일 업로드` enabled, `최종 접수` disabled.
- `검수완료`: approved status, `파일 업로드` enabled, `최종 접수` enabled.
- `접수완료`: submitted status, `파일 업로드` disabled, `최종 접수` disabled.

Checklist row copy structure:

- First line: bold requested-document title. Keep this stable.
- Second line: AI review state, not a generic document description. For `검수완료`, show the AI review completion percentage. For `미접수`, ask the customer to find and upload the document. For `분석 중`, say that analysis is in progress. For `오류`, show the rejection reason.
- Third line: only after a file is successfully attached and approved, show the attached filename as a clickable download link with the submitted time.
- Optional customer-facing accountant comment: if the accountant has entered a comment for that requested document, show it inside the same checklist row under the AI review/attachment lines as `요청사항`. Hide the entire comment area when no comment exists. This is the only accountant-authored note visible to the customer.

Avoid exposing internal classification controls such as `직접 지정` on the customer page for now. If manual file-to-item assignment is needed later, it should be designed as a clearer customer-facing interaction instead of exposing internal workflow language.

Current sample checklist items:

- 부가세 신고서
- 카드매출 내역
- 매출 세금계산서 합계표
- 통장 입금 내역
- PG 정산자료
- 주요 매출계약서

### Customer Message

Below the request title, the portal uses the open blank space on the left side of the summary card for a customer-facing guidance message. Do not render it as a separate card, bubble, or checklist section.

Priority:

- If the accountant writes a manual message for the customer, display that message below the request title.
- If the accountant leaves the message empty and enables AI auto-fill in the settings screen, Qwen writes a soft encouragement message.
- The customer page requests Qwen through the configured application endpoint. In local development this is routed through `/api/qwen/chat/completions`.
- `/api/qwen/chat/completions` is a backend proxy to the local Qwen endpoint. The browser must not call the Tailscale model endpoint directly. The proxy forces the configured model and disables thinking mode for this short message path.

Qwen generation rules:

- Use `Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf`.
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
- The top customer message is a first-entry greeting. Generate and stream it once when the customer first opens the page, then keep it stable. Do not regenerate or re-stream it after uploads, polling updates, status changes, or final submission actions.

## 7. Upload Experience

The customer should not be forced to upload files one by one.

Default behavior:

1. Customer uploads many files at once.
2. The customer submission portal backend stores the original files and creates processing jobs.
3. Archive extraction, file conversion, OCR/text extraction, Qwen document judgment, required-field scoring, confidence calculation, and rejection/retry reason generation run from those upload-triggered jobs.
4. Matching files are attached to the correct checklist items from persisted processing results.
5. OCR, text extraction, and classification continue in the background even if the customer leaves the page.
6. Ambiguous or rejected items are surfaced as `오류` or another customer-facing retry state.
7. The customer can upload new files or refresh existing files per checklist item.

Current MVP implementation boundary:

- The customer portal can already load a token-backed request through `/api/submission-portal/:token`.
- The portal can send real multipart uploads to `/api/submission-portal/:token/upload`.
- Uploaded originals are stored under `public/uploads/{request_id}/` and tracked in `uploaded_files`.
- The backend currently starts a best-effort background OCR/Qwen classification attempt immediately after upload. This proves the product loop, but it is not yet the final durable queue architecture.
- The upload API runs the safe file-processing boundary before analysis: allowlisted extension validation, executable rejection, configured per-file size enforcement, ZIP safety checks, and normalized text/table extraction where available.
- ZIP archives are expanded safely on the server. Accepted internal files are stored and analyzed individually while preserving the original archive filename and internal path in metadata. Unsupported or executable internal files are ignored and are not stored or analyzed, so one irrelevant file does not reject the whole archive. Encrypted archives, unsafe internal paths, oversized supported children, excessive member counts, and excessive expanded size are rejected.
- Customer-written `요청사항` is saved through `/api/submission-portal/:token/customer-request`.
- Row-level final submission is saved through `/api/submission-portal/:token/items/:item_id/final-submit`.
- Stored files can be read through `/api/submission-files/:file_id`.

Customer-facing upload principle:

- The customer submission portal is the normal trigger point for first-pass AI/OCR analysis. The accountant review screen must never start this work just because an accountant opens the page.
- Do not block the customer because OCR is slow.
- Once upload transfer and server receipt are complete, the customer can safely leave the page.
- During active file transfer, dim the whole screen and show a centered upload progress overlay with selected file count and progress percentage.
- During active upload, the overlay title should stay `파일 업로드 중`.
- The upload-progress overlay body copy should also be split by sentence line: `선택한 파일을 안전하게 접수하고 있습니다.` / `이 단계가 끝나면 분석은 백그라운드에서 계속 진행됩니다.`
- When upload transfer completes, keep the overlay open, change the title to `파일 분석 시작`, and show the body copy on separate sentence lines: `파일 업로드가 완료되었습니다.` / `문서 분류와 분석은 이 페이지를 나가셔도 계속 진행됩니다.`
- If upload transfer fails, keep the customer in the overlay and show `파일 업로드 실패`, `파일 업로드에 실패했습니다.`, and `인터넷 연결을 확인한 뒤 다시 시도해 주세요.` with `다시 시도` and `닫기` actions.
- The upload-progress and analysis-start overlay cards should keep a stable height between states.
- After the customer clicks `확인`, the checklist should show submitted items as `분석 중` while document classification and analysis continue.
- When analysis finishes, rows move into their classified results: `검수완료`, `미접수`, or `오류`.
- `분석 중` must never be a terminal customer-facing state. It is only valid while upload-triggered OCR/Qwen work is actually running. If Qwen returns `possible_match`, `undecided`, a wrong-document judgment, missing required fields, or a confidence score below the approval threshold, the row must leave `분석 중` and become `오류` with a clear retry reason so the customer can upload another file.
- Long PDFs, scanned documents, and large archives should move through a background queue.
- Analysis progress should be simplified on the customer page as `분석 중`; detailed processing state belongs in the future accountant layer.

Current accepted upload guidance:

- Supported: PDF, Excel, Word, HWP/HWPX, CSV/TSV, image files including JPG/JPEG/PNG/HEIC/HEIF/WEBP/TIFF/TIF, and ZIP archives.
- The customer upload area shows a compact `지원파일` tooltip beside the upload guidance copy so the detailed allowlist is discoverable without making the page text heavier.
- Unsupported: executable files, password-protected archives, corrupted files.

Processing guardrails:

- Ignore macros in uploaded spreadsheets such as XLSM; never execute them.
- Reject password-protected archives or documents that cannot be inspected safely.
- Enforce per-file size limits and archive expansion limits.
- Treat HEIC/HEIF, TIFF/TIF, HWP/HWPX, DOC, and XLSM as supported but potentially heavier processing paths.
- Do not support 7Z for customer uploads. ZIP is the only customer-facing archive format for now.
- Prefer text extraction over OCR when a PDF already has a reliable text layer.
- Avoid hard customer-facing OCR page limits. Use background queues, prioritization, sampling, and accountant-side follow-up for very large documents.

Backend file handling policy:

- All accepted file extensions must produce a normalized processing result, even when they need OCR, archive extraction, or external conversion.
- `PDF`, images, `CSV/TSV`, `XLSX/XLSM`, `DOCX`, `HWPX`, and `ZIP` have current first-pass handling.
- `XLSM` macros are never executed; macro-bearing workbooks are treated as data containers only.
- legacy `XLS`, `DOC`, and `HWP` are routed to an external conversion path.
- `ZIP` children preserve the original container filename and internal path so evidence trace can later point to the exact uploaded location.
- A file can be "supported" while still not being "fully extracted" yet. The customer should not see a technical parser failure when the system can queue OCR/conversion safely.
- The customer portal does not need file preview or display-rendered conversion output. Visual preview, converted PDF pages, and OCR/Qwen source overlays belong to the accountant review screen after processing artifacts are persisted.
- Non-image office/text files contribute extracted text, sheet names, table headers, and sample rows to Qwen as compact evidence. Image files still go through PaddleOCR-VL before Qwen judgment.

Legacy conversion recommendations:

- `XLS`: direct extraction through `python-calamine` is preferred; LibreOffice headless conversion to `xlsx` or `csv` is fallback.
- `DOC`: LibreOffice headless conversion to `docx` or `pdf` is preferred; `antiword` can be a plain-text fallback.
- `HWP`: `pyhwp`/`hwp5txt` is preferred for HWP v5 text extraction; LibreOffice headless can be a fallback only where its HWP import filter works reliably.

Runtime portability:

- macOS development uses Homebrew LibreOffice/antiword plus `.venv_fileproc` Python dependencies.
- Fedora Linux should install LibreOffice headless/writer/calc and antiword through `dnf`, then install `backend/document_processing/requirements.txt` into `.venv_fileproc`.
- The same processing policy applies on both systems: macros are ignored, legacy converters are sandbox candidates, and failed conversion should become a clear `needs_conversion` or rejection reason rather than a silent approval.

## 8. Document Types

AuditMind should eventually handle common documents received by accountants and tax advisors.

Document type master data now belongs in PostgreSQL, not frontend code. The first schema and seed files are:

- `database/migrations/001_document_type_master.sql`
- `database/seeds/001_document_type_seed.sql`
- `database/seeds/002_document_required_fields_seed.sql`

Document type master names should be exact Korean requestable document names. Do not create master rows with vague names ending in `등`. Common customer wording, abbreviations, and OCR variants should be stored as aliases later.

Required fields exist for document judgment, not full accounting automation. The OCR service and Qwen use them to decide whether the uploaded file appears to be the requested document, whether the expected key values are present, and how confident the match should be.

Required-field design principles:

- Every document type gets a few common anchors. `문서명` is the common identity field; target company, period/date, and source are common reference fields unless a specific document type needs stricter treatment.
- Each document category gets a small set of anchors that usually prove the document family, such as amount, period, counterparty, account, employee, item, or contract party.
- Only high-value or highly structured document types get additional type-specific anchors.
- Keep strictness to two levels only: `is_required=true` identity fields and `is_required=false` reference fields.
- Do not add fields merely because the document can contain them. Add fields when they improve document fitness judgment, missing-value detection, or confidence scoring.
- Prefer Korean accounting-firm vocabulary in labels and extraction hints.

Official Korean tax-form references used for current judgment tests:

- National Tax Service VAT overview page: VAT is calculated as output tax minus input tax, and VAT periods are split by first and second half-year filing periods.
- National Tax Service VAT return form PDF: official form anchors include general taxpayer VAT return title, filing period, business registration number, output tax, input tax, and payable or refundable tax.
- National Tax Service depreciable asset acquisition schedule PDF: official form anchors include document title, submitter identity, business registration number, asset type, supply amount, and tax amount. This is a valid tax-support document, but it must not satisfy a direct `부가세 신고서` request.

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
- A ZIP archive.
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
- Scanned PDF: rasterize pages and send the page images through the official PaddleOCR-VL pipeline.
- Image files: send through the official PaddleOCR-VL pipeline after any needed format conversion.
- Excel/CSV/TSV: extract workbook metadata, sheet names, headers, row/column samples, date ranges, and numeric patterns.
- DOC/DOCX/HWP/HWPX: extract document text and obvious headings.
- ZIP: expand safely, then process each child file recursively.

Qwen should receive a compact evidence package, not raw huge files. For visual accounting documents, the evidence package must include both machine-extracted text/OCR artifacts and the original visual evidence or a layout-preserving rendered page image. OCR text alone is not enough for final field judgment.

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

Document judgment is deliberately conservative. The most dangerous failure mode is not rejecting too much; it is confidently accepting an ambiguous or wrong document. Qwen may suggest that a file is the expected document, but AuditMind must still verify required-field coverage and OCR/readability quality before marking the item `검수완료`.

The JSON `decision` and `reason` are internal artifacts. The JSON `reviewMessage` is customer-facing copy. It must be a short, polite Korean instruction that tells the customer what to upload or why the current file cannot be accepted. It must not expose internal labels such as `match`, `possible_match`, `reject`, `undecided`, `confidence`, `OCR`, `Qwen`, `JSON`, or `필수 항목`. If those terms appear, the backend should replace the message with a safe customer retry message.

Important multimodal rule:

- Do not ask Qwen to make final required-field judgments from OCR text alone.
- For images, scanned PDFs, tax forms, invoices, bankbooks, contracts, and layout-heavy office documents, Qwen must receive the original page image or layout-preserving rendered image together with OCR/text artifacts.
- OCR-only judgments are diagnostic. They may explain OCR extraction failure, but they must not be used to conclude that the original document lacks required fields.
- If OCR output is sparse but the original visual evidence is readable, route the case to multimodal Qwen judgment or human review, not automatic rejection.
- The accountant-facing review panel should clearly treat Qwen/OCR values as review candidates. The original visual document remains the source of truth.

The automatic judgment has two gates:

1. Document identity gate: Qwen and extracted evidence must support that the file is the requested document. If Qwen says the file is a different document, route it to `오류` with a customer-readable reason.
2. Identity-field gate: the `document_type_required_fields.is_required=true` fields for that document type must be present with usable values and acceptable recognition confidence. These are not exhaustive extraction targets; they are the minimum anchors needed to decide that the submitted file is likely the requested document.

Policy:

- Strong identity evidence plus sufficient identity-field coverage may become `검수완료`.
- Clearly wrong document type becomes `오류`.
- Ambiguous documents should not be auto-approved even if Qwen claims they are probably correct.
- Qwen's top-level `decision=match` is not enough for approval. Exact spelling, whitespace, or minor wording differences do not have to match, but the extracted value must be usable for the requested document.
- Only `is_required=true` fields block customer acceptance. If these identity fields are empty, `미확인`, or have `낮음`/`미확인` confidence, the backend must keep the row out of `검수완료` and return `오류` with a customer-facing retry message.
- `is_required=false` fields are reference fields for accountant review and confidence explanation. They should not reject an otherwise useful customer upload by themselves.
- If the backend keeps an internal `확인필요` state, the current customer UI may still expose it as a rejection/resubmission request until the accountant layer is designed.
- Confidence percentage should behave like the weakest useful link across identity confidence, required-field coverage, and OCR/readability quality.

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
- `오류`: document type may be right, but required period, page, file, evidence, or quality is insufficient.
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

## 10. AI Pipeline

AuditMind currently assumes a primary OCR/document parsing pipeline plus Qwen3.6 for document judgment.

### PaddleOCR-VL

Role:

- OCR and document parsing.
- Extract text, table, layout, and reading-order artifacts from uploaded PDFs/images.
- Provide official JSON/Markdown artifacts for downstream Qwen document judgment.
- Current default OCR/document parsing path.

Endpoint:

- VLM backend base: `http://100.126.53.70:8118/v1`

Model:

- `PaddleOCR-VL-1.5-0.9B`

Pipeline:

- Use the official `PaddleOCRVL` pipeline.
- Do not call the PaddleOCR-VL `/v1/chat/completions` endpoint directly for the product OCR path. The VLM endpoint is only the recognition backend.

Official pipeline shape:

```txt
PaddleOCRVL
-> PP-LCNet_x1_0_doc_ori
-> UVDoc
-> PP-DocLayoutV3
-> PaddleOCR-VL-1.5-0.9B through vllm-server
-> official JSON/Markdown artifacts
```

Implemented wrapper:

- `backend/ocr/paddleocr_vl_pipeline.py`
- Local environment: `.venv-paddleocr`
- Project-local cache: `.paddlex-cache`

Language scope and quality rule:

- AuditMind's production OCR target is Korean accounting/tax/business documents.
- OCR must preserve Hangul, Hanja, Arabic numerals, dates, account numbers, business registration numbers, amounts, and table line structure.
- English-only receipt samples are acceptable only for endpoint smoke tests, not for product-quality evaluation.
- Performance and accuracy tests must include Korean documents and Korean/Hanja mixed text samples.

Current validation status:

- The official PaddleOCR-VL pipeline has been run against the approved bankbook scan at `tmp/ocr-samples/1f9cf99418d811ebb30606f6a435f0e7.png`.
- Output artifacts were written to `tmp/ocr-output/bankbook-paddle-pipeline/`.
- Core bankbook anchors were partially useful: account holder, account number, product name, branch/date/phone clues.
- Long Korean labels, notices, and table text still contained serious recognition errors.
- Product decision: PaddleOCR-VL is the current default OCR/document parsing path, but its output is still candidate extraction. Qwen required-field scoring and human review remain required for ambiguous or low-quality Korean documents.

Product path:

```txt
uploaded file
-> normalize / convert to OCR-ready page images when needed
-> official PaddleOCR-VL pipeline
-> JSON/Markdown OCR/layout artifacts
```

### Qwen3.6

Role:

- Reasoning and classification.
- Match OCR outputs to checklist items.
- Use multimodal original-page evidence with OCR artifacts for field judgment when the submitted document is visual/layout-heavy.
- Infer likely missing files, old versions, wrong periods, duplicate submissions, and candidate evidence relationships.

Endpoint:

- Base: `http://100.120.165.93:8090`
- Health: `http://100.120.165.93:8090/health`
- Models: `http://100.120.165.93:8090/v1/models`
- Chat: `POST http://100.120.165.93:8090/v1/chat/completions`

Model:

- `Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf`

Health/availability:

- `/health`: confirmed OK
- `/v1/models`: confirmed OK

Assumption:

- Reasoning is enabled by default.
- Short customer-facing guidance messages should still disable reasoning.
- For document field extraction/judgment, image input should be used when available. OCR-only text is insufficient for Korean forms with grids, small text, or table-heavy layout.

Network binding:

- Currently bound only to `127.0.0.1` and Tailscale IP.
- LAN `192.168.0.11` is not opened.

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

The current screens are implemented as a Vite + Tailwind static frontend.

Implementation rule:

- Every product page or major screen must have its own page module file.
- `src/main.js` must remain a thin router and shared bootstrap file only.
- Customer-layer pages and accountant-layer pages must not share page implementation files.
- Screen-specific copy and sample data should live in separate content/data files.
- New pages must be created as new files before being connected to routing.

View routing lives in:

- `src/main.js`

Customer portal content and rendering live in:

- `src/customerPortalContent.js`
- `src/customerPortal.js`

Accountant console content and rendering live in:

- `src/accountantShell.js`
- `src/accountantConsoleContent.js`
- `src/accountantConsole.js`
- `src/accountantCustomerManagementContent.js`
- `src/accountantCustomerManagement.js`
- `src/accountantSubmissionRequests.js`
- `src/accountantReview.js`
- `src/accountantTemplateManagement.js`

The HTML shell is:

- `index.html`

Self-hosted font:

- `public/fonts/PretendardVariable.woff2`

Dev copy edit mode:

- Open `http://127.0.0.1:4173/submit/demo-token?edit=1`
- Click visible text to edit.
- Local edits are stored in browser `localStorage`.
- Current storage key: `auditmind.customerPortal.copyOverrides.v3`

Accountant console preview:

- Open `http://127.0.0.1:4173/`
- Dashboard route: `http://127.0.0.1:4173/`
- Customer management route: `http://127.0.0.1:4173/?page=customers`
- Submission request route: `http://127.0.0.1:4173/?page=submission-requests`
- Customer submission portal route: `http://127.0.0.1:4173/submit/demo-token` in development and `/submit/{raw_token}` in production.
- The accountant console is the service root. The customer portal must not be mounted at `/`; it is link-only and token-scoped.
- Do not mix accountant console state, menu, or review actions into the customer portal module.

### Accountant Customer Management

The customer management page is the master-data screen for existing customers and contacts.

Current behavior:

- Left work card: customer list table.
- Right work card: selected customer basic information and contact list.
- The two cards reuse the same spacing, header height, header surface, table type scale, row height, and status-pill spacing.
- Customer list header shows `전체 #개사`.
- `신규 고객사 추가`, `담당자 추가`, and `저장` use the primary blue button style.
- The customer list cannot be collapsed.
- Selecting a customer updates the basic-info card and moves the `선택됨` pill without changing row height.
- Basic customer fields: customer name, business registration number, CEO name, business type, business item, business address, and `AI 고객사 분석`.
- `AI 고객사 분석` replaces the old editable memo area. It is a read-only AI-generated management summary, not a manually saved customer field in the current UI.
- The analysis panel shows a skeleton placeholder while generation is pending. Do not show literal copy such as `분석을 준비하고 있습니다`.
- Qwen generates the customer analysis from the selected customer's currently registered basic information and contact list. Later versions should add richer customer-history context when provided.
- Qwen customer analysis uses reasoning mode off and validates the finished response before display. If Japanese, Chinese, or Hanja characters appear, regenerate with stricter instructions. If generation fails, show the validated Korean fallback summary.
- The analysis should be 5-7 Korean sentences and summarize basic information, contact readiness, request-management implications, potential risks, and next check points.
- Qwen may wrap 2-4 genuinely important phrases in `**...**`. The UI must render those phrases as bold with underline, and must never display raw markdown markers.
- The analysis text streams into the panel after the final validated sentence is available.
- New customer creation requires customer name. Other basic fields are accepted in the same dialog.
- The new-customer dialog includes a business-registration-certificate upload control. It accepts PDF and common image files (`PDF`, `JPG/JPEG`, `PNG`, `HEIF/HEIC`, `WEBP`) and sends the file to `/api/customers/business-license/parse`.
- The business-license parser uses the same safe upload boundary as other files, then uses extracted PDF text and/or PaddleOCR-VL image OCR plus Qwen3.6 to fill candidate customer fields: customer name, business registration number, CEO name, business type, business item, and business address.
- If Qwen judges that the upload is not a business registration certificate or business registration certificate document, the frontend must show the warning and must not autofill the customer fields from that document.
- Business-license parsing is an autofill aid only. It must not create or update a customer record until the accountant checks the values and clicks `추가`.
- If PaddleOCR-VL is unavailable from the deployed API environment, the business-license parser should continue with Qwen multimodal judgment and available text evidence, while returning a warning for later infrastructure follow-up.
- For text-layer PDFs, prefer extracted text. For scanned PDFs, render the first page to an image when a server-side PDF rasterizer is available, then OCR that image. If no rasterizer is available, return a warning and fall back to available text evidence rather than blocking the dialog.
- The `저장` button in the selected customer card is disabled until any customer basic-info field changes. After saving, it shows `저장되었습니다.` and becomes disabled again.
- Customer deletion is a selected-customer action in the basic-info card. It requires two confirmation dialogs and uses destructive wording that the action cannot be reversed.
- Contact list supports multiple contacts per customer. The `대표` pill reserves fixed space so contact rows keep the same height.
- The contact-add dialog title is `담당자 추가`.
- Contact-add field labels are `이름`, `직급`, `연락처`, and `이메일`. Do not prefix these labels with `담당자` because the dialog context is already clear.
- `이름`, `연락처`, and `이메일` are required and must show red asterisks. `직급` remains optional.

Customer master database:

- Migration: `database/migrations/003_customer_master.sql`.
- Seed: `database/seeds/005_customer_seed.sql`.
- `customers` stores customer company master fields only: name, business registration number, CEO name, business type, business item, business address, created/updated timestamps, and created/updated user IDs.
- `customer_contacts` stores one or more contacts per customer: name, title, phone, email, primary-contact flag, created/updated timestamps, and created/updated user IDs.
- `created_by_user_id` and `updated_by_user_id` are text IDs for now because the login system is not implemented yet. Seed rows use `system`.
- Persist generated `AI 고객사 분석` in `customer_ai_analyses`. It is a cached management summary for the accountant-facing customer page, regenerated only when needed and not treated as authoritative customer master data.

The customer management page intentionally does not include service selection, submission-material selection, or sending controls. Those belong in `자료제출 요청`.

### Accountant Submission Request

The submission request page uses the customer management page format for consistency.

Current behavior:

- Left work card: request target customer list.
- Right work card: service and requested-document selection.
- Route: `/?page=submission-requests`.
- Navigation item: `자료제출 요청`.
- Left list shows customer, service name, and request state.
- The left card title is `고객사 선택`.
- Customers can be selected with checkboxes; multiple customers may be selected for the same request package.
- The `전체 #개사` bubble was removed from the customer selector. The selected-count bubble remains.
- Do not show a separate `선택됨` pill inside customer rows because the checkbox already communicates selection state.
- The right card title is `서비스`.
- The service list must show accounting-firm work packages from `request_templates`, not document categories.
- Services are accounting-firm work packages such as `부가가치세 신고`, `법인세 신고`, `재무실사`, or `투자유치 재무자료 준비`.
- Document categories such as `회사 기본자료`, `매출자료`, or `부가가치세자료` must not appear as services in this screen.
- The service table currently shows `서비스명`, `업무 영역`, and `내용`.
- The requested-document table shows document names that can be checked manually. Do not expose internal document codes in the UI.
- Service selection is a preset mechanism. When a service is selected, its mapped documents should become the default checked requested documents after `request_template_documents` mappings are added.
- A service is not a final authority. Accountants must be able to add or remove requested documents before sending.
- Manual requested-document additions and exclusions apply only to the current request package. They must not update the reusable service.
- Primary action: `발송`.
- The removed `새 요청`, `요청자료 추가`, and `미리보기` buttons should not appear in the current compact workflow.

Current send behavior:

- Keep the main page focused on customer selection, service selection, and requested-document selection.
- Do not add a large send-settings panel into the main page body unless explicitly requested.
- `발송` should start a modal flow, not send immediately.
- The send modal confirms selected customers, selected services, requested-document count, send methods, and customer-grouped recipient contacts.
- The customer-selection step selects companies. The send modal selects one or more contacts inside each selected company.
- Primary contacts are checked by default, and additional contacts can be checked manually.
- Before generating links, validate that every selected customer has at least one selected recipient contact, at least one requested document, and at least one send method.
- Clicking `발송 확정` opens a second confirmation card with `고객에게 발송하시겠습니까?`.
- Confirmation `확인` creates one `customer_submission_requests` row per selected customer, creates its `customer_submission_items`, stores `request_template_id` when exactly one service is selected, creates one hashed access-token row per selected contact, and returns `/submit/{token}` customer portal links.
- After successful link generation, the modal action changes to disabled `발송 완료`.
- Current MVP shows generated links in the modal instead of actually sending KakaoTalk/email/SMS.
- In development, the left navigation item `자료 제출 페이지 (고객용 데모)` should open the latest generated customer portal link in that browser after a successful send flow.
- Later production send should enqueue KakaoTalk/email/SMS delivery and persist delivery audit history.

Database backing:

- `request_templates`: accounting-firm work-package master.
- `request_template_documents`: mapping table between a request template and default requested document types.
- `customer_submission_requests`: generated customer-facing request package.
- `customer_submission_items`: requested document checklist rows generated from selected documents.
- `customer_submission_access_tokens`: hashed token rows backing `/submit/{token}` links.
- `document_types`: exact requestable document names.

### Accountant Service Management

The service management screen is for maintaining reusable request services.

Current behavior:

- Route: `/?page=templates`.
- Navigation item: `서비스 관리`.
- The page should fit within the accountant shell viewport; long lists must scroll inside their cards, not extend the entire document page.
- Left card: `서비스 목록`.
- Right card: `서비스 설정`.
- Entering the menu must show an existing selected service in the `서비스 설정` card, not a new-service draft.
- The top-right `신규 서비스 등록` button opens a `서비스 설정` modal for creating a service.
- A new service is not added to the list until the accountant enters the required service name and confirms creation.
- The new-service modal includes requested-document search and checkbox selection, because a service is a work-package plus its default requested-material bundle.
- Service settings include service name, service area, description, requested-material selection, save, and delete.
- Service management is database-backed through `/api/request-templates`. It reads `request_templates`, `request_template_documents`, `document_types`, and `document_type_required_fields`; local seed parsing is only a development fallback if the API is not reachable.
- Creating, saving, and deleting services must persist to `request_templates` and `request_template_documents`.
- The requested-material section title is `요청 자료`.
- The requested-material table shows `자료명` and `필수 항목`. Do not show document categories in this table.
- `필수 항목` is sourced from required OCR/Qwen fields in `document_type_required_fields` or the corresponding seed where `is_required=true`. These fields are the minimum anchors that must be recognized well enough for customer upload approval.
- Required-item editing is intentionally not shown inline. The accountant opens a `필수 항목 수정` card popup from the requested-material row context menu so the service management screen stays readable.
- Saving `필수 항목 수정` persists to `document_type_required_fields` through `PUT /api/document-types/{document_code}/required-fields`.

### Accountant Review

The submission review screen is where accountants inspect submitted files before approval, rejection, or hold.

Current behavior:

- Route: `/?page=review`.
- Navigation item: `제출자료 검토`.
- The page title is `원문 대조 작업대`.
- The primary workflow is company-centered, not individual-file-centered. Accountants should be able to finish one company, then move to the next company.
- Top selection area: two separate cards, `고객사 선택` and `서비스 선택`. In the accountant review page, the second card represents the actual service/request package provided to that customer, not the reusable template-maintenance concept.
- `고객사 선택` rows show four columns: `고객사`, `제출요청일`, `제출마감일`, and submitted-count pill.
- `제출요청일` comes from the customer submission request creation date. If a customer has multiple visible service packages, use the earliest request date in the customer selector summary.
- `제출마감일` comes from the customer submission request due date. If a customer has multiple visible service packages, use the earliest due date in the customer selector summary.
- In `고객사 선택`, the right-side pill shows submitted count over total requested count as `제출수 / 전체수`. Do not append `남음`.
- Customer selection pill color policy: red when submitted count is `0`, yellow when submitted count is greater than `0` but less than total, and green when submitted count equals total.
- Lower work area: after a customer and service are selected, show only the documents belonging to that selected pair.
- Left lower card: selected customer/service document list with only document name/file hint and status. Do not show a completion summary pill in the card header, and do not show a list-level confidence column here.
- The left document-list table headers `자료` and `상태` use the same clickable sort treatment as the right required-field table headers.
- Center lower card: selected document viewer.
- Right card: review assistance panel.
- The right panel header shows only the document name. Do not show the label `AI 보조 검토`, status pills, required-field summary pills, or a top-level `신뢰도 ##%` pill in this header.
- Confidence belongs in field-level rows or stored processing details, not as the dominant header message.
- The only visible confidence column in the accountant review page is the right-panel required-field table. The left document list must not show confidence, because it is a navigation list, not an AI scoring surface.
- The required-field table keeps the column header row `항목 / 내용 / 신뢰도`. Do not add a separate internal title row such as `필수 항목` above the table.
- In the required-field table, display `미확인` confidence as `확인 필요` so the word fits the `신뢰도` column better. Internal logic may still use `미확인` as a machine state.
- The visible `판정 요약` should be short and operational. Examples: `계좌번호 항목이 확인되지 않았습니다. 나머지 필수 항목은 확인되었습니다.` or `모든 필수 항목의 내용과 신뢰도가 확인되었습니다.`
- The separate `근거` card is removed from the current right panel. Evidence can remain in persisted processing data, but the normal review surface should prioritize the original viewer, required-field table, and memo.
- The accountant review panel shows customer-written `요청사항` above `메모`. This is read-only context pulled from the customer submission portal request. The `요청사항` label sits above the card; do not show submitted/draft status pills inside this card.
- The accountant review panel separates `메모` from `고객에게 보낼 코멘트`. `메모` is for the accounting-firm workflow only and its placeholder is `내부 검토 기록을 입력하세요.` Customer comment is the text that may be surfaced back into the customer's submission portal as `요청사항`.
- Review actions currently expose only `재요청`. The previous accountant-side `검수완료` action is removed until its downstream workflow is explicitly defined.
- The accountant review page must not show customer-side rejected uploads as reviewable files. A `rejected` upload has already been returned to the customer for re-upload.
- Even when a customer upload was rejected, the requested document item itself must remain visible to accountants as `미제출`, because the accountant needs to know that this company/service is still missing that requested material.
- `미접수`/`not_received` rows and customer-side `오류`/`rejected` rows should appear in the company 자료 목록 as `미제출` so accountants can see what is still missing for that company/service.
- Selecting a `미제출` row shows a no-file empty viewer and disables `재요청`, because there is no submitted evidence to inspect.
- The review screen must not use frontend fallback/demo data as a substitute for missing API data. If persisted review data is unavailable, show a loading, empty, or unavailable state.
- If the reviewable queue is empty, show an explicit empty state instead of falling back to sample rows.
- If an accountant clicks `재요청`, that row leaves the visible review queue immediately after being marked `rejected`.
- The viewer has two rendering paths: render the original file directly when the browser/viewer can preserve it reliably, or render a display conversion when direct rendering is not reliable.
- All viewer-ready artifacts must already exist before the accountant opens the page. Upload/background processing creates the viewer file, OCR/text artifact, Qwen judgment, required-field values, field confidence, and field source-region coordinates.
- When the customer-upload pipeline sends a visual document to Qwen, the expected JSON output includes optional `sourceRegion` coordinates for each visible required field. The coordinates use `{ page, x, y, width, height }` percentages relative to the displayed page/image.
- The backend may normalize equivalent `region` or `bbox` output into `sourceRegion`, but must not fabricate coordinates when the model or OCR result cannot support them.
- The accountant page may draw persisted overlays and hover connectors, but must not compute new OCR boxes, source coordinates, document routing, confidence, or file conversions.
- If a submitted item has no persisted viewer file or overlay artifact, show an explicit unavailable state. Do not render mock document pages or sample analysis.
- Direct render: `PDF`, `JPG/JPEG`, `PNG`, and `WEBP`.
- Display-image conversion: `TIFF/TIF`, `HEIC/HEIF`.
- Display-PDF conversion: `XLS/XLSX/XLSM`, `DOC/DOCX`, `PPT/PPTX`, `HWP/HWPX`, `CSV/TSV`, and other office/table formats that need layout-preserving review.
- `ZIP` is expanded first; each internal file follows the same direct-render or conversion rule by extension.
- Excel files must not be treated as an HTML table as the source of truth. Merged cells, print areas, hidden/blank rows, and pagination must be judged from the layout-preserving display conversion.
- Multiple pages must be supported in one scrollable viewer. Do not rely on previous/next page buttons for long documents.
- The viewer must support both vertical scrolling for long/multi-page documents and horizontal scrolling for wide converted spreadsheets.
- The viewer should size a normal document page so roughly one A4 page is visible in the work area at a time, then allow vertical scroll or snap to the next page.
- Wide spreadsheet conversions should preserve their wide page width instead of being squeezed into the viewport; horizontal scrolling is required for those files.
- AI/OCR extracted values, confidence, reasons, and evidence are supplementary. Final accounting judgment must be made against the visual file evidence shown in the viewer.
- OCR/Qwen-recognized source regions should be rendered as rectangular overlays on top of the visual document when persisted coordinates are available. These boxes are review aids only; they show where the system believes each field came from and must not replace manual visual confirmation.
- Overlay labels should not be permanently printed over the document because they can cover the original content. The default state should be faint rectangles only; hovering or focusing the matching required-field row may emphasize the corresponding rectangle.
- The default rectangle must still be visible enough for review. Use a thicker, low-opacity outline rather than a nearly invisible 1px line.
- Hovering or focusing a required-field row should immediately draw an animated dashed connector from the row to the document region. Clicking the row should lock that field as the active comparison target.
- Hovering, focusing, or clicking a required-field row should also smoothly scroll the document viewer so the matching rectangle moves toward the center of the viewer, including both vertical and horizontal scroll offsets.
- When the accountant manually scrolls either the document viewer or the required-field panel while a field is active, the dashed connector should keep following the current on-screen positions instead of remaining at stale coordinates.
- If the selected source rectangle or the selected required-field row is scrolled out of the visible area, hide the dashed connector until both endpoints are visible again.
- The accountant review screen must not trigger OCR, Qwen, conversion, classification, or other heavy model work when an accountant opens the page. This screen is a review surface, not a processing trigger.
- OCR, text extraction, file conversion, document routing, required-field scoring, Qwen judgment, confidence calculation, and customer-facing rejection reason generation must run when the customer uploads or finally submits files, or in a backend/background worker immediately after that event.
- The accountant review screen reads already persisted artifacts: original file location, display-rendered file location, OCR/text artifacts, Qwen JSON judgment, required-field values, confidence, reasons, and processing status.
- Re-running model analysis from the accountant page is allowed only as an explicit administrator/debug action, never as the normal page-load behavior. Normal review must be deterministic and auditable from stored processing results.
- The visible `판정 요약` in the accountant review panel must be generated only from the required-field table values and their confidence labels. Do not summarize unrelated OCR text, page decorations, bank terms, footer notices, or model commentary in this field.
- The current low-confidence bankbook sample intentionally degrades the account-number area so OCR/Qwen cannot trivially read it. This sample exists to verify the `미확인` path and must not be treated as a real customer document.
- `document_categories`: internal organization only. Do not expose categories as templates in accountant-facing request creation.

Current database state:

- `request_templates` has been seeded with 111 accounting-firm work templates across accounting/audit/assurance, tax filing/tax agency, international tax, accounting/BPO, transaction advisory, financial reporting advisory, startup/growth-company work, and industry-specific work.
- `request_template_documents` exists but is intentionally not fully populated yet. Template-document mappings must be created after searching common requested documents for each work package.
- Do not add source URLs, confidence levels, or unverified flags to the MVP mapping table unless explicitly requested. Keep the mapping simple.

## 13. Non-Goals For Now

Do not implement these until explicitly requested:

- Production authentication.
- Real file upload backend.
- Real OCR execution from the browser or accountant review page load. OCR/model work belongs to the upload/background-processing pipeline.
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
