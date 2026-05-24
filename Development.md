# AuditMind Development Environment

This file is the source of truth for the local development setup. Update it whenever the project tooling, ports, preview workflow, or verification commands change.

## Default Stack

- Build tool and dev server: Vite
- Styling: Tailwind CSS
- UI implementation: static HTML with Tailwind utility classes
- Browser automation and regression checks: Playwright
- Database: PostgreSQL through Docker Compose
- OCR/document parsing: official PaddleOCR-VL pipeline with Qwen3.6 multimodal judgment
- Local dev URL: `http://127.0.0.1:4173/`
- VS Code preview target: VS Code Integrated Browser or Simple Browser opened to `http://127.0.0.1:4173/`

## Commands

Run all commands from the project root:

```sh
/Users/peseux7001/Projects/Auditmind
```

Primary commands:

```sh
npm run dev
npm run build
npm test
npm run test:files
```

Additional commands:

```sh
npm run preview
npm run test:files
npm run test:headed
npm run pw:open
npm run pw:report
npm run db:up
npm run db:apply
npm run db:shell
npm run db:down
```

## Development Server

Use Vite for all active development:

```sh
npm run dev
```

The Vite server is configured to run at:

```txt
http://127.0.0.1:4173/
```

The port is intentionally fixed in `vite.config.mjs` with `strictPort: true`. If the port is already in use, stop the existing process before starting the Vite server. Do not go back to `python3 -m http.server` for normal development because it does not provide HMR.

## HMR Workflow

Keep `http://127.0.0.1:4173/` open in the VS Code Integrated Browser or Simple Browser.

When editing:

- `index.html` changes should reload through Vite.
- `src/styles.css` changes should update through Tailwind and Vite.
- `src/main.js` changes should update through Vite HMR.

Codex cannot directly control the VS Code Integrated Browser tab in this environment. The reliable workflow is:

1. Keep the VS Code browser open at `http://127.0.0.1:4173/`.
2. Make code changes in the workspace.
3. Let Vite HMR update the browser.
4. Use Playwright for automated rendering and responsive checks.

## Dev Copy Editing

During local development, open the customer portal with:

```txt
http://127.0.0.1:4173/submit/demo-token?edit=1
```

This enables browser-only copy editing:

- Click visible copy to edit it directly.
- Press `Enter` or blur the field to save.
- Edits are stored in `localStorage` under `auditmind.customerPortal.copyOverrides.v3`.
- The reset button clears local edits and restores `src/customerPortalContent.js`.

This is for development only. Production builds do not enable the edit UI because it is guarded by Vite dev mode.

For deterministic Playwright UI regression checks, open the customer portal with:

```txt
http://127.0.0.1:4173/submit/demo-token?mock=1
```

`mock=1` is development-only. It prevents the customer portal from replacing fixture content with the mutable PostgreSQL/API demo request. Do not use it for real upload testing.

## File Structure

Non-negotiable frontend structure rule:

- Each product page or major screen must live in its own page module file.
- `src/main.js` is only allowed to route between page modules and perform shared bootstrapping.
- Never put multiple page implementations into `src/main.js`.
- Never mix customer-layer UI code and accountant-layer UI code in the same page file.
- Each page module should have its own content/data file when it has screen-specific copy or sample data.
- When adding a new page, create a new file first, then connect it from the router.

Current frontend entry points:

- `index.html`: main page markup and Tailwind utility implementation
- `src/main.js`: Vite entry point and view router only. It selects the customer portal or accountant console by URL state.
- `src/customerPortal.js`: customer submission portal rendering, state, copy-editing, upload overlay, and checklist interactions.
- `public/fonts/PretendardVariable.woff2`: self-hosted Pretendard variable font
- `src/customerPortalContent.js`: editable customer portal copy and checklist data
- `src/accountantShell.js`: shared accountant shell, left navigation, top header, notification menu, account menu, and shared accountant component classes.
- `src/accountantConsole.js`: accountant dashboard and review queue rendering.
- `src/accountantConsoleContent.js`: accountant dashboard sample data.
- `src/accountantCustomerManagement.js`: customer master-data and contact-management page.
- `src/accountantCustomerManagementContent.js`: customer management sample data.
- `src/accountantSubmissionRequests.js`: submission-request workspace page.
- `backend/api/server.mjs`: minimal Node API for customer and contact master-data reads/writes.
- `src/documentRouting.js`: temporary frontend routing-contract adapter and conservative document-judgment policy used until the backend API is connected
- `src/styles.css`: Tailwind CSS import and base styles
- `vite.config.mjs`: Vite and Tailwind plugin configuration
- `playwright.config.js`: Playwright test configuration and Vite web server setup
- `tests/auditmind.spec.js`: smoke and responsive checks
- `backend/document_processing/file_processor.py`: safe upload normalization and lightweight extraction for every accepted file extension
- `backend/tests/test_file_processor.py`: unit tests for accepted file handling, archive safety, OCR queueing, and conversion routing
- `docker-compose.yml`: PostgreSQL, Node API, and Nginx web services
- `nginx.conf`: production/static-web Nginx config with `/api/customers` proxy to the API service
- `.env.example`: local database environment template
- `database/migrations/001_document_type_master.sql`: PostgreSQL schema for document type master, submission requests, uploaded files, and classification results
- `database/migrations/002_request_template_master.sql`: PostgreSQL schema for accounting-firm request templates and template-document mappings
- `database/migrations/003_customer_master.sql`: PostgreSQL schema for customer company and customer contact master tables
- `database/migrations/004_submission_review_notes.sql`: PostgreSQL schema extension for accountant internal memo and customer-facing document comments
- `database/seeds/001_document_type_seed.sql`: Korean accounting document type seed data
- `database/seeds/002_document_required_fields_seed.sql`: minimum required-field anchors for OCR/Qwen document judgment and confidence scoring
- `database/seeds/003_request_template_seed.sql`: Korean accounting-firm request template seed data
- `database/seeds/004_request_template_document_seed.sql`: default request-template document mappings
- `database/seeds/005_customer_seed.sql`: sample customer and contact seed data for the customer management screen
- `database/seeds/006_accountant_review_seed.sql`: sample persisted review items, uploaded-file metadata, and Qwen classification artifacts for the submission-review screen
- `database/apply_local.sh`: applies local database migration and seed files in order
- `database/README.md`: database setup and design notes
- `backend/ocr/paddleocr_vl_pipeline.py`: current official PaddleOCR-VL document parsing wrapper
- `backend/ocr/README.md`: OCR pipeline usage notes
- `ProductSpec.md`: product direction, customer layer spec, AI pipeline assumptions
- `Design.md`: product design guidelines based on the Microsoft Teams UI Kit reference

