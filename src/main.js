import "./styles.css";
import { customerPortalContent } from "./customerPortalContent.js";
import { routeUploadedFilesToChecklist } from "./documentRouting.js";

const app = document.querySelector("#app");
const storageKey = "auditmind.customerPortal.copyOverrides.v3";
const editMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get("edit") === "1";

const toneClasses = {
  success: "border border-[#c9e7ca] bg-[#f3fbf3] text-[#107c10]",
  submitted: "border border-[#c9e7ca] bg-[#f3fbf3] text-[#107c10]",
  warning: "border border-[#f2dd8d] bg-[#fff9df] text-[#8a6100]",
  danger: "border border-[#f1b8be] bg-[#fff4f5] text-[#a4262c]",
  neutral: "border border-[#d1d1d1] bg-[#f7f7f7] text-[#616161]",
};

const cx = (...classes) => classes.filter(Boolean).join(" ");

const componentClasses = {
  surface: "rounded-lg border border-[#d1d1d1] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  panel: "rounded-lg border border-[#d1d1d1] bg-[#fafafa]",
  buttonBase:
    "inline-flex items-center justify-center rounded-md border font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6264a7]",
  buttonSizes: {
    sm: "h-8 px-2 text-xs",
    md: "h-9 min-w-[104px] px-3 text-sm",
    lg: "h-10 px-4 text-sm",
    full: "h-9 w-full px-3 text-sm",
  },
  buttonVariants: {
    primary: "border-[#6264a7] bg-[#6264a7] text-white hover:bg-[#4f528f] active:bg-[#464775]",
    secondary: "border-[#d1d1d1] bg-white text-[#424242] hover:bg-[#fafafa] active:bg-[#f3f2f1]",
    disabled: "cursor-not-allowed border-[#d1d1d1] bg-[#f3f2f1] text-[#a0a0a0]",
    subtle: "border-[#d1d1d1] bg-white text-[#616161] hover:border-[#6264a7] hover:text-[#6264a7]",
  },
  statusBubble: "inline-flex min-h-6 w-[72px] items-center justify-center whitespace-nowrap rounded-full px-2 text-xs font-semibold",
  pill: "inline-flex min-h-6 items-center rounded-full px-2 text-xs font-semibold",
  filterGroup: "inline-flex w-fit rounded-lg bg-[#f3f2f1] p-[3px]",
  filterButton: "h-8 rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6264a7]",
  row: "grid gap-3 p-4 transition-colors hover:bg-[#fafafa] md:grid-cols-[124px_minmax(0,1fr)_auto] md:items-center",
  rowAttention:
    "grid gap-3 border-l-4 border-l-[#a4262c] bg-[#fffafa] p-4 transition-colors hover:bg-[#fff7f8] md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center",
};

const getButtonClass = ({ variant = "secondary", size = "md", disabled = false } = {}) =>
  cx(
    componentClasses.buttonBase,
    componentClasses.buttonSizes[size],
    componentClasses.buttonVariants[disabled ? "disabled" : variant],
  );

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const resolvePlaceholders = (value) => String(value).replaceAll("#####", content?.sidebar?.firmName || "AuditMind");

const getPath = (source, path) => path.split(".").reduce((current, key) => current?.[key], source);

const setPath = (source, path, value) => {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current[key], source);
  target[lastKey] = value;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const loadOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
};

const applyOverrides = (content, overrides) => {
  Object.entries(overrides).forEach(([path, value]) => {
    if (getPath(content, path) !== undefined) {
      setPath(content, path, value);
    }
  });
  return content;
};

let copyOverrides = loadOverrides();
let content = applyOverrides(clone(customerPortalContent), copyOverrides);
let uploadSimulationTimer;
let analysisSimulationTimer;
let customerMessageTimer;
let customerMessageStreamingTimer;
let customerMessageAbortController;
let pendingUploadFiles = [];
let activeChecklistFilter = content.checklist.filters[0] || "전체";
let classifiedChecklistItems = clone(content.checklist.items);

const normalizeWorkflowCopy = () => {
  content.checklist.filters = [...customerPortalContent.checklist.filters];
  content.checklist.items = content.checklist.items.map((item) => ({
    ...item,
    action: customerPortalContent.checklist.items[0].action,
  }));
};

normalizeWorkflowCopy();
classifiedChecklistItems = clone(content.checklist.items);

const getAcceptedFileExtensions = () =>
  content.bulkUpload.supportedFiles.map((fileType) => `.${String(fileType).toLowerCase()}`).join(",");

