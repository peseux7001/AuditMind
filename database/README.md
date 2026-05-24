# AuditMind Database

AuditMind uses PostgreSQL as the default database.

The first database scope is the document type master: exact Korean document names that accounting firms can request from customers, plus the minimum required fields that OCR/Qwen need for document fitness and confidence scoring.

The second database scope is the request template master: accounting-firm work packages such as `부가가치세 신고`, `법인세 신고`, `재무실사`, or `투자유치 재무자료 준비`. A request template is a preset that preselects multiple `document_types`; it is not a document category.

The third database scope is the customer master: customer company records and customer contacts used by the accountant-facing customer management page.

The fourth database scope is submission review state: persisted background-processing results plus accountant review notes. The accountant review screen reads stored OCR/Qwen artifacts and stores human review notes; it must not run OCR or Qwen on page load.

The fifth database scope is customer portal runtime state: stable token access, customer request messages, final-submission state, uploaded-file metadata, and background classification artifacts for the customer-facing submission portal.

The sixth database scope is app runtime state: accountant shell brand settings, accountant notification rows, persisted customer AI analyses, and stored viewer artifacts. User permissions/auth and submission-request sending workflow are intentionally excluded from this scope.

## Recommended Extensions

- `pgcrypto`: UUID generation through `gen_random_uuid()`
- `pg_trgm`: Korean document name and alias fuzzy matching
- `pgvector`: optional later extension for semantic document matching

The current migration enables `pgcrypto` and `pg_trgm`. Do not require `pgvector` until the runtime environment is ready for it.

## Files

- `../docker-compose.yml`: local PostgreSQL service for development.
- `../.env.example`: local database environment template.
- `migrations/001_document_type_master.sql`: base schema for document categories, document types, aliases, required fields, examples, customer requests, uploaded files, and classification results.
- `migrations/002_request_template_master.sql`: request template schema and template-document mapping table.
- `migrations/003_customer_master.sql`: customer company and customer contact master tables.
- `migrations/004_submission_review_notes.sql`: accountant-only internal memo and customer-facing comment fields for submitted request items.
- `migrations/005_customer_portal_runtime.sql`: customer portal request-message fields and runtime status constraints.
- `migrations/006_document_type_dedupe.sql`: canonicalizes same-name document types, rewires old duplicate codes, and enforces one document row per Korean document name.
- `migrations/007_app_runtime_state.sql`: app runtime settings, accountant notifications, persisted customer AI analyses, and viewer artifact metadata.
- `seeds/001_document_type_seed.sql`: first Korean document type master seed.
- `seeds/002_document_required_fields_seed.sql`: minimum sufficient required-field anchors for PaddleOCR/Qwen document judgment.
- `seeds/003_request_template_seed.sql`: Korean accounting-firm work-package template master seed.
- `seeds/004_request_template_document_seed.sql`: default template-document mappings for request creation presets.
- `seeds/005_customer_seed.sql`: first customer/contact sample seed for the accountant customer management screen.
- `seeds/006_accountant_review_seed.sql`: first persisted review work-item seed for the accountant submission-review screen.
- `seeds/007_customer_portal_demo_seed.sql`: demo customer portal request, stable demo token, requested checklist rows, and sample uploaded-file rows.
- `seeds/008_app_runtime_seed.sql`: shell brand settings, AI endpoint records, dashboard due-alert setting, and notification seed rows.
- `apply_local.sh`: applies the migration and seed files to the local Docker database in order.

## Start Local Database

Local Docker runtime setup used on this machine:

```sh
brew install docker docker-compose colima
mkdir -p "$HOME/.docker/cli-plugins" "$HOME/.colima"
ln -sf /opt/homebrew/lib/docker/cli-plugins/docker-compose "$HOME/.docker/cli-plugins/docker-compose"
colima start --cpu 4 --memory 6 --disk 60
```

If the Docker socket is unavailable after a reboot:

```sh
colima start
docker context use colima
```

Copy the example environment file if local overrides are needed:

```sh
cp .env.example .env
```

Start PostgreSQL:

```sh
npm run db:up
```

Apply schema and seeds:

```sh
npm run db:apply
```

Open a psql shell:

```sh
npm run db:shell
```

The local Docker service exposes PostgreSQL at:

```txt
localhost:5432
database: auditmind
user: auditmind
password: auditmind_dev_password
```

## Manual Apply