Generated folders:

- `dist/`: production build output
- `test-results/`: Playwright run artifacts
- `playwright-report/`: Playwright HTML report
- `node_modules/`: installed dependencies

## Verification

Before considering UI work complete, run:

```sh
npm run build
npm test
```

The Playwright config starts or reuses the Vite server at `http://127.0.0.1:4173`.

Expected baseline:

- `npm run build` completes successfully.
- `npm test` passes Chromium, WebKit, and mobile projects.
- `npm run test:files` passes backend file processing tests.

Current verified baseline:

- `npm run build`: passed
- `npm run test:files`: `16 passed`
- Customer portal focused Playwright check: `12 passed`
- Full `npm test`: currently `57 passed / 15 failed` in this workspace because several accountant-page tests still expect older headings or mutable PostgreSQL demo state. Fix or isolate those tests before treating the full suite as the release gate.

## Current Implemented Screens

The frontend now has separate screen modules. Keep them separate:

- Customer portal route: `http://127.0.0.1:4173/submit/demo-token`
- Accountant console route: `http://127.0.0.1:4173/`
- Accountant customer management route: `http://127.0.0.1:4173/?page=customers`
- Accountant submission request route: `http://127.0.0.1:4173/?page=submission-requests`

Production entry rule: `/` is the accountant console. Customer-facing pages are only under `/submit/{token}` so a shared KakaoTalk/email link stays stable for that client request.

`src/main.js` must remain a thin router. Do not put customer or accountant screen markup back into it.

## Current Server Deployment

Public host:

```txt
https://auditmind.navingate.com/
```

Fedora server deployment path:

```txt
/home/popul/services/auditmind
```

Current server containers:

- `auditmind-web`: Nginx static frontend, bound to `127.0.0.1:4173`.
- `auditmind-api`: Node customer-management API, bound to `127.0.0.1:4174`.
- `auditmind-postgres`: PostgreSQL 16, bound to `127.0.0.1:5433`.

Deployment command from the local workspace:

```bash
npm run deploy:fedora
```

The deploy script builds the Vite app, syncs the source to `/home/popul/services/auditmind`, syncs `dist/` into the server `site/` directory for Nginx, applies database migrations/seeds, and restarts the API/Web containers.

The deploy script intentionally preserves:

- server `.env`
- Docker database volume
- server `public/uploads/`
- server `site/uploads/`

Server database status:

- `database/migrations/001_document_type_master.sql` applied.
- `database/migrations/002_request_template_master.sql` applied.
- `database/migrations/003_customer_master.sql` applied.
- `database/migrations/006_document_type_dedupe.sql` must be applied before reseeding existing databases so same-name document rows are canonicalized.
- `database/seeds/001_document_type_seed.sql` applied.
- `database/seeds/002_document_required_fields_seed.sql` applied.
- `database/seeds/003_request_template_seed.sql` applied.
- `database/seeds/004_request_template_document_seed.sql` applied.
- `database/seeds/005_customer_seed.sql` applied.

Verified server counts:

- `document_types`: 217 after same-name document dedupe
- `request_templates`: 111
- `customers`: 4
- `customer_contacts`: 6

The customer management screen now reads and writes customer master data through `/api/customers`. The submission-review screen reads and updates persisted review items through `/api/review-items`. Nginx proxies both paths to `auditmind-api`, and the API persists changes in PostgreSQL.

### Customer Portal

Current page behavior:

- The implementation uses component-only refinement from the Microsoft Teams UI Kit reference. It does not import decorative Figma assets or illustrations into this customer portal screen. Buttons, status bubbles, pills, filter segments, panels, overlays, list rows, and tooltip-like controls share reusable class contracts in `src/customerPortal.js`.
- Component adoption should preserve the current workflow and layout unless the user explicitly asks for a redesign. Prefer improving consistency, states, spacing, focus behavior, and scan quality through shared controls.
- The visual direction should avoid a generic AI-generated card-stack look. Prefer flatter Teams/Fluent-like work surfaces, restrained borders, compact rows, visible state, and neutral backgrounds over decorative dashed cards or oversized showcase sections.
- A checkpoint commit was created before testing the Whitepace reference direction: `0829884 Initial AuditMind customer portal checkpoint`.
- Whitepace reference use is limited to component-level treatment: deeper SaaS header color, brighter primary action color, softer blue work surfaces, and yellow deadline accent. Do not copy the landing page structure or marketing sections into the customer portal.
- Customer sees a dedicated submission portal.
- Access-state pages keep the same header/footer frame. Expired or revoked links show `이 링크는 더 이상 사용할 수 없습니다.` and invalid links show `접근할 수 없는 제출 페이지입니다.`.
- Company badge currently uses sample data: `샘플테크 주식회사`.
- Header brand symbol is data-driven. It defaults to the `AM` text fallback, and can later use `brand.symbolImage` for an accountant firm or service provider logo.
- Request title currently uses sample data: `2025년 1기 부가가치세 신고 검토 자료 제출 요청`.
- Header meta/description are intentionally hidden for now.
- Upload section accepts multiple files and explains supported and unsupported file formats.
- Supported file details are shown through the compact `지원파일` tooltip placed next to the `자료 업로드` heading.
- Upload guidance about low-quality or incomplete materials and internal-only use of personal information appears inside the upload panel, directly below the `자료 업로드` heading.
- Checklist is vertical, status-driven, and sorted by customer attention priority: `분석 중`, `오류`, `미접수`, `검수완료`, then `접수완료`.
- Checklist filters are functional: `전체` shows every row, and `미접수` hides `검수완료` and `접수완료` rows.
- Item upload actions all use `파일 업로드`. The `분석 중` and `접수완료` rows keep `파일 업로드` visible but disabled.
- Each checklist item shows `최종 접수` next to the upload action. It is enabled only for `검수완료` rows and disabled for `분석 중`, `오류`, `미접수`, and `접수완료`.
- Clicking `최종 접수` opens a confirmation card. Confirming changes that row to `접수완료`, updates its review line to `최종 접수가 완료되었습니다.`, and disables both row buttons.
- Checklist row body copy now uses the second line for AI review state instead of generic document descriptions. Approved rows show a review completion percentage, missing rows ask for upload, processing rows say analysis is running, and rejected rows show the rejection reason.
- Approved or finally submitted rows show the attached filename as a clickable download link on the third line.
- `src/documentRouting.js` contains the temporary frontend routing-contract adapter and the current conservative document-judgment policy used by tests. Qwen document identity is only one gate; required-field coverage plus OCR/readability quality must also pass before automatic approval. Ambiguous documents must not be approved merely because the model claims they are probably correct.
- Required-field strictness is intentionally two-level only. `document_type_required_fields.is_required=true` means an identity field that can block customer acceptance when missing or unreadable. `is_required=false` means a reference field for accountant review and confidence explanation; it must not reject an otherwise useful customer upload by itself.
- Production upload behavior must move this temporary routing logic to the customer submission backend/background worker. The customer submission portal is the normal trigger for OCR, conversion, Qwen judgment, required-field scoring, confidence calculation, and customer-facing rejection/retry reasons.
- Accountant-facing review pages must consume the persisted results from those jobs. They must not start OCR/Qwen/conversion/classification work on page load or ordinary review interaction.
- Current MVP runtime path:
  - `GET /api/submission-portal/:token` loads the customer-facing request from PostgreSQL using a stable hashed token.
  - `POST /api/submission-portal/:token/upload` accepts real multipart uploads, stores the original files in `public/uploads/{request_id}/`, inserts `uploaded_files`, marks pending checklist rows as `분석 중`, and starts a best-effort background OCR/Qwen classification attempt.
  - Uploads pass through the backend file-processing boundary before analysis. The API validates supported extensions, rejects executables for direct upload, enforces `AUDITMIND_MAX_UPLOAD_FILE_BYTES`, safely expands ZIP files, rejects encrypted/unsafe archives, and stores accepted ZIP children as individual uploaded files.
  - ZIP children with unsupported or executable extensions are ignored and are not stored or analyzed. They must not reject the whole archive when at least one supported child file is present.
  - CSV/TSV, XLSX/XLSM, DOCX, and HWPX can provide extracted text/table evidence to Qwen. Images still use PaddleOCR-VL first. Legacy XLS/DOC/HWP remain supported inputs but depend on the configured converters listed below.
  - `PUT /api/submission-portal/:token/customer-request` stores the customer-written `요청사항` as draft or submitted.
  - `PUT /api/submission-portal/:token/items/:item_id/final-submit` marks an approved checklist row as `접수완료`.
  - `GET /api/submission-files/:file_id` streams the stored uploaded file for download/review links.
  - This is still a direct API proof path, not the final durable job queue.