const editable = (path, fallback, className = "") => {
  const value = getPath(content, path) ?? fallback;
  const attrs = editMode
    ? ` contenteditable="true" spellcheck="false" data-copy-path="${escapeHtml(path)}"`
    : "";
  return `<span class="${className}"${attrs}>${escapeHtml(resolvePlaceholders(value))}</span>`;
};

const editableBlock = (tag, path, fallback, className = "", attrs = "") => {
  const value = getPath(content, path) ?? fallback;
  const editAttrs = editMode
    ? ` contenteditable="true" spellcheck="false" data-copy-path="${escapeHtml(path)}"`
    : "";
  return `<${tag} ${attrs} class="${className}"${editAttrs}>${escapeHtml(resolvePlaceholders(value))}</${tag}>`;
};

const renderTextLines = (lines) =>
  lines.map((line) => `<span class="block">${escapeHtml(resolvePlaceholders(line))}</span>`).join("");

const emphasisUnderlineClass = "underline decoration-[#6264a7] decoration-2 underline-offset-4";

const parseInlineMessageSegments = (value) => {
  const segments = [];
  const source = resolvePlaceholders(value);
  const pattern = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: source.slice(cursor, match.index), strong: false });
    }
    segments.push({ text: match[1], strong: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), strong: false });
  }

  return segments;
};

const renderInlineMessageSegments = (segments, visibleCharacters = Infinity) => {
  let remaining = visibleCharacters;

  return segments
    .map((segment) => {
      if (remaining <= 0) return "";
      const text = segment.text.slice(0, remaining);
      remaining -= text.length;
      const safeText = escapeHtml(text);
      return segment.strong ? `<strong class="${emphasisUnderlineClass}">${safeText}</strong>` : safeText;
    })
    .join("");
};

const renderInlineMessage = (value) => renderInlineMessageSegments(parseInlineMessageSegments(value));

const getInlineMessageLength = (value) =>
  parseInlineMessageSegments(value).reduce((total, segment) => total + segment.text.length, 0);

const renderUploadIcon = () => `
  <svg class="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8 12 3 7 8" />
    <path d="M12 3v12" />
  </svg>
`;

const renderPlusIcon = () => `
  <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
`;

const renderBrandSymbol = () => {
  const symbolImage = content.brand.symbolImage?.trim();
  const symbolAlt = content.brand.symbolAlt || content.brand.eyebrow || "AuditMind";

  if (symbolImage) {
    return `
      <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-[#e6e6e6]" aria-label="${escapeHtml(symbolAlt)}">
        <img class="h-full w-full object-contain" src="${escapeHtml(symbolImage)}" alt="${escapeHtml(symbolAlt)}" />
      </div>
    `;
  }

  return `
    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6264a7] font-bold text-white" aria-label="${escapeHtml(symbolAlt)}">
      ${editable("brand.symbolText", content.brand.symbolText)}
    </div>
  `;
};

const hasJapaneseOrChineseCharacters = (value) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(value);

const hasBlockedCustomerMessagePhrase = (value) => /회계사가|이 페이지를 보는/u.test(value);

const getMissingChecklistTitles = () =>
  content.checklist.items
    .filter((item) => ["neutral", "danger", "processing"].includes(item.statusTone))
    .map((item) => item.title);

const getGeneratedCustomerMessage = () => {
  const fallback = content.customerMessage.generatedMessage;
  if (!hasJapaneseOrChineseCharacters(fallback) && !hasBlockedCustomerMessagePhrase(fallback)) return fallback;

  const missingTitles = getMissingChecklistTitles();
  const missingText = missingTitles.length ? `${missingTitles.slice(0, 3).join(", ")} 자료` : "남은 자료";

  return `${content.brand.badges[0]} 담당자님, 현재 **${content.request.progressLabel}은 ${content.request.progressValue}**이고 **${content.request.deadlineLabel}은 ${content.request.deadlineValue}**입니다. ${missingText}만 조금 더 확인해 주시면 검토가 한결 수월해집니다. 바쁜 일정 속에서도 여기까지 준비해 주신 것만으로도 충분히 잘 진행되고 있습니다. 바쁘시겠지만 편하실 때 이어서 제출해 주세요.`;
};

const stripInlineMarkdown = (value) => String(value).replace(/\*\*(.+?)\*\*/g, "$1");

