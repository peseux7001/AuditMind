# AuditMind Development Environment

This file is the source of truth for the local development setup. Update it whenever the project tooling, ports, preview workflow, or verification commands change.

## Default Stack

- Build tool and dev server: Vite
- Styling: Tailwind CSS
- UI implementation: static HTML with Tailwind utility classes
- Browser automation and regression checks: Playwright
- OCR/document parsing: official PaddleOCR-VL pipeline wrapper
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
```

Additional commands:

```sh
npm run preview
npm run test:headed
npm run pw:open
npm run pw:report
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
http://127.0.0.1:4173/?edit=1
```

This enables browser-only copy editing:

- Click visible copy to edit it directly.
- Press `Enter` or blur the field to save.
- Edits are stored in `localStorage` under `auditmind.customerPortal.copyOverrides.v3`.
- The reset button clears local edits and restores `src/customerPortalContent.js`.

This is for development only. Production builds do not enable the edit UI because it is guarded by Vite dev mode.

## File Structure

Current frontend entry points:

- `index.html`: main page markup and Tailwind utility implementation
- `public/fonts/PretendardVariable.woff2`: self-hosted Pretendard variable font
- `src/customerPortalContent.js`: editable customer portal copy and checklist data
- `src/documentRouting.js`: generic frontend mock of the future document routing engine contract
- `src/main.js`: Vite module entry and HMR accept hook
- `src/styles.css`: Tailwind CSS import and base styles
- `vite.config.mjs`: Vite and Tailwind plugin configuration
- `playwright.config.js`: Playwright test configuration and Vite web server setup
- `tests/auditmind.spec.js`: smoke and responsive checks
- `backend/ocr/paddleocr_vl_pipeline.py`: official PaddleOCR-VL document parsing wrapper
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

Current verified baseline:

- `npm run build`: passed
- `npm test`: `48 passed`

## Current Implemented Screen

The current implemented UI is the customer-facing document submission portal, not the accountant review console.

Current page behavior:

- The implementation uses component-only refinement from the Microsoft Teams UI Kit reference. It does not import decorative Figma assets or illustrations into this customer portal screen. Buttons, status bubbles, pills, filter segments, panels, overlays, list rows, and tooltip-like controls share reusable class contracts in `src/main.js`.
- Component adoption should preserve the current workflow and layout unless the user explicitly asks for a redesign. Prefer improving consistency, states, spacing, focus behavior, and scan quality through shared controls.
- The visual direction should avoid a generic AI-generated card-stack look. Prefer flatter Teams/Fluent-like work surfaces, restrained borders, compact rows, visible state, and neutral backgrounds over decorative dashed cards or oversized showcase sections.
- Customer sees a dedicated submission portal.
- Company badge currently uses sample data: `샘플테크 주식회사`.
- Header brand symbol is data-driven. It defaults to the `AM` text fallback, and can later use `brand.symbolImage` for an accountant firm or service provider logo.
- Request title currently uses sample data: `2025년 1기 부가가치세 신고 검토 자료 제출 요청`.
- Header meta/description are intentionally hidden for now.
- Upload section accepts multiple files and explains supported and unsupported file formats.
- Supported file details are shown through the compact `지원파일` tooltip.
- Checklist is vertical, status-driven, and sorted by customer attention priority: `분석 중`, `반려`, `미접수`, `검수완료`, then `접수완료`.
- Checklist filters are functional: `전체` shows every row, and `미접수` hides `검수완료` and `접수완료` rows.
- Item upload actions all use `파일 업로드`. The `분석 중` and `접수완료` rows keep `파일 업로드` visible but disabled.
- Each checklist item shows `최종 접수` next to the upload action. It is enabled only for `검수완료` rows and disabled for `분석 중`, `반려`, `미접수`, and `접수완료`.
- Clicking `최종 접수` changes that row to `접수완료`, updates its review line to `최종 접수가 완료되었습니다.`, and disables both row buttons.
- Checklist row body copy now uses the second line for AI review state instead of generic document descriptions. Approved rows show a review completion percentage, missing rows ask for upload, processing rows say analysis is running, and rejected rows show the rejection reason.
- Approved or finally submitted rows show the attached filename as a clickable download link on the third line.
- The current frontend uses `src/documentRouting.js` only as a generic mock of the future routing engine after upload analysis. It does not infer document type from frontend filenames, and it does not contain English keyword routing. Real document fitness decisions belong in the backend and Qwen routing engine.
- The request summary's left blank area, directly below the request title, includes the `안내 메시지` text. Manual accountant copy takes priority; if empty and AI generation is enabled, the frontend calls Qwen through the local Vite proxy and streams the validated final text into that existing space.
- Selecting files in the bulk upload input shows a full-screen dimmed upload progress overlay. The current frontend simulates progress for UI review.
- Upload and upload-complete overlay descriptions are split by sentence line.
- When simulated upload reaches 100%, the overlay title changes to `파일 분석 시작`, shows the upload-complete/body copy, and waits for `확인`.
- The overlay card keeps a stable height between upload-progress and analysis-start states.
- Clicking `확인` temporarily changes every checklist item to `분석 중`, then restores simulated classification results.
- Progress card includes both submission progress and deadline pressure.
- The right sidebar currently keeps only the `참고 사항` guidance card; submission-state and access-notice cards were removed to reduce screen noise.
- Sidebar copy may use `#####` as an accountant-firm placeholder. It currently renders with the default `sidebar.firmName` value, `AuditMind`.