- The request summary's left blank area, directly below the request title, includes the `안내 메시지` text. Manual accountant copy takes priority; if empty and AI generation is enabled, the frontend calls Qwen through the local Vite proxy and streams the validated final text into that existing space.
- The top `안내 메시지` is generated only once on first page entry. Uploads, polling updates, checklist status changes, and final submission actions must not regenerate or re-stream it.
- Selecting files in the bulk upload input shows a full-screen dimmed upload progress overlay.
- Upload and upload-complete overlay descriptions are split by sentence line.
- When upload receipt completes, the overlay title changes to `파일 분석 시작`, shows the upload-complete/body copy, and waits for `확인`.
- Upload failure has a dedicated overlay state with `파일 업로드 실패`, retry, and close actions. The visible copy is intentionally short: `파일 업로드에 실패했습니다.` and `인터넷 연결을 확인한 뒤 다시 시도해 주세요.`
- The overlay card keeps a stable height between upload-progress and analysis-start states.
- Clicking `확인` moves submitted rows into `분석 중` while classification continues.
- Progress card includes both submission progress and deadline pressure.
- The submission progress bar is API-driven from approved/submitted checklist rows. Do not hardcode a visual percentage in the frontend.
- The deadline progress bar starts from the day the accountant sends the request and ends at the submission deadline. In the current schema this uses `customer_submission_requests.created_at` as the sent date; introduce `sent_at` later if draft creation and sending become separate events.
- The previous `참고 사항` footer has been replaced with a full-width legal/business footer. Submission-state and access-notice cards were removed to reduce screen noise. Detailed upload-quality and privacy guidance belongs in the upload panel when it is directly related to file submission.
- The legal footer is data-driven through `legalFooter` in `src/customerPortalContent.js`. It currently uses placeholder provider information and should later be wired to administrator-managed company settings.

### Accountant Shell

The accountant shell is shared across accountant pages and must stay separate from customer portal code.

Current shell behavior:

- Left navigation: `대시보드`, `고객사 관리`, `자료제출 요청`, `제출자료 검토`, `서비스 관리`, `설정`.
- Top header: page context, notification bell, and signed-in user menu.
- The left shell brand block can show a product logo through `shellContent.brand.logoImage`. The current asset is `public/brand/auditmind-logo.png`, derived from the provided AuditMind logo and placed in the blank space to the right of `자료 검토 콘솔`.
- The notification menu opens from the bell, closes on outside click or Escape, and can show realtime notification toasts through the `auditmind:notification` browser event.
- Notification policy: show individual `자료 접수` events only. One notification equals one submitted document that has completed AI validation and has moved into the accountant review queue.
- Notification title line shows the customer/company name. Notification detail line shows the document name.
- Do not repeat generic copy such as `AI 검수 완료 후 제출자료 검토로 넘어왔습니다.` in every notification row.
- Do not aggregate notifications as `신규 제출 자료 N건`. Do not show customer-written `요청사항` as bell notifications, because those are request context, not individual review-ready documents.
- Realtime notification events should use `kind: "review-ready"` or type `자료 접수`/`검토 대기자료`; other event types are ignored by the shell.
- The account bubble opens a small logout menu.
- Each left menu item should route to a distinct page body module while preserving the shell.

### Accountant Dashboard

Route:

```txt
http://127.0.0.1:4173/
```

Current dashboard behavior:

- Top summary cards: `검토 대기 자료`, `자료 미제출 고객사`, `고객사 요청사항`.
- Card helper pills expose hover-only customer lists.
- Dashboard card gear/settings buttons are intentionally hidden to keep the overview quiet.
- Header action button was removed and replaced by the notification bell.
- Main table title is `검토 대기자료`.
- Table columns: customer company, service name, document name, state, confidence, and deadline.
- Sorting controls: `고객사별`, `접수순`, `마감임박순`. Clicking the same sort toggles direction.