```sh
createdb auditmind
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

Check counts:

```sql
SELECT COUNT(*) FROM document_categories;
SELECT COUNT(*) FROM document_types;
SELECT COUNT(*) FROM document_type_required_fields;
SELECT COUNT(*) FROM request_templates;
SELECT COUNT(*) FROM request_template_documents;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM customer_contacts;
SELECT COUNT(*) FROM customer_submission_items;
SELECT COUNT(*) FROM uploaded_files;
SELECT COUNT(*) FROM document_classification_results;
```

Current verified counts after local apply:

```txt
document_categories: 13
document_types: 217
document_type_required_fields: 1723
request_templates: 111
request_template_documents: 1982
customers: 4
customer_contacts: 6
customer_submission_items: 10
uploaded_files: 6
document_classification_results: 4
```

## Design Notes

Customer submission links:

- A customer link token is stable for one recipient and one request package. It should not change on every visit.
- The outbound KakaoTalk/email URL contains the raw token.
- The database stores only `customer_submission_access_tokens.token_hash`.
- Reissue means creating a new token row and setting `revoked_at` on the old row.
- Expiry and revocation are checked server-side before showing the submission portal.
- `last_accessed_at` and `access_count` are operational audit fields, not a login session.

Document type names should be exact requestable names. Do not create master rows with vague suffixes such as `기타 자료` or names ending in `등`.

Use `document_type_aliases` for common customer wording, OCR wording, abbreviations, or English labels.

Use `document_type_required_fields` for the smallest useful set of extraction requirements. The goal is not to fully digitize every accounting form. The goal is to let PaddleOCR and Qwen answer three questions:

- Is this file likely the requested document?
- Are the minimum expected values present?
- How confident is the document match and value extraction?

Field strictness is intentionally only two levels:

- `is_required=true`: identity fields. These are the minimum anchors that can block customer acceptance when missing or unreadable.
- `is_required=false`: reference fields. These help accountants review the result and explain confidence, but they must not reject an otherwise useful customer upload by themselves.

Current seed structure:

- Common anchors: document title is an identity field; target company, period/date, and source are reference fields by default.
- Category anchors: broad document families such as revenue, expense, finance, payroll, tax, contract, and inventory add only the most useful identity/reference fields.
- Type-specific anchors: high-value or highly structured documents such as business registration certificates, financial statements, tax invoices, VAT returns, bank statements, payroll registers, withholding tax returns, sales contracts, investment agreements, and loan agreements may add stricter identity fields.

Exact spelling, whitespace, and minor wording differences are not the database contract. The extracted value only needs to be usable for the requested document.

Do not overfit this table into a complete tax or audit extraction model. Add fields only when they materially improve document identification, required-value completeness, or confidence scoring.

Use `document_classification_results.evidence` for Qwen/PaddleOCR evidence trace. It should hold source page, sheet, cell, text span, confidence, and reason candidates.

Request template rules:

- A request template is the work package that an accountant selects, such as `부가가치세 신고`.
- A request template should preselect document types as defaults only. It is not a final authority.
- The accountant must be able to add or remove requested documents before sending the customer request.
- Do not expose document categories as request templates in the accountant-facing UI.
- Use `request_template_documents` to map templates to default requested documents after each template's document set has been reviewed.
- `seeds/004_request_template_document_seed.sql` currently maps every seeded request template to at least one default requested document. These mappings are practical starting presets, not final professional judgments.

Customer master rules:

- `customers` stores only customer-company master information needed by the current customer management screen.
- `customer_contacts` stores one or more contacts for each customer.
- `customer_contacts.name`, `phone`, and `email` are required. `title` is optional.
- `customers.created_by_user_id`, `customers.updated_by_user_id`, `customer_contacts.created_by_user_id`, and `customer_contacts.updated_by_user_id` are text user identifiers for now. They intentionally do not reference a login user table yet.
- Use `system` for seed/system-created rows until the authentication model is introduced.
- Generated `AI 고객사 분석` is persisted in `customer_ai_analyses`. The customer management screen reads stored analysis first and regenerates/saves only when no stored analysis exists or customer data changes.
- `customer_submission_requests.customer_id` links every 자료제출 요청 to `customers.id`. `customer_name` is kept only as a display/legacy fallback.
- 자료제출 요청, 제출자료 검토, 대시보드, 고객 포털 token lookup must join through live `customers` rows. If a customer is deleted, linked submission requests cascade away and should not keep appearing as orphan review work.

Submission review rules:

- Customer upload/final-submission processing is the normal source of OCR, conversion, Qwen judgment, required-field scoring, confidence, and rejection/retry reasons.
- `customer_submission_items.internal_memo` is visible only inside the accountant-facing review workflow.
- `customer_submission_items.customer_comment` is the customer-facing comment that can be surfaced in the customer portal as `요청사항`.
- `customer_submission_requests.customer_request_message` is the customer-written request/comment. Accountant review items should expose it as read-only `요청사항` context above internal memo fields.
- `uploaded_files.metadata` stores viewer-facing display metadata such as render mode, sample file URL, page count, evidence page, and page title.
- `document_classification_results.raw_output.fields` stores required-field candidates and optional source regions used by the visual overlay.
- The accountant review page must consume these stored rows through `/api/review-items`; it must not trigger OCR, Qwen, conversion, or classification on page load.
- `/api/review-items` should return `not_received`, `processing`, `approved`, `submitted`, and `rejected` request-item rows.
- `rejected` rows are customer-side retry cases, so the rejected upload artifact must stay out of the accountant review queue as a file. The requested item itself still appears as `미제출` so the accountant can see that the company/template is missing that document.
- `not_received` and accountant-normalized `rejected` rows are displayed as `미제출` context only. They let the accountant see missing documents, but they do not provide file evidence, field evidence, confidence, or enabled review actions.

Customer portal runtime rules:

- `GET /api/submission-portal/:token` resolves the stable raw customer token, updates access audit fields, and returns request/checklist state for the customer portal.
- `POST /api/submission-portal/:token/upload` stores original files under `public/uploads/{request_id}/`, inserts `uploaded_files`, marks relevant pending rows as `processing`, and starts the current best-effort background OCR/Qwen classification attempt.
- `processing` is not a durable customer-facing result. When background judgment finishes, ambiguous outcomes such as `possible_match`, `undecided`, wrong-document detection, missing required fields, or low confidence must become `rejected` with a customer-readable retry reason rather than staying in `processing`.
- `PUT /api/submission-portal/:token/customer-request` stores the customer-written `요청사항` as draft or submitted text.
- `PUT /api/submission-portal/:token/items/:item_id/final-submit` marks an approved row as `submitted` and writes the customer-visible line `최종 접수가 완료되었습니다.`.
- `GET /api/submission-files/:file_id` streams the stored uploaded file back to the browser for customer and accountant review links.
- The current runtime upload worker is intentionally minimal. It proves the end-to-end path from real upload to stored file to persisted classification result, but production should move long-running conversion/OCR/classification into a durable queue.