Do not treat this screen as the accountant layer. The accountant layer is intentionally deferred in `ProductSpec.md`.

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

AuditMind's default OCR/document parsing path is the official PaddleOCR-VL pipeline, not direct chat-completions calls to the VLM model.

Default local OCR settings:

```txt
PaddleOCR-VL VLM server: http://192.168.0.10:8118/v1
PaddleOCR-VL model: PaddleOCR-VL-1.5-0.9B
Qwen3.6 server: http://192.168.0.10:8000/v1
Qwen3.6 model: Qwen3.6-35B-A3B-NVFP4
```

Customer-facing reminder messages call Qwen through:

```txt
/api/qwen/chat/completions -> http://gx10-f0e1:8000/v1/chat/completions
```

This Vite proxy avoids browser CORS problems during local review. Prefer the Tailscale hostname `gx10-f0e1`; the local LAN IP `192.168.0.10` may fail when the workstation is not on that LAN path. The request uses reasoning mode off with `enable_thinking: false` and `chat_template_kwargs.enable_thinking: false`. Validate the finished message before streaming it to the UI, and regenerate if unintended Japanese or Chinese characters appear. Avoid subject phrases like `회계사가` and meta phrases like `이 페이지를 보는 담당자`. Include one extra sentence that encourages the person preparing the materials, and render the 자료 제출률 and 접수 마감일 phrases in bold with underline. Do not add underline to the request summary card labels or values. If Qwen is unreachable, the UI falls back to the checked local sample message instead of showing an error.

Official OCR pipeline file:

```sh
python backend/ocr/paddleocr_vl_pipeline.py ./sample.pdf --output-dir ./ocr-output/sample
```

The intended product flow is:

```txt
uploaded file
-> official PaddleOCRVL pipeline
-> JSON/Markdown artifacts
-> Qwen3.6 reasoning
-> customer checklist matching and evidence trace
```

Direct PaddleOCR-VL `/v1/chat/completions` calls are allowed only for experiments or fallback debugging. The product path should use `PaddleOCRVL` so layout detection, crop generation, recognition, reading-order merge, and PDF page restructuring are included.

## Rules For Future Changes

- Keep Vite + Tailwind as the default frontend development environment.
- Keep the dev URL stable at `http://127.0.0.1:4173/` unless this file is updated.
- Prefer Tailwind utility classes for page and component styling.
- Keep custom CSS in `src/styles.css` limited to base rules, tokens, or repeated patterns that Tailwind should not express inline.
- Keep product fonts self-hosted under `public/fonts`.
- Keep Playwright tests updated when visible product surfaces or accessibility names change.
- Keep the OCR product path on the official PaddleOCR-VL pipeline unless this document is explicitly updated with a better validated path.
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