### Accountant Customer Management

Route:

```txt
http://127.0.0.1:4173/?page=customers
```

Current customer management behavior:

- Uses the accountant shell and changes only the main work canvas.
- Loads customer and contact data from PostgreSQL through `/api/customers`.
- Keeps sample content only as a local fallback if the API cannot be reached.
- Persists customer creation, customer edits, customer deletion, and contact creation through the API.
- The API records `created_by_user_id` and `updated_by_user_id`; until login exists, this uses `AUDITMIND_CURRENT_USER_ID`.
- Left card: customer list table.
- Right card: selected customer basic information and contact list.
- Both cards use the same header height, soft header background, compact table scale, and row spacing.
- Customer count is shown as `전체 #개사`.
- `신규 고객사 추가`, `담당자 추가`, and `저장` use the primary blue button style.
- The customer list cannot be collapsed.
- Selecting a customer updates the right card and moves the `선택됨` pill without changing row height.
- Basic fields: customer name, business registration number, CEO name, business type, business item, business address, and `AI 고객사 분석`.
- `AI 고객사 분석` is rendered as a read-only analysis panel, not as an editable textarea.
- While Qwen generation is pending, the panel shows skeleton shimmer rows. Do not display placeholder copy such as `분석을 준비하고 있습니다.`.
- The frontend currently calls Qwen through `/api/qwen/chat/completions` using `Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf`, reasoning mode off.
- The API implements `/api/qwen/chat/completions` as a backend proxy to the local Qwen endpoint. The browser should call this application endpoint, not the Tailscale model URL directly.
- Qwen receives the selected customer's basic information and registered contacts. The current implementation does not yet include historical submissions, prior rejection patterns, or service history; those should be added later when the user provides the data source.
- The generated analysis should be 5-7 Korean sentences covering customer basics, contact readiness, request-management implications, potential risks, and next check points.
- The Qwen prompt allows 2-4 important phrases to be wrapped in `**...**`. The UI parses this limited markdown and renders those phrases as bold with underline. Raw markdown must not be visible.
- If Qwen returns Japanese, Chinese, or Hanja characters, the frontend retries once with stricter Korean-only instructions. If generation still fails or times out, the UI streams a local Korean fallback analysis.
- New customer dialog collects all basic fields and requires customer name. The required label includes a red asterisk.
- The new customer dialog has a business-registration-certificate upload control wired to `POST /api/customers/business-license/parse`.
- Accepted business-license upload formats are `PDF`, `JPG/JPEG`, `PNG`, `HEIF/HEIC`, and `WEBP`. The backend rejects other file types for this endpoint before storing anything durable.
- The endpoint uses `parseMultipartFormData`, `runUploadProcessor`, PaddleOCR-VL image OCR, and Qwen3.6 with reasoning mode off. It returns candidate fields only; the frontend fills the dialog inputs and the accountant must review them before saving.
- The frontend fills dialog inputs only when Qwen returns `isBusinessRegistrationCertificate=true`. Wrong-document uploads show a warning and do not overwrite form fields.
- If PaddleOCR-VL is unreachable from the deployed API container, the endpoint must not fail the whole upload. It records a warning and continues with Qwen multimodal judgment and any extracted text evidence.
- PDF handling is layered: text-layer PDFs contribute extracted text; scanned PDFs attempt first-page rasterization with `pdftoppm` and then use PaddleOCR-VL. If the rasterizer is unavailable, the endpoint falls back to extracted text and returns a warning.
- The selected-customer `저장` button is visually and functionally disabled until a basic-info field changes. Saving shows `저장되었습니다.` and disables the button again.
- Customer deletion lives in the selected customer card beside save. It requires two confirmation dialogs before permanent deletion.
- Contact list supports multiple contacts. The `대표` pill reserves fixed width even when hidden so contact row height matches the customer list pattern.
- The contact-add dialog title is `담당자 추가`.
- Contact-add labels are `이름`, `직급`, `연락처`, and `이메일`; do not prefix these labels with `담당자`.
- `이름`, `연락처`, and `이메일` are required and show red asterisks. `직급` is optional.
- Customer master database support lives in `database/migrations/003_customer_master.sql` and `database/seeds/005_customer_seed.sql`.
- `customers` stores customer company master fields only: name, business registration number, CEO name, business type, business item, business address, timestamps, and text user IDs for created/updated audit fields.
- `customer_contacts` stores contact name, title, phone, email, primary-contact flag, timestamps, and text user IDs for created/updated audit fields.
- Login is not implemented yet, so audit user IDs are text values and seed data uses `system`.
- Store generated `AI 고객사 분석` in `customer_ai_analyses`. The customer management page reads the persisted analysis first; if none exists, it generates one with Qwen and saves it back to the database.
- Service selection, material selection, and sending controls do not belong here.

### Accountant Submission Requests

Route:

```txt
http://127.0.0.1:4173/?page=submission-requests
```

Current submission request behavior:

- Uses the same card layout, spacing, colors, table scale, and row-height conventions as customer management.
- Left card: customer selector.
- Right card: service selector and requested-document selector.
- Left table columns: `선택`, `고객사`, `대표 담당자`, `직급`, and `전화번호`.
- Customer selection supports multiple checkboxes.
- The customer selector shows only the selected-count bubble, not a total-count bubble.
- Customer rows do not show `선택됨` pills because checkbox state is sufficient.
- The right `서비스` area should read service/work-package data from `/api/request-templates` when API mode is available.
- Service rows represent accounting-firm work packages, not document categories.
- Do not show document categories such as `회사 기본자료`, `매출자료`, or `부가가치세자료` in the service table.
- Service columns: `서비스명`, `업무 영역`, and `내용`.
- Requested-document rows should read from `/api/request-templates` when API mode is available.
- Do not display internal document-type codes in the UI.
- Service selection prechecks mapped requested documents through `request_template_documents`.
- Manual document additions and unchecked service-default documents are request-local overrides. They must not mutate the service seed or service management state.
- The `새 요청`, `요청자료 추가`, and `미리보기` actions are intentionally hidden for now.
- Primary action: `발송`.
- `발송` opens a modal confirmation flow instead of adding send settings into the main page body.
- The send modal shows selected customer count, selected services, requested-document count, selectable send methods (`카카오톡`, `이메일`, `문자`), and customer-grouped contact checkboxes.
- Each selected customer contributes its primary contact as the default checked recipient. Additional contacts in the same customer can be checked in the modal, and non-primary contacts can also receive their own access link.
- `발송 확정` is enabled only when every selected customer has at least one checked contact, at least one send method, and at least one requested document.
- Clicking `발송 확정` opens a second confirmation card with `고객에게 발송하시겠습니까?`.
- Confirmation `확인` calls `POST /api/submission-requests`. The API creates one `customer_submission_requests` row per selected customer, creates requested `customer_submission_items`, creates one hashed access-token row per selected contact, and returns `/submit/{token}` links.
- After successful link generation, the main modal action changes to disabled `발송 완료`.
- The modal displays generated customer portal links so the accountant can open or copy them during MVP testing.
- After successful link generation, the left navigation item `자료 제출 페이지 (고객용 데모)` points to the latest generated `/submit/{token}` link in that browser.
- KakaoTalk/email/SMS delivery integration, send-history persistence, and final confirmation audit log are still pending.
- Do not add send settings into the main page body; keep the page compact and use modal flows for send behavior.