const emphasizeCustomerMessageMetrics = (value) => {
  const progressPhrase = `${content.request.progressLabel}은 ${content.request.progressValue}`;
  const deadlinePhrase = `${content.request.deadlineLabel}은 ${content.request.deadlineValue}`;
  let message = stripInlineMarkdown(value);

  if (!message.includes(progressPhrase) || !message.includes(deadlinePhrase)) {
    return getGeneratedCustomerMessage();
  }

  message = message
    .replaceAll(progressPhrase, `**${progressPhrase}**`)
    .replaceAll(deadlinePhrase, `**${deadlinePhrase}**`);

  return message;
};

const normalizeCustomerMessage = (value) =>
  emphasizeCustomerMessageMetrics(
    String(value)
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );

const isValidCustomerMessage = (value) =>
  Boolean(value) && !hasJapaneseOrChineseCharacters(value) && !hasBlockedCustomerMessagePhrase(value);

const buildQwenCustomerMessagePrompt = (retryCount) => {
  const missingTitles = getMissingChecklistTitles();
  const missingText = missingTitles.length ? missingTitles.join(", ") : "없음";
  const companyName = content.brand.badges[0] || "고객";
  const retryInstruction = retryCount
    ? "\n이전 문장에는 금지된 문자나 형식 문제가 있었습니다. 일본어, 중국어, 한자, 주어 '회계사가', 표현 '이 페이지를 보는'을 절대 쓰지 마세요."
    : "";

  return [
    "AuditMind 자료 제출 포털에 표시할 고객 안내문을 한국어로 작성하세요.",
    "문장은 3~4문장으로 짧고 부드럽게 작성하세요.",
    "고객에게 부담을 주지 말고 남은 자료 제출을 자연스럽게 응원하세요.",
    "자료를 준비하는 담당자에게 개인적으로 힘이 되는 응원 문장을 한 문장 넣으세요.",
    "단, '이 페이지를 보는 담당자', '이 페이지를 보는 분', '이 화면을 보는' 같은 메타 표현은 쓰지 마세요.",
    "주어로 '회계사가'를 쓰지 마세요.",
    "일본어, 중국어, 한자를 섞지 마세요.",
    "마크다운은 아래 두 표현에만 사용하세요.",
    `반드시 포함: **${content.request.progressLabel}은 ${content.request.progressValue}**`,
    `반드시 포함: **${content.request.deadlineLabel}은 ${content.request.deadlineValue}**`,
    `고객명: ${companyName}`,
    `${content.request.progressLabel}: ${content.request.progressValue}`,
    `접수 현황: ${content.request.progressDetail}`,
    `${content.request.deadlineLabel}: ${content.request.deadlineValue}`,
    `마감 안내: ${content.request.deadlineDetail}`,
    `미접수 또는 재확인 자료: ${missingText}`,
    retryInstruction,
  ].join("\n");
};

const extractQwenMessage = (payload) =>
  payload?.choices?.[0]?.message?.content ||
  payload?.choices?.[0]?.delta?.content ||
  payload?.choices?.[0]?.text ||
  "";