Current database support:

- `request_templates`: 111 seeded accounting-firm work templates.
- `request_template_documents`: seeded default requested-document links for the request templates.
- `customer_submission_requests.request_template_id`: optional link from a customer request package to the selected request template.
- API endpoint: `GET /api/request-templates` returns both services and requestable document master rows for service/request screens.
- API endpoint: `POST /api/submission-requests` accepts `customerIds`, `contactIds`, `templateCodes`, `documentCodes`, and `sendMethods`, then returns generated customer portal links. `contactIds` are recipient contacts; the request package remains one per customer.
- Vite development proxy includes `/api/submission-requests` so the request screen can call the local API service through the same origin.

### Accountant Service Management

Route:

```txt
http://127.0.0.1:4173/?page=templates
```

Current service management behavior:

- Uses the accountant shell and changes only the main work canvas.
- The service management work area must fit inside one viewport-height canvas. Do not let the longest list stretch the whole page downward.
- `서비스 목록` and `서비스 설정` each own their internal scroll areas.
- Left card: `서비스 목록`.
- Right card: `서비스 설정`.
- Menu entry shows the first existing service in the settings card by default. It must not start in new-service mode.
- The top-right `신규 서비스 등록` button opens a `서비스 설정` creation modal.
- The list is unchanged until the required service name is entered and creation is confirmed.
- The creation modal must include requested-document search and selection, not only service name/description fields.
- The settings card edits service name, service area, description, and included documents.
- Service management reads services, requested-document mappings, document master rows, and required items from `/api/request-templates`. The previous seed parsing is only a local fallback when the API is unavailable.
- `저장`, `신규 서비스 등록`, and `서비스 삭제` persist through `/api/request-templates`.
- The settings card labels included documents as `요청 자료`.
- The requested-material table shows `자료명` and `필수 항목`. Do not show document category here.
- `필수 항목` means required OCR/Qwen anchor fields from `document_type_required_fields` where `is_required=true`; these are the fields that must be recognized well enough for customer upload approval.
- Because inline editing would make the service screen too dense, required-item editing is opened only from the requested-material row context menu. Right-click a row to open the `필수 항목 수정` card popup.
- Saving the `필수 항목 수정` popup persists through `PUT /api/document-types/{document_code}/required-fields`.
- Requested materials sort selected rows first, then by Korean/English name.

### Accountant Review

Route:

```txt
http://127.0.0.1:4173/?page=review
```

Current review behavior:

- Uses the accountant shell and changes only the main work canvas.
- The workflow is company-centered so accountants can finish one company before moving to the next.
- Top cards: `고객사 선택` and `서비스 선택`.
- `고객사 선택` uses four columns: `고객사`, `제출요청일`, `제출마감일`, and submitted-count pill.
- `제출요청일` is loaded from `customer_submission_requests.created_at` via `/api/review-items` as `requestedAt`.
- `제출마감일` is loaded from `customer_submission_requests.due_date` via `/api/review-items` as `deadline`.
- When multiple service packages are visible for one customer, the customer selector summary uses the earliest requested date and earliest due date among that customer's visible rows.
- `고객사 선택` row pills show `submitted / total`, not remaining count. Do not show the word `남음`.
- `고객사 선택` pill colors: `0 submitted` = red, `some submitted` = yellow, `all submitted` = green.
- In the accountant review page, `서비스 선택` means the concrete service/request package provided to the selected customer. Do not label this card as a reusable preset-management concept.
- Left lower card: selected customer/service document list. It is a navigation list for required materials, not an AI scoring surface.
- Center lower card: selected document viewer.
- Right card: review assistance panel with document name, required fields, memo, and review actions.
- The right review-panel header shows only the selected document name. Do not show status pills, required-field summary pills, or a generic top-level `신뢰도 ##%` pill in the header.
- The required-field table header row is `항목 / 내용 / 신뢰도`; do not render an extra `필수 항목` title row above it.
- The required-field table displays machine-state `미확인` confidence as `확인 필요` for users, while keeping the underlying low-confidence logic unchanged.
- Review-panel values must come from original visual evidence plus OCR/text artifact plus Qwen3.6 when an image or rendered page is available. Do not present OCR-only conclusions as final AI judgments.
- Never run OCR, Qwen, file conversion, document routing, or confidence scoring from the accountant review page load. The review page must only read persisted results produced by the upload/background-processing pipeline.
- Customer upload or final-submission events create processing jobs. Those jobs produce and persist the display-rendered file, OCR/text artifact, Qwen JSON judgment, required-field values, confidence score, evidence, and suggested review memo.
- Overlay geometry is also upload-time state. Field bounding boxes, page numbers, highlight colors, and source-region coordinates must be computed and persisted before the accountant opens the review page.
- Qwen document judgment should return each visible required field with `sourceRegion` when the original image or rendered page is available. The stored format is `{ page, x, y, width, height }` in percentage coordinates relative to the displayed page/image.
- The API normalizes `sourceRegion`, `region`, or `bbox` outputs into `document_classification_results.raw_output.fields[].sourceRegion`; invalid or uncertain coordinates are omitted instead of fabricated.
- The accountant review page may calculate only viewport presentation details such as current scroll position, hover connector paths, and whether a persisted overlay is currently visible. It must not infer new OCR boxes, field positions, document identity, or confidence.
- If persisted file preview, OCR/Qwen result, or overlay coordinates are missing, show an explicit empty/unavailable state. Do not synthesize fake document pages, fake overlays, or fallback analysis in the accountant UI.
- The review API must not expose `/api/submission-files/{id}` as a viewer URL when the stored file no longer exists. In that case the viewer shows a short human-readable unavailable state instead of rendering backend JSON/errors inside the document area.
- The accountant review UI consumes stored processing results and must remain deterministic between refreshes. Re-analysis from this screen is limited to an explicit debug/admin action and must never be the default user path.
- The visible `판정 요약` is computed from the required-field rows only: field label, extracted value, and confidence. It must not render Qwen free-form summary text directly, because free-form summaries can pull in unrelated OCR fragments or surrounding document text.
- The visible `판정 요약` should stay short, e.g. `계좌번호 항목이 확인되지 않았습니다. 나머지 필수 항목은 확인되었습니다.`
- The separate `근거` card is not shown in the current right panel. Persisted evidence remains available for backend/audit trail, while the UI prioritizes the original viewer and required-field table.
- Review actions currently expose only `재요청`. The previous `검수완료` accountant-side button is removed until there is a defined downstream scenario for that action.
- The left `자료 목록` card is a navigation list for required documents. Its header does not show a `finished / total 완료` pill, and the table shows only `자료` and `상태`.
- The left document-list table headers `자료` and `상태` use the same clickable sort treatment as the right required-field table headers.
- Confidence stays in the right required-field table only. Do not show a list-level `신뢰도` column in the left `자료 목록`.
- The `/api/review-items` queue includes company-work context rows: `not_received`, `processing`, `approved`, `submitted`, and `rejected`.
- Rows already returned to the customer as `rejected`/`오류` must not appear as reviewable files in the accountant review page.
- `rejected` rows are normalized to `미제출` for the accountant review API. This preserves the requested document item in the company 자료 목록 while hiding the rejected upload artifact, field evidence, confidence, and file viewer.
- `not_received` rows are also shown as `미제출` in the 자료 목록 so accountants can see what the customer still has not submitted. They do not have a file viewer, field evidence, or enabled review actions.
- `src/accountantReview.js` starts with a loading state and then renders API results only. It must not use frontend fallback/demo review rows as a substitute for missing API data.
- If the API returns zero non-rejected items, the review screen shows `검토할 제출자료가 없습니다.` and must not resurrect sample rows.
- When an accountant clicks `재요청`, the row is marked `rejected` in the API and immediately removed from the visible review queue.
- Direct-render files: `PDF`, `JPG/JPEG`, `PNG`, `WEBP`.
- Display-image conversion files: `TIFF/TIF`, `HEIC/HEIF`.
- Display-PDF conversion files: `XLS/XLSX/XLSM`, `DOC/DOCX`, `PPT/PPTX`, `HWP/HWPX`, `CSV/TSV`.
- `ZIP` files are expanded first; internal files follow the same render rules.
- AI/OCR values are only supporting information. The visual file evidence shown in the viewer is the accountant's review source of truth.
- When persisted OCR/Qwen source coordinates exist, the viewer renders rectangular overlays on the original or display-rendered document. Field overlays are visual review aids only and should be treated as pointers to inspect manually.
- Overlay labels stay hidden by default to avoid covering the source document. Hovering or focusing a required-field row emphasizes the matching rectangle in the viewer.
- Base rectangles use a visible thicker outline. Hovering or focusing a required-field row draws an animated flowing dashed connector between the row and the source region; clicking keeps that field active.
- Field hover/focus/click also smoothly scrolls the document viewer so the matching overlay rectangle moves toward the center of the visible work area.
- If the accountant manually scrolls the document viewer or the review panel while a field is active, the animated connector must be recalculated so it continues to point to the current on-screen field and source-region positions.
- If either connector endpoint is outside its visible scroll container, hide the connector instead of drawing it toward an off-screen point.
- Customer-written `요청사항` is request-level context, not document-level context. Do not show it inside an individual document review panel.
- The review page top area shows three cards: `고객사 선택`, `서비스 선택`, and `고객 요청사항`. After customer/service selection, `고객 요청사항` displays the submitted request message for that customer/service pair, or `고객이 제출한 요청사항이 없습니다.` when empty.
- After both customer and service are selected, the lower document-list card shows only the documents for that customer/service pair.
- The right review panel has two separate note areas under the required-field table: `메모` and `고객에게 보낼 코멘트`.
- `메모` is not customer-facing and uses the placeholder `내부 검토 기록을 입력하세요.`. `고객에게 보낼 코멘트` is the source text that can be shown in the customer portal row as `요청사항`, and uses the placeholder `재요청시 고객 자료제출포털에 표시할 코멘트를 입력하세요.`
- Review items are loaded from `/api/review-items` when the API is available. The static review data remains only as a frontend fallback for API failure.
- Changing `메모`, changing `고객에게 보낼 코멘트`, or pressing `재요청` sends an update to `/api/review-items/{id}`.
- The viewer is a single scrollable work area, not a previous/next pager. It must support vertical scrolling for multi-page documents and horizontal scrolling for wide spreadsheets.
- Page sizing should keep one normal document page visible in the work area at a time, with vertical scroll/snap moving to the next page.
- Wide spreadsheet conversions keep a wider page canvas and rely on horizontal scrolling instead of squeezing columns into the visible viewport.
- The prototype renders sample direct/converted pages in the browser; production should feed this viewer from the original-file renderer or file-conversion service output according to file extension.
- `scripts/make_degraded_bankbook_sample.mjs` generates `public/samples/bankbook-sample-low-confidence.png` by degrading only the account-number area of the bankbook sample. Keep it as a local test fixture for the missing/low-confidence path, not as production image processing.

Important next step:

- Search common requested documents for each work package before populating `request_template_documents`.
- Do not infer template-document mappings from document categories alone.
- Keep the MVP mapping table simple: template, document type, default flag, required-default flag, note, and sort order.

## Browser Notes

Playwright controls its own browser instances. It does not control the VS Code Integrated Browser or Simple Browser tab.

Use Playwright for:

- smoke tests
- responsive checks
- screenshots
- headed debugging with `npm run test:headed`

Use the VS Code Integrated Browser or Simple Browser for:

- manual visual review
- HMR preview while editing

## Tooling Notes

Node and npm are installed through Homebrew and have been used from:

```txt
/opt/homebrew/bin/node
/opt/homebrew/bin/npm
/opt/homebrew/bin/npx
```

Known versions at setup time:

- Node: `v26.0.0`
- npm: `11.12.1`
- Playwright: `1.60.0`

Some Node deprecation warnings may appear during Vite or Playwright runs. They are not currently blocking as long as build and tests pass.

## Fonts

AuditMind self-hosts Pretendard Variable from:

```txt
public/fonts/PretendardVariable.woff2
```

The app loads it through `@font-face` in `src/styles.css`:

```css
src: url("/fonts/PretendardVariable.woff2") format("woff2-variations");
```

Do not depend on external font CDNs for the product UI. This keeps the app portable when it is moved to a private home server, local network, or enterprise environment.

## OCR Pipeline

AuditMind's current OCR/document recognition path uses the official PaddleOCR-VL pipeline with the PaddleOCR-VL VLM backend exposed on the local/Tailscale network.

The implemented primary backend adapter is:

```txt
backend/ocr/paddleocr_vl_pipeline.py
```

It executes the official PaddleOCR-VL document parsing pipeline:

```txt
PaddleOCRVL -> PP-LCNet_x1_0_doc_ori -> UVDoc -> PP-DocLayoutV3 -> PaddleOCR-VL-1.5-0.9B through vllm-server -> JSON/Markdown
```

Local PaddleOCR environment:

```txt
Python: /Users/peseux7001/.local/bin/python3.12
Virtualenv: .venv-paddleocr
Install: .venv-paddleocr/bin/python -m pip install "paddleocr[doc-parser]" paddlepaddle
Cache: PADDLE_PDX_CACHE_HOME="$PWD/.paddlex-cache"
```

Default PaddleOCR-VL settings:

```txt
PaddleOCR-VL VLM backend: http://100.126.53.70:8118/v1
PaddleOCR-VL model: PaddleOCR-VL-1.5-0.9B
```

Run samples with:

```sh
PADDLE_PDX_CACHE_HOME="$PWD/.paddlex-cache" \
  .venv-paddleocr/bin/python backend/ocr/paddleocr_vl_pipeline.py ./sample.png \
  --output-dir ./ocr-output/sample \
  --vl-server-url http://100.126.53.70:8118/v1 \
  --vl-model-name PaddleOCR-VL-1.5-0.9B
```

The wrapper writes:

- PaddleOCR official JSON output
- PaddleOCR official Markdown output
- `auditmind_ocr_manifest.json`

Current PaddleOCR-VL official-pipeline quality note:

- Approved test sample: `tmp/ocr-samples/1f9cf99418d811ebb30606f6a435f0e7.png`.
- Output artifacts: `tmp/ocr-output/bankbook-paddle-pipeline/`.
- The pipeline detected useful core bankbook anchors such as holder, account number, product name, branch/date/phone clues.
- Long Korean notice/table text and some labels were still badly misrecognized, so this result is not enough for automatic approval by itself.
- Treat PaddleOCR-VL output as candidate extraction. Qwen, required-field coverage, OCR/readability score, and human review remain required for ambiguous Korean documents.

Customer-facing reminder messages call Qwen through:

```txt
/api/qwen/chat/completions -> http://100.120.165.93:8090/v1/chat/completions
```

This Vite proxy avoids browser CORS problems during local review. Use the Tailscale endpoint above unless the service is intentionally re-bound. The request uses reasoning mode off with `enable_thinking: false` and `chat_template_kwargs.enable_thinking: false`. Validate the finished message before streaming it to the UI, and regenerate if unintended Japanese or Chinese characters appear. Avoid subject phrases like `회계사가` and meta phrases like `이 페이지를 보는 담당자`. Include one extra sentence that encourages the person preparing the materials, and render the 자료 제출률 and 접수 마감일 phrases in bold with underline. Do not add underline to the request summary card labels or values. If Qwen is unreachable, the UI falls back to the checked local sample message instead of showing an error.

Critical Qwen judgment rule:

- Do not use OCR text alone for final required-field judgment.
- For visual/layout-heavy Korean documents, send Qwen both the original page image or layout-preserving rendered image and the OCR/text artifact.
- OCR-only judgment may say "fields missing" when the OCR extraction failed, even though the original image visibly contains the fields.
- Example: the tax invoice sample `tmp/ocr-samples/a0e240d1567dd.png` produced sparse PaddleOCR-VL Markdown containing mostly the document title. Qwen judged the OCR-only package as missing required fields. When given the original image plus OCR artifact, Qwen3.6 extracted the required fields and returned a high-confidence candidate judgment.
- Therefore, OCR-only failures should lower OCR extraction confidence or trigger multimodal/human review. They must not become automatic document rejection.

The intended product flow is:

```txt
uploaded file
-> normalize / convert to OCR-ready page images when needed
-> official PaddleOCR-VL pipeline
-> JSON/Markdown OCR/layout artifacts
-> original page image or layout-preserving rendered page image
-> Qwen3.6 reasoning
-> customer checklist matching and evidence trace
```

## File Processing

All customer-accepted file extensions must cross the same safe processing boundary before OCR/Qwen judgment.

The current backend file processor supports every frontend-accepted extension as follows:

- `PDF`: probes for a usable text layer; sparse or scanned PDFs are rasterized and queued for PaddleOCR-VL.
- `JPG/JPEG/PNG/HEIC/HEIF/WEBP/TIFF/TIF`: accepted, normalized to OCR-ready images when needed, and queued for PaddleOCR-VL.
- `CSV/TSV`: extracted with Python's CSV reader and sampled headers/rows.
- `XLSX/XLSM`: extracted through OOXML ZIP/XML without executing macros. XLSM macro projects are detected and ignored.
- `DOCX`: extracted through OOXML ZIP/XML.
- `HWPX`: extracted through ZIP/XML body parts.
- `ZIP`: safely expanded, preserving container filename and internal paths; encrypted archives, path traversal, excessive member counts, and excessive expanded size are rejected.
- `XLS/DOC/HWP`: accepted as legacy binary formats and routed to external conversion. The current processor may keep a binary string probe but does not trust it as complete extraction.
- Executable files and unsupported extensions are rejected.

7Z is intentionally not a supported customer archive format. ZIP is enough for customer upload packaging and has a simpler safe-expansion path.

Legacy conversion recommendations:

- `XLS`: use `python-calamine` first for direct workbook reading, with LibreOffice headless conversion to `xlsx` or `csv` as fallback.
- `DOC`: use LibreOffice headless conversion to `docx` or `pdf` first, with `antiword` only as a plain-text fallback.
- `HWP`: use `pyhwp`/`hwp5txt` first for HWP v5 text extraction, with LibreOffice headless only as a fallback where its HWP import support is available.