const requestQwenCustomerMessage = async (retryCount, signal) => {
  const response = await fetch(content.customerMessage.qwenEndpoint || "/api/qwen/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: content.customerMessage.qwenModel,
      stream: false,
      temperature: 0.75,
      max_tokens: 260,
      enable_thinking: false,
      chat_template_kwargs: {
        enable_thinking: false,
      },
      messages: [
        {
          role: "system",
          content:
            "당신은 한국어 고객 안내문을 쓰는 보조자입니다. 짧고 친절하게 쓰고, 최종 검증된 문장만 반환합니다.",
        },
        {
          role: "user",
          content: buildQwenCustomerMessagePrompt(retryCount),
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Qwen request failed: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeCustomerMessage(extractQwenMessage(payload));
};

const getQwenCustomerMessage = async (signal) => {
  for (let retryCount = 0; retryCount < 2; retryCount += 1) {
    const message = await requestQwenCustomerMessage(retryCount, signal);
    if (isValidCustomerMessage(message)) return message;
  }

  throw new Error("Qwen returned an invalid customer message.");
};

const getCustomerMessage = () => {
  const manualMessage = content.customerMessage.manualMessage?.trim();
  if (manualMessage) {
    return {
      mode: "manual",
      text: manualMessage,
    };
  }

  if (!content.customerMessage.useAiWhenEmpty) {
    return {
      mode: "empty",
      text: "",
    };
  }

  return {
    mode: "ai",
    text: getGeneratedCustomerMessage(),
  };
};

const renderCustomerMessage = () => {
  const message = getCustomerMessage();
  const isAiMessage = message.mode === "ai";

  if (!message.text) return "";

  return `
          <p class="mt-5 max-w-3xl text-[15px] leading-7 text-[#424242]" aria-label="${escapeHtml(content.customerMessage.label)}" data-customer-message${isAiMessage ? ` data-stream-message="${escapeHtml(resolvePlaceholders(message.text))}"` : ""}>
            ${
              isAiMessage
                ? `<span class="text-[#717171]">${escapeHtml(content.customerMessage.preparingText)}</span>`
                : renderInlineMessage(message.text)
            }
          </p>
  `;
};

const renderStatusIndicator = (item, index) => {
  if (item.statusTone === "processing") {
    return `
      <span class="${cx(componentClasses.statusBubble, toneClasses.neutral, "gap-1")}" aria-label="분석 중" data-status-bubble="processing">
        <span class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[#d1d1d1] border-t-[#6264a7]" aria-hidden="true"></span>
        ${editable(`checklist.items.${index}.status`, item.status)}
      </span>
    `;
  }

  const statusClass = toneClasses[item.statusTone] || toneClasses.neutral;

  return `
    <span class="${cx(componentClasses.statusBubble, statusClass)}" data-status-bubble="${escapeHtml(item.statusTone)}">
      ${editable(`checklist.items.${index}.status`, item.status)}
    </span>
  `;
};

const getChecklistReviewMessage = (item) => {
  if (item.reviewMessage) return item.reviewMessage;

  if (item.statusTone === "success" || item.statusTone === "submitted") {
    return "AI 검수 완료율 100%입니다. 제출 기준에 맞게 첨부되었습니다.";
  }

  if (item.statusTone === "danger") {
    return item.note ? `반려 사유: ${item.note}` : "반려 사유를 확인한 뒤 자료를 다시 업로드해 주세요.";
  }

  if (item.statusTone === "processing") {
    return "AI가 문서를 분석 중입니다. 잠시 후 검수 완료율과 결과가 표시됩니다.";
  }

  return "아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.";
};

const getAttachmentDownloadHref = (attachment) => {
  const filename = attachment?.name || "첨부파일.txt";
  const body = `AuditMind 첨부파일 샘플: ${filename}`;
  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
};

const renderChecklistAttachment = (item) => {
  if (!["success", "submitted"].includes(item.statusTone) || !item.attachment?.name) return "";

  const submittedAt = item.attachment.submittedAt || "첨부 완료";
  return `
    <p class="mt-2 text-xs text-[#717171]">
      <a class="font-semibold text-[#6264a7] underline decoration-[#6264a7] decoration-1 underline-offset-4 hover:text-[#4f528f]" href="${escapeHtml(getAttachmentDownloadHref(item.attachment))}" download="${escapeHtml(item.attachment.name)}">
        ${escapeHtml(item.attachment.name)}
      </a>
      <span> · ${escapeHtml(submittedAt)}</span>
    </p>
  `;
};

const renderSupportedFilesTooltip = () => {
  const supportedFiles = content.bulkUpload.supportedFiles.join(", ");

  return `
    <span class="group relative inline-flex align-middle">
      <button class="${cx(componentClasses.buttonBase, componentClasses.buttonVariants.subtle, "ml-1 h-6 rounded-full px-2 text-xs")}" type="button" aria-describedby="supported-files-tooltip">
        ${editable("bulkUpload.supportedLabel", content.bulkUpload.supportedLabel)}
      </button>
      <span id="supported-files-tooltip" role="tooltip" class="pointer-events-none absolute left-0 top-8 z-30 hidden w-[min(80vw,360px)] rounded-lg border border-[#d1d1d1] bg-white p-3 text-xs leading-5 text-[#424242] shadow-[0_8px_24px_rgba(0,0,0,0.14)] group-hover:block group-focus-within:block">
        <strong class="mb-1 block text-[#2a2a2a]">업로드 가능 확장자</strong>
        ${escapeHtml(supportedFiles)}
      </span>
    </span>
  `;
};

const renderUploadOverlay = () => `
  <div id="upload-overlay" class="fixed inset-0 z-40 hidden items-center justify-center bg-[#1f1f1f]/45 px-4 backdrop-blur-[1px]" role="status" aria-live="polite" aria-hidden="true">
    <div id="upload-overlay-card" class="${cx(componentClasses.surface, "flex min-h-[270px] w-full max-w-md flex-col p-5 shadow-[0_16px_44px_rgba(0,0,0,0.24)]")}">
      ${editableBlock("h2", "bulkUpload.overlayTitle", content.bulkUpload.overlayTitle, "text-lg font-semibold text-[#2a2a2a]")}
      <p id="upload-overlay-description" class="mt-2 text-sm leading-6 text-[#616161]">
        ${renderTextLines(content.bulkUpload.overlayDescriptionLines)}
      </p>
      <div class="mt-4 flex items-end justify-between gap-3">
        <span id="upload-overlay-file-count" class="text-xs font-semibold text-[#6264a7]">0개 파일</span>
        <strong id="upload-overlay-percent" class="text-2xl font-semibold text-[#2a2a2a]">0%</strong>
      </div>
      <div class="mt-3 h-2 rounded-full bg-[#e6e6e6]">
        <div id="upload-overlay-bar" class="h-2 w-0 rounded-full bg-[#6264a7] transition-[width] duration-200"></div>
      </div>
      <div class="mt-auto pt-4">
      <button id="upload-overlay-confirm" class="${cx(getButtonClass({ variant: "primary", size: "full" }), "invisible")}" type="button">
        ${editable("bulkUpload.overlayConfirm", content.bulkUpload.overlayConfirm)}
      </button>
      </div>
    </div>
  </div>
`;

const renderEditToolbar = () => {
  if (!editMode) return "";

  return `
    <div class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#d1d1d1] bg-white px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
      <span class="font-semibold text-[#6264a7]">문구 편집 모드</span>
      <span class="text-[#717171]">텍스트를 클릭해서 수정</span>
      <button id="copy-overrides" class="${getButtonClass({ variant: "primary", size: "sm" })}" type="button">변경사항 복사</button>
      <button id="reset-copy" class="${getButtonClass({ variant: "secondary", size: "sm" })}" type="button">초기화</button>
    </div>
  `;
};

const renderChecklistItems = () =>
  content.checklist.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => activeChecklistFilter === "전체" || !["success", "submitted"].includes(item.statusTone))
    .sort((left, right) => {
      const order = {
        processing: 0,
        danger: 1,
        neutral: 2,
        success: 3,
        submitted: 4,
      };

      return (order[left.item.statusTone] ?? 99) - (order[right.item.statusTone] ?? 99);
    })
    .map(({ item, index }) => {
      const rowClass = item.highlight ? componentClasses.rowAttention : componentClasses.row;
      const canUploadAction = !["processing", "submitted"].includes(item.statusTone);
      const actionClass = getButtonClass({
        variant: item.primaryAction ? "primary" : "secondary",
        disabled: !canUploadAction,
      });
      const canFinalSubmit = item.statusTone === "success";
      const finalSubmitClass = getButtonClass({ variant: "primary", disabled: !canFinalSubmit });
      const reviewClass = item.statusTone === "danger" ? "text-[#a4262c]" : "text-[#616161]";

      return `
        <li class="${rowClass}">
          ${renderStatusIndicator(item, index)}
          <div>
            ${editableBlock("h3", `checklist.items.${index}.title`, item.title, "font-semibold text-[#2a2a2a]")}
            ${editableBlock("p", `checklist.items.${index}.reviewMessage`, getChecklistReviewMessage(item), `mt-1 text-[13px] ${reviewClass}`)}
            ${renderChecklistAttachment(item)}
          </div>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <button class="${actionClass}" type="button"${canUploadAction ? "" : " disabled"} aria-disabled="${canUploadAction ? "false" : "true"}">
              ${editable(`checklist.items.${index}.action`, item.action)}
            </button>
            <button class="${finalSubmitClass}" type="button"${canFinalSubmit ? "" : " disabled"} aria-disabled="${canFinalSubmit ? "false" : "true"}" data-final-submit-index="${index}">
              ${editable("checklist.finalSubmitAction", content.checklist.finalSubmitAction)}
            </button>
          </div>
        </li>
      `;
    })
    .join("");

const renderApp = () => {
  app.innerHTML = `
    <header class="border-b border-[#d1d1d1] bg-[#f8f8f8]">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div class="flex items-center gap-3">
          ${renderBrandSymbol()}
          <div>
            ${editableBlock("p", "brand.eyebrow", content.brand.eyebrow, "text-xs text-[#717171]")}
            ${editableBlock("h1", "brand.title", content.brand.title, "text-lg font-semibold text-[#2a2a2a] md:text-xl")}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${content.brand.badges
            .map(
              (badge, index) => `
                <span class="${cx(componentClasses.pill, "min-h-7 px-3", index === 0 ? "bg-[#edf7ed] text-[#107c10]" : "bg-[#f3f2f1] text-[#616161]")}">
                  ${editable(`brand.badges.${index}`, badge)}
                </span>
              `,
            )
            .join("")}
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section class="grid gap-4">
        <section class="${cx(componentClasses.surface, "p-4 md:p-5")}" aria-labelledby="request-title">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              ${content.request.meta ? editableBlock("p", "request.meta", content.request.meta, "mb-1 text-xs text-[#717171]") : ""}
              ${editableBlock("h2", "request.title", content.request.title, "max-w-4xl text-2xl font-semibold leading-tight text-[#242424] md:text-[26px]", 'id="request-title"')}
              ${content.request.description ? editableBlock("p", "request.description", content.request.description, "mt-2 max-w-2xl text-[#616161]") : ""}
              ${renderCustomerMessage()}
            </div>
            <div class="${cx(componentClasses.panel, "min-w-[260px] p-3")}">
              <div class="grid gap-3">
                <div>
                  <div class="flex items-end justify-between gap-3">
                    ${editableBlock("span", "request.progressLabel", content.request.progressLabel, "text-xs font-semibold text-[#2a2a2a]")}
                    ${editableBlock("strong", "request.progressValue", content.request.progressValue, "text-2xl font-semibold text-[#2a2a2a]")}
                  </div>
                  <div class="mt-3 h-2 rounded-full bg-[#e6e6e6]">
                    <div class="h-2 w-[58%] rounded-full bg-[#6264a7]"></div>
                  </div>
                  ${editableBlock("p", "request.progressDetail", content.request.progressDetail, "mt-2 text-xs text-[#717171]")}
                </div>
                <div class="border-t border-[#e6e6e6] pt-3">
                  <div class="flex items-center justify-between gap-3">
                    ${editableBlock("span", "request.deadlineLabel", content.request.deadlineLabel, "text-xs font-semibold text-[#2a2a2a]")}
                    ${editableBlock("strong", "request.deadlineValue", content.request.deadlineValue, "text-sm font-semibold text-[#2a2a2a]")}
                  </div>
                  <div class="mt-3 h-2 rounded-full bg-[#e6e6e6]">
                    <div class="h-2 rounded-full bg-[#c8a000]" style="width: ${escapeHtml(content.request.deadlinePercent)}"></div>
                  </div>
                  ${editableBlock("p", "request.deadlineDetail", content.request.deadlineDetail, "mt-2 text-xs text-[#8a6100]")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="${cx(componentClasses.surface, "p-4 md:p-4")}" aria-labelledby="bulk-upload-title" data-component="dropzone">
          <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div class="flex gap-4">
              <div class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#d1d1d1] bg-[#fafafa] text-[#6264a7] md:flex">
                ${renderUploadIcon()}
              </div>
              <div>
                ${editableBlock("h2", "bulkUpload.title", content.bulkUpload.title, "text-base font-semibold text-[#2a2a2a]", 'id="bulk-upload-title"')}
                <p class="mt-1 max-w-2xl text-sm leading-6 text-[#616161]">
                  ${editable("bulkUpload.description", content.bulkUpload.description)}
                  ${renderSupportedFilesTooltip()}
                </p>
                ${
                  content.bulkUpload.formats.length
                    ? `<div class="mt-3 flex flex-wrap gap-2">
                        ${content.bulkUpload.formats
                          .map(
                            (format, index) => `
                              <span class="${cx(componentClasses.pill, "bg-white text-[#616161]")}">
                                ${editable(`bulkUpload.formats.${index}`, format)}
                              </span>
                            `,
                          )
                          .join("")}
                      </div>`
                    : ""
                }
              </div>
            </div>
            <label class="${cx(getButtonClass({ variant: "primary", size: "lg" }), "cursor-pointer gap-2")}">
              ${renderPlusIcon()}
              ${editable("bulkUpload.button", content.bulkUpload.button)}
              <input class="sr-only" type="file" multiple accept="${escapeHtml(getAcceptedFileExtensions())}" data-upload-input />
            </label>
          </div>
        </section>

        <section class="${cx(componentClasses.surface, "overflow-hidden")}" aria-labelledby="checklist-title">
          <div class="flex flex-col gap-3 border-b border-[#e6e6e6] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              ${editableBlock("h2", "checklist.title", content.checklist.title, "text-base font-semibold text-[#2a2a2a]", 'id="checklist-title"')}
              ${editableBlock("p", "checklist.description", content.checklist.description, "mt-1 text-[13px] text-[#717171]")}
            </div>
            <div class="${componentClasses.filterGroup}" aria-label="자료 필터">
              ${content.checklist.filters
                .map(
                  (filter, index) => `
                    <button class="${cx(componentClasses.filterButton, filter === activeChecklistFilter ? "bg-white font-semibold text-[#2a2a2a] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#616161] hover:text-[#2a2a2a]")}" type="button" data-checklist-filter="${escapeHtml(filter)}" aria-pressed="${filter === activeChecklistFilter ? "true" : "false"}">
                      ${editable(`checklist.filters.${index}`, filter)}
                    </button>
                  `,
                )
                .join("")}
            </div>
          </div>
          <ol class="divide-y divide-[#e6e6e6]">
            ${renderChecklistItems()}
          </ol>
        </section>
      </section>

      <aside class="grid h-fit gap-4">
        <section class="${cx(componentClasses.surface, "p-4")}" aria-labelledby="review-title">
          ${editableBlock("h2", "sidebar.nextTitle", content.sidebar.nextTitle, "text-lg font-semibold text-[#2a2a2a]", 'id="review-title"')}
          <ol class="mt-3 grid gap-3">
            ${content.sidebar.nextSteps
              .map(
                (step, index) => `
                  <li class="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
                    <span class="mt-1.5 h-2 w-2 rounded-full bg-[#6264a7]"></span>
                    ${editableBlock("p", `sidebar.nextSteps.${index}`, step, "text-[#616161]")}
                  </li>
                `,
              )
              .join("")}
          </ol>
        </section>
      </aside>
    </main>
    ${renderUploadOverlay()}
    ${renderEditToolbar()}
  `;
};

const bindUploadSimulation = () => {
  const input = app.querySelector("[data-upload-input]");
  if (!input) return;

  const applyAnalysisState = () => {
    clearTimeout(analysisSimulationTimer);
    content.checklist.items = content.checklist.items.map((item) => ({
      ...item,
      status: "분석 중",
      statusTone: "processing",
      action: "파일 업로드",
      primaryAction: false,
      highlight: false,
      reviewMessage: "AI가 문서를 분석 중입니다. 잠시 후 검수 완료율과 결과가 표시됩니다.",
      note: "",
    }));
    renderApp();
    bindUploadSimulation();
    bindEditMode();
    bindCustomerMessage();

    analysisSimulationTimer = setTimeout(() => {
      const routedItems = routeUploadedFilesToChecklist(pendingUploadFiles, classifiedChecklistItems);
      if (import.meta.env.DEV) {
        window.__auditmindLastRouting = {
          uploadedFiles: clone(pendingUploadFiles),
          items: clone(routedItems),
        };
      }
      content.checklist.items = routedItems;
      classifiedChecklistItems = clone(content.checklist.items);
      renderApp();
      bindUploadSimulation();
      bindEditMode();
      bindCustomerMessage();
    }, 4200);
  };

  app.querySelector("#upload-overlay-confirm")?.addEventListener("click", () => {
    const overlay = app.querySelector("#upload-overlay");
    const input = app.querySelector("[data-upload-input]");
    overlay?.classList.add("hidden");
    overlay?.classList.remove("flex");
    overlay?.setAttribute("aria-hidden", "true");
    if (input) input.value = "";
    applyAnalysisState();
  });

  input.addEventListener("change", () => {
    const fileCount = input.files?.length || 0;
    if (!fileCount) return;

    const overlay = app.querySelector("#upload-overlay");
    const bar = app.querySelector("#upload-overlay-bar");
    const percent = app.querySelector("#upload-overlay-percent");
    const fileCountText = app.querySelector("#upload-overlay-file-count");
    const title = overlay?.querySelector("h2");
    const description = app.querySelector("#upload-overlay-description");
    const confirmButton = app.querySelector("#upload-overlay-confirm");
    if (!overlay || !bar || !percent || !fileCountText || !title || !description || !confirmButton) return;

    clearInterval(uploadSimulationTimer);
    clearTimeout(analysisSimulationTimer);
    pendingUploadFiles = Array.from(input.files || []).map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));
    overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      overlay.setAttribute("aria-hidden", "false");
      title.textContent = customerPortalContent.bulkUpload.overlayTitle;
      description.innerHTML = renderTextLines(customerPortalContent.bulkUpload.overlayDescriptionLines);
      confirmButton.classList.add("invisible");
    fileCountText.textContent = `${fileCount}개 파일`;
    bar.style.width = "0%";
    percent.textContent = "0%";

    let progress = 0;
    uploadSimulationTimer = setInterval(() => {
      progress = Math.min(progress + 13, 100);
      bar.style.width = `${progress}%`;
      percent.textContent = `${progress}%`;

      if (progress < 100) return;
      clearInterval(uploadSimulationTimer);
      title.textContent = customerPortalContent.bulkUpload.overlayComplete;
      description.innerHTML = renderTextLines(customerPortalContent.bulkUpload.overlayCompleteDescriptionLines);
      confirmButton.classList.remove("invisible");
    }, 600);
  });
};

const bindCustomerMessage = () => {
  clearTimeout(customerMessageTimer);
  clearInterval(customerMessageStreamingTimer);
  customerMessageAbortController?.abort();

  const target = app.querySelector("[data-stream-message]");
  if (!target) return;

  customerMessageAbortController = new AbortController();
  const signal = customerMessageAbortController.signal;
  const fallbackText = target.dataset.streamMessage || "";
  target.textContent = content.customerMessage.preparingText;

  const streamMessage = (text) => {
    if (signal.aborted) return;
    target.innerHTML = "";
    let index = 0;
    const messageLength = getInlineMessageLength(text);
    if (!messageLength) return;
    customerMessageStreamingTimer = setInterval(() => {
      if (signal.aborted) {
        clearInterval(customerMessageStreamingTimer);
        return;
      }
      target.innerHTML = renderInlineMessageSegments(parseInlineMessageSegments(text), index + 1);
      index += 1;
      if (index >= messageLength) {
        clearInterval(customerMessageStreamingTimer);
        target.innerHTML = renderInlineMessage(text);
      }
    }, 14);
  };

  customerMessageTimer = setTimeout(async () => {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 3200);
    signal.addEventListener("abort", () => timeoutController.abort(), { once: true });

    try {
      const text = await getQwenCustomerMessage(timeoutController.signal);
      clearTimeout(timeoutId);
      streamMessage(text);
    } catch {
      clearTimeout(timeoutId);
      streamMessage(fallbackText);
    }
  }, 420);
};

const bindEditMode = () => {
  if (!editMode) return;

  app.addEventListener("blur", (event) => {
    const target = event.target.closest("[data-copy-path]");
    if (!target) return;

    const path = target.dataset.copyPath;
    const value = target.textContent.trim();
    copyOverrides[path] = value;
    localStorage.setItem(storageKey, JSON.stringify(copyOverrides));
    setPath(content, path, value);
  }, true);

  app.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.closest("[data-copy-path]")) return;
    event.preventDefault();
    event.target.blur();
  });

  app.addEventListener("click", (event) => {
    if (event.target.id === "copy-overrides") {
      const payload = JSON.stringify(copyOverrides, null, 2);
      navigator.clipboard?.writeText(payload);
      event.target.textContent = "복사됨";
      setTimeout(() => {
        event.target.textContent = "변경사항 복사";
      }, 1200);
      return;
    }

    if (event.target.id !== "reset-copy") return;
    localStorage.removeItem(storageKey);
    copyOverrides = {};
    content = clone(customerPortalContent);
    normalizeWorkflowCopy();
    classifiedChecklistItems = clone(content.checklist.items);
    renderApp();
    bindUploadSimulation();
    bindEditMode();
    bindCustomerMessage();
  });
};

renderApp();
bindUploadSimulation();
bindEditMode();
bindCustomerMessage();

app.addEventListener("click", (event) => {
  const finalSubmitButton = event.target.closest("[data-final-submit-index]");
  if (finalSubmitButton && !finalSubmitButton.disabled) {
    const itemIndex = Number(finalSubmitButton.dataset.finalSubmitIndex);
    const nextItem = {
      ...content.checklist.items[itemIndex],
      status: "접수완료",
      statusTone: "submitted",
      primaryAction: false,
      highlight: false,
      reviewMessage: "최종 접수가 완료되었습니다.",
    };
    content.checklist.items[itemIndex] = nextItem;
    classifiedChecklistItems[itemIndex] = clone(nextItem);
    renderApp();
    bindUploadSimulation();
    bindEditMode();
    bindCustomerMessage();
    return;
  }

  const filterButton = event.target.closest("[data-checklist-filter]");
  if (!filterButton) return;

  activeChecklistFilter = filterButton.dataset.checklistFilter;
  renderApp();
  bindUploadSimulation();
  bindEditMode();
  bindCustomerMessage();
});

if (import.meta.hot) {
  import.meta.hot.accept();
}