Current macOS local converter setup:

```txt
python-calamine: 0.4.0 in .venv_fileproc
pyhwp/hwp5txt: 0.1b15 in .venv_fileproc
six: 1.17.0 in .venv_fileproc
antiword: 0.37 via Homebrew
LibreOffice/soffice: 26.2.3.2 via Homebrew cask
```

Local setup commands used:

```sh
python3 -m venv .venv_fileproc
.venv_fileproc/bin/python -m pip install --upgrade pip
.venv_fileproc/bin/python -m pip install -r backend/document_processing/requirements.txt
brew install antiword
brew install --cask libreoffice
```

Fedora Linux setup should use the same architecture:

```sh
sudo dnf install libreoffice-headless libreoffice-writer libreoffice-calc antiword python3 python3-pip
python3 -m venv .venv_fileproc
.venv_fileproc/bin/python -m pip install --upgrade pip
.venv_fileproc/bin/python -m pip install -r backend/document_processing/requirements.txt
```

On Fedora, `soffice` may be provided by the LibreOffice packages. The application service should run with `.venv_fileproc/bin` on `PATH` so `hwp5txt` is available.

Important distinction: "supported" means the file type is safely recognized and routed. It does not mean every format has equal native extraction depth. Legacy binaries require external converter integration before their content can be treated as fully extracted.

## Database

AuditMind's default development database is PostgreSQL through Docker Compose.

Current database scope:

- Document categories
- Exact Korean document type master
- Document aliases
- Required field definitions per document type
- Customer submission requests
- Customer submission checklist items
- Uploaded files
- Qwen/PaddleOCR-VL classification results and evidence trace
- Stable customer submission access tokens with database-only token hashes

Required local tooling:

- Docker CLI installed through Homebrew.
- Docker Compose v2 installed through Homebrew.
- Colima installed through Homebrew and used as the current local Docker runtime.

Installed local Docker tooling as of 2026-05-18:

```txt
docker: 29.5.0
docker compose: 5.1.3
colima: 0.10.1
runtime: Colima Docker context
```

Install commands that were used:

```sh
brew install docker docker-compose colima
mkdir -p "$HOME/.docker/cli-plugins" "$HOME/.colima"
ln -sf /opt/homebrew/lib/docker/cli-plugins/docker-compose "$HOME/.docker/cli-plugins/docker-compose"
colima start --cpu 4 --memory 6 --disk 60
```

If Docker commands fail after a reboot, start the runtime again:

```sh
colima start
docker context use colima
```

The default local database connection is:

```txt
host: localhost
port: 5432
database: auditmind
user: auditmind
password: auditmind_dev_password
```

Start the local database and apply schema/seeds:

```sh
npm run db:up
npm run db:apply
```

Open a database shell:

```sh
npm run db:shell
```

The first migration and seeds are applied in this order:

```sh
psql auditmind -f database/migrations/001_document_type_master.sql
psql auditmind -f database/migrations/002_request_template_master.sql
psql auditmind -f database/migrations/003_customer_master.sql
psql auditmind -f database/migrations/004_submission_review_notes.sql
psql auditmind -f database/migrations/005_customer_portal_runtime.sql
psql auditmind -f database/migrations/006_document_type_dedupe.sql
psql auditmind -f database/migrations/007_app_runtime_state.sql
psql auditmind -f database/seeds/001_document_type_seed.sql
psql auditmind -f database/seeds/002_document_required_fields_seed.sql
psql auditmind -f database/seeds/003_request_template_seed.sql
psql auditmind -f database/seeds/004_request_template_document_seed.sql
psql auditmind -f database/seeds/005_customer_seed.sql
psql auditmind -f database/seeds/006_accountant_review_seed.sql
psql auditmind -f database/seeds/007_customer_portal_demo_seed.sql
psql auditmind -f database/seeds/008_app_runtime_seed.sql
```

Use `pg_trgm` for fuzzy document name and alias matching. Keep `pgvector` optional until the home server or deployment database has the extension installed.

Document type master names must be exact requestable names. Do not add vague master rows ending in `등`.

If two document rows have the same Korean `name`, they are the same document. Do not solve this with UI merging or template-level dedupe. Canonicalize the duplicate in the database, update mappings to the canonical `document_types` row, and keep `document_types(name)` unique.

Required fields are deliberately minimum sufficient, not exhaustive. They exist so PaddleOCR-VL and Qwen can decide whether an uploaded file is the requested document, whether expected values are present, and how reliable the match is. Use common anchors, category anchors, and selective type-specific anchors. Do not turn the required-field table into a full accounting/tax extraction schema unless that scope is explicitly requested.

Runtime database scope now also covers accountant shell settings, accountant notifications, dashboard data computed from persisted submission/review rows, persisted `AI 고객사 분석`, and uploaded-file viewer artifact metadata. User permissions/auth and the 자료제출요청 creation/sending workflow are explicitly excluded from this DB-ification pass.

Current verified local database counts after `npm run db:apply`:

```txt
document_categories: 13
document_types: 217
document_type_required_fields: 1723
```

## Rules For Future Changes

- Keep Vite + Tailwind as the default frontend development environment.
- Keep the dev URL stable at `http://127.0.0.1:4173/` unless this file is updated.
- Prefer Tailwind utility classes for page and component styling.
- Keep custom CSS in `src/styles.css` limited to base rules, tokens, or repeated patterns that Tailwind should not express inline.
- Keep product fonts self-hosted under `public/fonts`.
- Keep Playwright tests updated when visible product surfaces or accessibility names change.
- Keep the OCR product path on the documented PaddleOCR-VL official pipeline unless this document is explicitly updated with a better validated path.
- Update this document whenever scripts, ports, tooling, browser workflow, or verification steps change.

## Context Recovery Checklist

After context compaction or a new session, read this file first, then check:

```sh
sed -n '1,260p' ProductSpec.md
sed -n '1,220p' Design.md
sed -n '1,220p' package.json
sed -n '1,220p' vite.config.mjs
sed -n '1,220p' playwright.config.js
sed -n '1,260p' src/customerPortalContent.js
sed -n '1,280p' src/main.js
```

Assume the default workflow is still Vite + Tailwind + Playwright unless this document says otherwise. Assume the current product focus is the customer layer unless `ProductSpec.md` says the focus has changed.
