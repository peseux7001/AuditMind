import { customerPortalContent } from "./customerPortalContent.js";
import { routeUploadedFilesToChecklist } from "./documentRouting.js";

const app = document.querySelector("#app");
const storageKey = "auditmind.customerPortal.copyOverrides.v3";
const searchParams = new URLSearchParams(window.location.search);
const editMode = import.meta.env.DEV && searchParams.get("edit") === "1";
const mockMode = import.meta.env.DEV && searchParams.get("mock") === "1";
const accessState = searchParams.get("access");
const portalToken = decodeURIComponent(window.location.pathname.split("/").filter(Boolean)[1] || "demo-token");
const portalEndpoint = `/api/submission-portal/${encodeURIComponent(portalToken)}`;

const toneClasses = {
  success: "border border-[#c9e7ca] bg-[#f3fbf3] text-[#107c10]",
  submitted: "border border-[#c9e7ca] bg-[#f3fbf3] text-[#107c10]",
  warning: "border border-[#f2dd8d] bg-[#fff9df] text-[#8a6100]",
  danger: "border border-[#f1b8be] bg-[#fff4f5] text-[#a4262c]",
  neutral: "border border-[#d1d1d1] bg-[#f7f7f7] text-[#616161]",
};

const cx = (...classes) => classes.filter(Boolean).join(" ");

const componentClasses = {
  surface: "rounded-lg border border-[#dde6f0] bg-white shadow-[0_1px_2px_rgba(4,56,115,0.06)]",
  panel: "rounded-lg border border-[#dbe8f6] bg-[#f7fbff]",
  buttonBase:
    "inline-flex items-center justify-center rounded-md border font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6264a7]",
  buttonSizes: {
    sm: "h-8 px-2 text-xs",
    md: "h-9 min-w-[104px] px-3 text-sm",
    lg: "h-10 px-4 text-sm",
    full: "h-9 w-full px-3 text-sm",
  },
  buttonVariants: {
    primary: "border-[#4f9cf9] bg-[#4f9cf9] text-white hover:bg-[#3188ee] active:bg-[#1976d2]",
    secondary: "border-[#d1d1d1] bg-white text-[#424242] hover:bg-[#fafafa] active:bg-[#f3f2f1]",
    disabled: "cursor-not-allowed border-[#d1d1d1] bg-[#f3f2f1] text-[#a0a0a0]",
    subtle: "border-[#d1d1d1] bg-white text-[#616161] hover:border-[#4f9cf9] hover:text-[#043873]",
  },
  statusBubble: "inline-flex min-h-6 w-[72px] items-center justify-center whitespace-nowrap rounded-full px-2 text-xs font-semibold",
  pill: "inline-flex min-h-6 items-center rounded-full px-2 text-xs font-semibold",
  filterGroup: "inline-flex w-fit rounded-lg bg-[#f3f2f1] p-[3px]",
  filterButton: "h-8 rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6264a7]",
  row: "relative grid gap-3 p-4 transition-colors hover:bg-[#fafafa] md:grid-cols-[124px_minmax(0,1fr)_auto] md:items-center",
  rowAttention:
    "relative grid gap-3 bg-[#fffafa] p-4 transition-colors hover:bg-[#fff7f8] md:grid-cols-[124px_minmax(0,1fr)_auto] md:items-center",
  rowSuccess:
    "relative grid gap-3 bg-[#fbfffb] p-4 transition-colors hover:bg-[#f6fcf6] md:grid-cols-[124px_minmax(0,1fr)_auto] md:items-center",
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

const normalizePercent = (value, fallback = "0%") => {
  const match = String(value ?? "").match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const percent = Math.max(0, Math.min(100, Number(match[0])));
  return `${percent}%`;
};

const showElement = (element) => {
  element?.classList.remove("hidden");
  element?.style.removeProperty("display");
};

const hideElement = (element) => {
  element?.classList.add("hidden");
  if (element) element.style.display = "none";
};

const resolvePlaceholders = (value) => String(value).replaceAll("#####", content?.legalFooter?.companyName || "AuditMind");

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
let customerMessageInitialized = false;
let customerMessageRenderedHtml = "";
let pendingUploadFiles = [];
let pendingUploadFileObjects = [];
let pendingUploadTargetItemId = "";
let pendingFinalSubmitIndex = null;
let activeChecklistFilter = content.checklist.filters[0] || "전체";
let classifiedChecklistItems = clone(content.checklist.items);
let customerRequestText = content.customerRequest?.defaultValue || "";
let customerRequestSaved = false;
let customerRequestSubmitted = false;
let portalApiMode = false;
let portalPollTimer;

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

const emphasisUnderlineClass = "underline decoration-[#4f9cf9] decoration-2 underline-offset-4";

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
    <div class="flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white font-bold text-[#043873] shadow-[0_1px_2px_rgba(0,0,0,0.10)]" aria-label="${escapeHtml(symbolAlt)}">
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

const mapPortalItem = (item) => ({
  id: item.id,
  status: item.status,
  statusTone: item.statusTone,
  title: item.title,
  description: item.description || "",
  reviewMessage: item.reviewMessage,
  accountantComment: item.accountantComment || "",
  note: "",
  attachment: item.attachment || null,
  action: item.action || "파일 업로드",
  primaryAction: Boolean(item.primaryAction),
});

const applyPortalPayload = (payload) => {
  if (!payload?.request || !Array.isArray(payload.items)) return false;
  portalApiMode = true;
  content.brand.badges = [payload.request.customerName || content.brand.badges[0]];
  content.request.title = payload.request.title || content.request.title;
  content.request.progressValue = payload.request.progressValue || content.request.progressValue;
  content.request.progressDetail = payload.request.progressDetail || content.request.progressDetail;
  content.request.deadlineValue = payload.request.dueDate || content.request.deadlineValue;
  content.request.deadlineDetail = payload.request.deadlineDetail || content.request.deadlineDetail;
  content.request.deadlinePercent = payload.request.deadlinePercent || content.request.deadlinePercent;
  content.checklist.items = payload.items.map(mapPortalItem);
  classifiedChecklistItems = clone(content.checklist.items);
  customerRequestText = payload.request.customerRequestMessage || "";
  customerRequestSubmitted = payload.request.customerRequestStatus === "submitted";
  customerRequestSaved = customerRequestSubmitted || Boolean(customerRequestText);
  return true;
};

const fetchPortalPayload = async () => {
  const response = await fetch(portalEndpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`portal_fetch_failed_${response.status}`);
  return response.json();
};

const refreshPortalFromApi = async ({ rerender = true } = {}) => {
  const payload = await fetchPortalPayload();
  applyPortalPayload(payload);
  if (rerender) rerenderApp({ animateChecklist: true });
  return payload;
};

const startPortalPolling = () => {
  clearInterval(portalPollTimer);
  if (!portalApiMode) return;
  portalPollTimer = setInterval(() => {
    refreshPortalFromApi({ rerender: true })
      .then(stopPortalPollingWhenStable)
      .catch(() => {});
  }, 2500);
};

const stopPortalPollingWhenStable = () => {
  if (!content.checklist.items.some((item) => item.statusTone === "processing")) {
    clearInterval(portalPollTimer);
  }
};

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
  const shouldUseCachedAiMessage = isAiMessage && customerMessageRenderedHtml;
  const shouldShowStablePreparingText = isAiMessage && customerMessageInitialized && !customerMessageRenderedHtml;

  return `
          <p class="mt-5 max-w-3xl text-[15px] leading-7 text-[#424242]" aria-label="${escapeHtml(content.customerMessage.label)}" data-customer-message${isAiMessage && !shouldUseCachedAiMessage && !shouldShowStablePreparingText ? ` data-stream-message="${escapeHtml(resolvePlaceholders(message.text))}"` : ""}>
            ${
              shouldUseCachedAiMessage
                ? customerMessageRenderedHtml
                : shouldShowStablePreparingText
                  ? `<span class="text-[#717171]">${escapeHtml(content.customerMessage.preparingText)}</span>`
                : isAiMessage
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
        <svg class="auditmind-processing-spinner h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
          <circle class="auditmind-processing-spinner-track" cx="8" cy="8" r="5.6"></circle>
          <circle class="auditmind-processing-spinner-arc" cx="8" cy="8" r="5.6"></circle>
        </svg>
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
    return item.note ? `오류 사유: ${item.note}` : "오류 사유를 확인한 뒤 자료를 다시 업로드해 주세요.";
  }

  if (item.statusTone === "processing") {
    return "AI가 문서를 분석 중입니다.";
  }

  return "아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.";
};

const getAttachmentDownloadHref = (attachment) => {
  if (attachment?.href) return attachment.href;
  const filename = attachment?.name || "첨부파일.txt";
  const body = `AuditMind 첨부파일 샘플: ${filename}`;
  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
};

const renderChecklistAttachment = (item) => {
  if (!["success", "submitted"].includes(item.statusTone) || !item.attachment?.name) return "";

  const submittedAt = item.attachment.submittedAt || "첨부 완료";
  return `
    <p class="mt-2 text-xs text-[#717171]">
      <a class="font-semibold text-[#0969da] underline decoration-[#4f9cf9] decoration-1 underline-offset-4 hover:text-[#043873]" href="${escapeHtml(getAttachmentDownloadHref(item.attachment))}" download="${escapeHtml(item.attachment.name)}">
        ${escapeHtml(item.attachment.name)}
      </a>
      <span> · ${escapeHtml(submittedAt)}</span>
    </p>
  `;
};

const renderAccountantComment = (item, index) => {
  if (!item.accountantComment) return "";
  return `
    <div class="mt-3 rounded-md border border-[#dbe8f6] bg-[#f7fbff] px-3 py-2">
      <p class="text-[11px] font-semibold text-[#043873]">요청사항</p>
      ${editableBlock("p", `checklist.items.${index}.accountantComment`, item.accountantComment, "mt-1 text-[13px] leading-5 text-[#2a2a2a]")}
    </div>
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

const renderBulkUploadGuidance = () => {
  if (!content.bulkUpload.guidance?.length) return "";

  return `
    <ul class="mt-3 grid gap-1.5 text-xs leading-5 text-[#616161]">
      ${content.bulkUpload.guidance
        .map(
          (item, index) => `
            <li class="grid grid-cols-[14px_minmax(0,1fr)] gap-2">
              <span class="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#4f9cf9]" aria-hidden="true"></span>
              ${editableBlock("span", `bulkUpload.guidance.${index}`, item, "")}
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
};

const renderCustomerRequestCard = () => `
  <section class="${cx(componentClasses.surface, "p-4 md:p-4")}" aria-labelledby="customer-request-title">
    <div class="grid gap-3">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          ${editableBlock("h2", "customerRequest.title", content.customerRequest.title, "text-base font-semibold text-[#2a2a2a]", 'id="customer-request-title"')}
          ${
            content.customerRequest.helper
              ? editableBlock("p", "customerRequest.helper", content.customerRequest.helper, "mt-1 text-[13px] leading-5 text-[#717171]")
              : ""
          }
        </div>
        <div class="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <button class="${cx(getButtonClass({ variant: "primary", size: "md", disabled: customerRequestSubmitted || customerRequestSaved }), "w-[104px]")}" type="button" data-customer-request-action="save"${customerRequestSubmitted || customerRequestSaved ? " disabled" : ""}>
            ${editable("customerRequest.saveAction", content.customerRequest.saveAction)}
          </button>
          <button class="${cx(getButtonClass({ variant: "secondary", size: "md", disabled: customerRequestSubmitted || !customerRequestSaved }), "w-[104px]")}" type="button" data-customer-request-action="edit"${customerRequestSubmitted || !customerRequestSaved ? " disabled" : ""}>
            ${editable("customerRequest.editAction", content.customerRequest.editAction)}
          </button>
          <button class="${cx(getButtonClass({ variant: "primary", size: "md", disabled: customerRequestSubmitted || !customerRequestSaved }), "w-[104px]")}" type="button" data-customer-request-action="submit"${customerRequestSubmitted || !customerRequestSaved ? " disabled" : ""}>
            ${editable(customerRequestSubmitted ? "customerRequest.submittedAction" : "customerRequest.submitAction", customerRequestSubmitted ? content.customerRequest.submittedAction : content.customerRequest.submitAction)}
          </button>
        </div>
      </div>
      <textarea
        class="${cx("min-h-28 w-full resize-y rounded-md border border-[#d1d1d1] px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-[#a0a0a0] focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20", customerRequestSaved || customerRequestSubmitted ? "bg-[#f7f7f7] text-[#616161] opacity-75" : "bg-white text-[#242424]")}"
        data-customer-request-input
        placeholder="${escapeHtml(content.customerRequest.placeholder)}"
        aria-label="${escapeHtml(content.customerRequest.title)}"
        ${customerRequestSaved || customerRequestSubmitted ? "readonly" : ""}
      >${escapeHtml(customerRequestText)}</textarea>
    </div>
  </section>
`;

const renderLegalFooter = () => {
  const footer = content.legalFooter;
  const businessInfo = [
    { label: "상호", path: "legalFooter.companyName", value: footer.companyName },
    { label: "대표", path: "legalFooter.representative", value: footer.representative },
    { label: "사업자등록번호", path: "legalFooter.businessRegistrationNumber", value: footer.businessRegistrationNumber },
    { label: "통신판매업 신고번호", path: "legalFooter.mailOrderRegistrationNumber", value: footer.mailOrderRegistrationNumber },
    { label: "주소", path: "legalFooter.address", value: footer.address },
    { label: "전화", path: "legalFooter.phone", value: footer.phone },
    { label: "이메일", path: "legalFooter.email", value: footer.email },
    { label: "", path: "legalFooter.privacyOfficer", value: footer.privacyOfficer },
  ];

  return `
    <footer class="mt-2 bg-[#043873] text-white" aria-label="사업자 및 약관 정보">
      <div class="mx-auto max-w-5xl px-4 py-5 md:px-6">
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-white/78">
          ${businessInfo
            .map(
              (item) => `
                <span>${item.label ? `${item.label} ` : ""}${editable(item.path, item.value)}</span>
              `,
            )
            .join("")}
        </div>
        <nav class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-white" aria-label="푸터 링크">
          ${footer.links
            .map(
              (link, index) => `
                <a class="underline-offset-4 hover:underline focus-visible:outline-white" href="#">
                  ${editable(`legalFooter.links.${index}`, link)}
                </a>
              `,
            )
            .join("")}
        </nav>
        ${editableBlock("p", "legalFooter.copyright", footer.copyright, "mt-3 text-xs text-white/60")}
      </div>
    </footer>
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
        <div id="upload-overlay-actions" class="grid gap-2">
          <button id="upload-overlay-confirm" class="${cx(getButtonClass({ variant: "primary", size: "full" }), "invisible")}" type="button">
            ${editable("bulkUpload.overlayConfirm", content.bulkUpload.overlayConfirm)}
          </button>
          <button id="upload-overlay-retry" class="${cx(getButtonClass({ variant: "primary", size: "full" }), "hidden")}" type="button">
            ${editable("bulkUpload.overlayRetry", content.bulkUpload.overlayRetry)}
          </button>
          <button id="upload-overlay-close" class="${cx(getButtonClass({ variant: "secondary", size: "full" }), "hidden")}" type="button">
            ${editable("bulkUpload.overlayClose", content.bulkUpload.overlayClose)}
          </button>
        </div>
      </div>
    </div>
  </div>
`;

const renderFinalSubmitDialog = () => `
  <div id="final-submit-dialog" class="fixed inset-0 z-40 hidden items-center justify-center bg-[#1f1f1f]/45 px-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="final-submit-title" aria-hidden="true">
    <div class="${cx(componentClasses.surface, "w-full max-w-md p-5 shadow-[0_16px_44px_rgba(0,0,0,0.24)]")}">
      ${editableBlock("h2", "checklist.finalSubmitConfirmTitle", content.checklist.finalSubmitConfirmTitle, "text-lg font-semibold text-[#2a2a2a]", 'id="final-submit-title"')}
      ${editableBlock("p", "checklist.finalSubmitConfirmDescription", content.checklist.finalSubmitConfirmDescription, "mt-2 text-sm leading-6 text-[#616161]")}
      <div class="mt-5 grid gap-2 sm:grid-cols-2">
        <button id="final-submit-cancel" class="${getButtonClass({ variant: "secondary", size: "full" })}" type="button">
          ${editable("checklist.finalSubmitCancel", content.checklist.finalSubmitCancel)}
        </button>
        <button id="final-submit-confirm" class="${getButtonClass({ variant: "primary", size: "full" })}" type="button">
          ${editable("checklist.finalSubmitAction", content.checklist.finalSubmitAction)}
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

const getAccessNotice = () => {
  if (accessState === "expired" || accessState === "revoked") return content.access.expired;
  if (accessState === "invalid") return content.access.invalid;
  return null;
};

const renderAccessNoticeMain = (notice) => `
  <main class="mx-auto grid min-h-[58vh] max-w-5xl place-items-center px-4 py-10 md:px-6">
    <section class="${cx(componentClasses.surface, "w-full max-w-xl p-6 text-center md:p-8")}" aria-labelledby="access-notice-title">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#f3f2f1] text-lg font-semibold text-[#616161]" aria-hidden="true">
        !
      </div>
      <h2 id="access-notice-title" class="mt-4 text-xl font-semibold text-[#2a2a2a]">
        ${escapeHtml(notice.title)}
      </h2>
      <p class="mt-2 text-sm leading-6 text-[#616161]">
        ${escapeHtml(notice.description)}
      </p>
    </section>
  </main>
`;

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
      const rowClass =
        item.statusTone === "danger"
          ? componentClasses.rowAttention
          : ["success", "submitted"].includes(item.statusTone)
            ? componentClasses.rowSuccess
            : componentClasses.row;
      const statusLineClass =
        item.statusTone === "danger"
          ? "bg-[#a4262c]"
          : ["success", "submitted"].includes(item.statusTone)
            ? "bg-[#107c10]"
            : "";
      const canUploadAction = !["processing", "submitted"].includes(item.statusTone);
      const actionClass = getButtonClass({
        variant: item.primaryAction ? "primary" : "secondary",
        disabled: !canUploadAction,
      });
      const canFinalSubmit = item.statusTone === "success";
      const finalSubmitClass = getButtonClass({ variant: "primary", disabled: !canFinalSubmit });
      const reviewClass = item.statusTone === "danger" ? "text-[#a4262c]" : "text-[#616161]";

      return `
        <li class="${rowClass}" data-checklist-key="${index}">
          ${statusLineClass ? `<span class="absolute inset-y-0 left-0 w-1 ${statusLineClass}" aria-hidden="true"></span>` : ""}
          ${renderStatusIndicator(item, index)}
          <div>
            ${editableBlock("h3", `checklist.items.${index}.title`, item.title, "font-semibold text-[#2a2a2a]")}
            ${editableBlock("p", `checklist.items.${index}.reviewMessage`, getChecklistReviewMessage(item), `mt-1 text-[13px] ${reviewClass}`)}
            ${renderChecklistAttachment(item)}
            ${renderAccountantComment(item, index)}
          </div>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <button class="${actionClass}" type="button"${canUploadAction ? "" : " disabled"} aria-disabled="${canUploadAction ? "false" : "true"}" data-item-upload-trigger="${index}">
              ${editable(`checklist.items.${index}.action`, item.action)}
            </button>
            <input class="sr-only" type="file" accept="${escapeHtml(getAcceptedFileExtensions())}" data-item-upload-input="${index}" />
            <button class="${finalSubmitClass}" type="button"${canFinalSubmit ? "" : " disabled"} aria-disabled="${canFinalSubmit ? "false" : "true"}" data-final-submit-index="${index}">
              ${editable("checklist.finalSubmitAction", content.checklist.finalSubmitAction)}
            </button>
          </div>
        </li>
      `;
    })
    .join("");

const renderApp = () => {
  const accessNotice = getAccessNotice();

  app.innerHTML = `
    <header class="border-b border-[#043873] bg-[#043873]">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div class="flex items-center gap-3">
          ${renderBrandSymbol()}
          <div>
            ${editableBlock("p", "brand.eyebrow", content.brand.eyebrow, "text-xs text-white/70")}
            ${editableBlock("h1", "brand.title", content.brand.title, "text-lg font-semibold text-white md:text-xl")}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${content.brand.badges
            .map(
              (badge, index) => `
                <span class="${cx(componentClasses.pill, "min-h-7 px-3", index === 0 ? "bg-white/12 text-white ring-1 ring-white/20" : "bg-white/10 text-white/80")}">
                  ${editable(`brand.badges.${index}`, badge)}
                </span>
              `,
            )
            .join("")}
        </div>
      </div>
    </header>

    ${
      accessNotice
        ? renderAccessNoticeMain(accessNotice)
        : `<main class="mx-auto grid max-w-5xl gap-4 px-4 py-4 md:px-6">
      <section class="grid gap-4">
        <section class="${cx(componentClasses.surface, "p-4 md:p-5")}" aria-labelledby="request-title">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
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
                  <div class="mt-3 h-2 rounded-full bg-[#dbe8f6]">
                    <div class="h-2 rounded-full bg-[#4f9cf9]" style="width: ${escapeHtml(normalizePercent(content.request.progressValue))}"></div>
                  </div>
                  ${editableBlock("p", "request.progressDetail", content.request.progressDetail, "mt-2 text-xs text-[#717171]")}
                </div>
                <div class="border-t border-[#e6e6e6] pt-3">
                  <div class="flex items-center justify-between gap-3">
                    ${editableBlock("span", "request.deadlineLabel", content.request.deadlineLabel, "text-xs font-semibold text-[#2a2a2a]")}
                    ${editableBlock("strong", "request.deadlineValue", content.request.deadlineValue, "text-sm font-semibold text-[#2a2a2a]")}
                  </div>
                  <div class="mt-3 h-2 rounded-full bg-[#f0ead1]">
                    <div class="h-2 rounded-full bg-[#f2c94c]" style="width: ${escapeHtml(normalizePercent(content.request.deadlinePercent))}"></div>
                  </div>
                  ${editableBlock("p", "request.deadlineDetail", content.request.deadlineDetail, "mt-2 text-xs text-[#8a6100]")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-[#dbe8f6] bg-[#f5faff] p-4 shadow-[0_1px_2px_rgba(4,56,115,0.05)] md:p-4" aria-labelledby="bulk-upload-title" data-component="dropzone">
          <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div class="flex gap-4">
              <div class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#cfe4fb] bg-white text-[#4f9cf9] md:flex">
                ${renderUploadIcon()}
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  ${editableBlock("h2", "bulkUpload.title", content.bulkUpload.title, "text-base font-semibold text-[#2a2a2a]", 'id="bulk-upload-title"')}
                  ${renderSupportedFilesTooltip()}
                </div>
                ${
                  content.bulkUpload.description
                    ? `<p class="mt-1 max-w-2xl text-sm leading-6 text-[#616161]">
                        ${editable("bulkUpload.description", content.bulkUpload.description)}
                      </p>`
                    : ""
                }
                ${renderBulkUploadGuidance()}
                ${
                  content.bulkUpload.formats.length
                    ? `<div class="mt-3 flex flex-wrap gap-2">
                        ${content.bulkUpload.formats
                          .map(
                            (format, index) => `
                              <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-white text-[#616161]")}">
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

        ${renderCustomerRequestCard()}

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
    </main>`
    }

    ${renderLegalFooter()}
    ${renderUploadOverlay()}
    ${renderFinalSubmitDialog()}
    ${renderEditToolbar()}
  `;
};

const getChecklistRowRects = () =>
  new Map(
    Array.from(app.querySelectorAll("[data-checklist-key]")).map((row) => [
      row.dataset.checklistKey,
      row.getBoundingClientRect(),
    ]),
  );

const animateChecklistRows = (previousRects) => {
  if (!previousRects.size) return;

  app.querySelectorAll("[data-checklist-key]").forEach((row) => {
    const previousRect = previousRects.get(row.dataset.checklistKey);
    if (!previousRect) return;

    const nextRect = row.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    const deltaY = previousRect.top - nextRect.top;
    if (!deltaX && !deltaY) return;

    row.style.transition = "none";
    row.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    row.style.willChange = "transform";

    requestAnimationFrame(() => {
      row.style.transition = "transform 520ms cubic-bezier(0.18, 1.25, 0.32, 1)";
      row.style.transform = "";

      window.setTimeout(() => {
        row.style.transition = "";
        row.style.willChange = "";
      }, 540);
    });
  });
};

const uploadFilesToPortalApi = (files, onProgress) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file, file.name));
    if (pendingUploadTargetItemId) {
      formData.append("targetItemId", pendingUploadTargetItemId);
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${portalEndpoint}/upload`);
    xhr.responseType = "json";
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response || {});
      } else {
        reject(new Error(`upload_failed_${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("upload_network_failed")));
    xhr.addEventListener("abort", () => reject(new Error("upload_aborted")));
    xhr.send(formData);
  });

const rerenderApp = ({ animateChecklist = false } = {}) => {
  const previousRects = animateChecklist ? getChecklistRowRects() : new Map();
  renderApp();
  bindUploadSimulation();
  bindCustomerRequestInput();
  bindEditMode();
  bindCustomerMessage();
  if (animateChecklist) animateChecklistRows(previousRects);
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
      reviewMessage: "AI가 문서를 분석 중입니다.",
      note: "",
    }));
    rerenderApp({ animateChecklist: true });

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
      rerenderApp({ animateChecklist: true });
    }, 4200);
  };

  app.querySelector("#upload-overlay-confirm")?.addEventListener("click", () => {
    const overlay = app.querySelector("#upload-overlay");
    const input = app.querySelector("[data-upload-input]");
    overlay?.classList.add("hidden");
    overlay?.classList.remove("flex");
    overlay?.setAttribute("aria-hidden", "true");
    if (input) input.value = "";
    if (portalApiMode) {
      refreshPortalFromApi({ rerender: true })
        .then(() => {
          startPortalPolling();
          stopPortalPollingWhenStable();
        })
        .catch(() => {});
      return;
    }
    applyAnalysisState();
  });

  app.querySelector("#upload-overlay-close")?.addEventListener("click", () => {
    const overlay = app.querySelector("#upload-overlay");
    const input = app.querySelector("[data-upload-input]");
    clearInterval(uploadSimulationTimer);
    overlay?.classList.add("hidden");
    overlay?.classList.remove("flex");
    overlay?.setAttribute("aria-hidden", "true");
    if (input) input.value = "";
  });

  app.querySelector("#upload-overlay-retry")?.addEventListener("click", () => {
    clearInterval(uploadSimulationTimer);
    if (portalApiMode) {
      startActualUpload();
      return;
    }
    startUploadSimulation();
  });

  const setUploadFailureState = () => {
    const bar = app.querySelector("#upload-overlay-bar");
    const percent = app.querySelector("#upload-overlay-percent");
    const title = app.querySelector("#upload-overlay h2");
    const description = app.querySelector("#upload-overlay-description");
    const confirmButton = app.querySelector("#upload-overlay-confirm");
    const retryButton = app.querySelector("#upload-overlay-retry");
    const closeButton = app.querySelector("#upload-overlay-close");
    if (!bar || !percent || !title || !description || !confirmButton || !retryButton || !closeButton) return;

    bar.style.width = "42%";
    bar.classList.remove("bg-[#6264a7]");
    bar.classList.add("bg-[#a4262c]");
    percent.textContent = "";
    title.textContent = customerPortalContent.bulkUpload.overlayFailureTitle;
    description.innerHTML = renderTextLines(customerPortalContent.bulkUpload.overlayFailureDescriptionLines);
    confirmButton.classList.add("invisible");
    showElement(retryButton);
    showElement(closeButton);
  };

  const startUploadSimulation = () => {
    const fileCount = pendingUploadFiles.length;
    const overlay = app.querySelector("#upload-overlay");
    const bar = app.querySelector("#upload-overlay-bar");
    const percent = app.querySelector("#upload-overlay-percent");
    const fileCountText = app.querySelector("#upload-overlay-file-count");
    const title = overlay?.querySelector("h2");
    const description = app.querySelector("#upload-overlay-description");
    const confirmButton = app.querySelector("#upload-overlay-confirm");
    const retryButton = app.querySelector("#upload-overlay-retry");
    const closeButton = app.querySelector("#upload-overlay-close");
    if (!overlay || !bar || !percent || !fileCountText || !title || !description || !confirmButton || !retryButton || !closeButton) return;

    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    overlay.setAttribute("aria-hidden", "false");
    title.textContent = customerPortalContent.bulkUpload.overlayTitle;
    description.innerHTML = renderTextLines(customerPortalContent.bulkUpload.overlayDescriptionLines);
    confirmButton.classList.add("invisible");
    hideElement(retryButton);
    hideElement(closeButton);
    fileCountText.textContent = `${fileCount}개 파일`;
    bar.classList.remove("bg-[#a4262c]");
    bar.classList.add("bg-[#6264a7]");
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
      hideElement(retryButton);
      hideElement(closeButton);
    }, 600);
  };

  const startActualUpload = async () => {
    const filesForUpload = pendingUploadFileObjects;
    const fileCount = pendingUploadFiles.length;
    const overlay = app.querySelector("#upload-overlay");
    const bar = app.querySelector("#upload-overlay-bar");
    const percent = app.querySelector("#upload-overlay-percent");
    const fileCountText = app.querySelector("#upload-overlay-file-count");
    const title = overlay?.querySelector("h2");
    const description = app.querySelector("#upload-overlay-description");
    const confirmButton = app.querySelector("#upload-overlay-confirm");
    const retryButton = app.querySelector("#upload-overlay-retry");
    const closeButton = app.querySelector("#upload-overlay-close");
    if (!overlay || !bar || !percent || !fileCountText || !title || !description || !confirmButton || !retryButton || !closeButton) return;

    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    overlay.setAttribute("aria-hidden", "false");
    title.textContent = customerPortalContent.bulkUpload.overlayTitle;
    description.innerHTML = renderTextLines(customerPortalContent.bulkUpload.overlayDescriptionLines);
    confirmButton.classList.add("invisible");
    hideElement(retryButton);
    hideElement(closeButton);
    fileCountText.textContent = `${fileCount}개 파일`;
    bar.classList.remove("bg-[#a4262c]");
    bar.classList.add("bg-[#6264a7]");
    bar.style.width = "0%";
    percent.textContent = "0%";

    try {
      const result = await uploadFilesToPortalApi(filesForUpload, (progress) => {
        bar.style.width = `${progress}%`;
        percent.textContent = `${progress}%`;
      });
      if (result.portal) applyPortalPayload(result.portal);
      title.textContent = customerPortalContent.bulkUpload.overlayComplete;
      description.innerHTML = renderTextLines(customerPortalContent.bulkUpload.overlayCompleteDescriptionLines);
      bar.style.width = "100%";
      percent.textContent = "100%";
      confirmButton.classList.remove("invisible");
      hideElement(retryButton);
      hideElement(closeButton);
      startPortalPolling();
    } catch {
      setUploadFailureState();
    }
  };

  const beginUpload = (files, targetItemId = "") => {
    const fileCount = files?.length || 0;
    if (!fileCount) return;

    clearInterval(uploadSimulationTimer);
    clearTimeout(analysisSimulationTimer);
    pendingUploadFileObjects = Array.from(files || []);
    pendingUploadTargetItemId = targetItemId;
    pendingUploadFiles = pendingUploadFileObjects.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));
    if (portalApiMode) {
      startActualUpload();
      return;
    }
    startUploadSimulation();
  };

  input.addEventListener("change", () => {
    beginUpload(Array.from(input.files || []));
  });

  app.querySelectorAll("[data-item-upload-trigger]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const itemIndex = Number(button.dataset.itemUploadTrigger);
      app.querySelector(`[data-item-upload-input="${itemIndex}"]`)?.click();
    });
  });

  app.querySelectorAll("[data-item-upload-input]").forEach((itemInput) => {
    itemInput.addEventListener("change", () => {
      const itemIndex = Number(itemInput.dataset.itemUploadInput);
      const targetItemId = content.checklist.items[itemIndex]?.id || "";
      beginUpload(Array.from(itemInput.files || []), targetItemId);
    });
  });
};

const bindCustomerMessage = () => {
  if (customerMessageInitialized) return;
  clearTimeout(customerMessageTimer);
  clearInterval(customerMessageStreamingTimer);
  customerMessageAbortController?.abort();

  const target = app.querySelector("[data-stream-message]");
  if (!target) return;

  customerMessageAbortController = new AbortController();
  const signal = customerMessageAbortController.signal;
  const fallbackText = target.dataset.streamMessage || "";
  target.textContent = content.customerMessage.preparingText;
  customerMessageInitialized = true;

  const streamMessage = (text) => {
    if (signal.aborted) return;
    const initialTarget = app.querySelector("[data-customer-message]");
    if (initialTarget) initialTarget.innerHTML = "";
    let index = 0;
    const messageLength = getInlineMessageLength(text);
    if (!messageLength) return;
    customerMessageStreamingTimer = setInterval(() => {
      const currentTarget = app.querySelector("[data-customer-message]");
      if (!currentTarget) return;
      if (signal.aborted) {
        clearInterval(customerMessageStreamingTimer);
        return;
      }
      currentTarget.innerHTML = renderInlineMessageSegments(parseInlineMessageSegments(text), index + 1);
      index += 1;
      if (index >= messageLength) {
        clearInterval(customerMessageStreamingTimer);
        customerMessageRenderedHtml = renderInlineMessage(text);
        currentTarget.innerHTML = customerMessageRenderedHtml;
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

const bindCustomerRequestInput = () => {
  app.querySelector("[data-customer-request-input]")?.addEventListener("input", (event) => {
    customerRequestText = event.target.value;
  });

  const saveCustomerRequestToApi = async (status) => {
    if (!portalApiMode) return;
    await fetch(`${portalEndpoint}/customer-request`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: customerRequestText, status }),
    });
  };

  app.querySelectorAll("[data-customer-request-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.customerRequestAction === "save") {
        customerRequestSaved = true;
        saveCustomerRequestToApi("draft").catch(() => {});
        rerenderApp();
        return;
      }

      if (button.dataset.customerRequestAction === "edit") {
        customerRequestSaved = false;
        rerenderApp();
        window.requestAnimationFrame(() => app.querySelector("[data-customer-request-input]")?.focus());
        return;
      }

      if (button.dataset.customerRequestAction === "submit") {
        customerRequestSaved = true;
        customerRequestSubmitted = true;
        saveCustomerRequestToApi("submitted").catch(() => {});
        rerenderApp();
      }
    });
  });
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
    rerenderApp();
  });
};

const applyFinalSubmit = (itemIndex) => {
  const targetItem = content.checklist.items[itemIndex];
  if (portalApiMode && targetItem?.id) {
    fetch(`${portalEndpoint}/items/${encodeURIComponent(targetItem.id)}/final-submit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`final_submit_failed_${response.status}`);
        return response.json();
      })
      .then((payload) => {
        applyPortalPayload(payload);
        pendingFinalSubmitIndex = null;
        rerenderApp({ animateChecklist: true });
      })
      .catch(() => {});
    return;
  }
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
  pendingFinalSubmitIndex = null;
  rerenderApp({ animateChecklist: true });
};

const hideFinalSubmitDialog = () => {
  const dialog = app.querySelector("#final-submit-dialog");
  dialog?.classList.add("hidden");
  dialog?.classList.remove("flex");
  dialog?.setAttribute("aria-hidden", "true");
  pendingFinalSubmitIndex = null;
};

const showFinalSubmitDialog = (itemIndex) => {
  pendingFinalSubmitIndex = itemIndex;
  const dialog = app.querySelector("#final-submit-dialog");
  dialog?.classList.remove("hidden");
  dialog?.classList.add("flex");
  dialog?.setAttribute("aria-hidden", "false");
  app.querySelector("#final-submit-confirm")?.focus();
};

const handleCustomerPortalClick = (event) => {
  if (event.target.closest("#final-submit-cancel")) {
    hideFinalSubmitDialog();
    return;
  }

  if (event.target.closest("#final-submit-confirm")) {
    if (pendingFinalSubmitIndex !== null) {
      applyFinalSubmit(pendingFinalSubmitIndex);
    }
    return;
  }

  const finalSubmitButton = event.target.closest("[data-final-submit-index]");
  if (finalSubmitButton && !finalSubmitButton.disabled) {
    showFinalSubmitDialog(Number(finalSubmitButton.dataset.finalSubmitIndex));
    return;
  }

  const filterButton = event.target.closest("[data-checklist-filter]");
  if (!filterButton) return;

  activeChecklistFilter = filterButton.dataset.checklistFilter;
  rerenderApp({ animateChecklist: true });
};

export const startCustomerPortal = () => {
  rerenderApp();
  app.addEventListener("click", handleCustomerPortalClick);
  if (mockMode || accessState) {
    return;
  }
  refreshPortalFromApi({ rerender: true })
    .then(() => {
      startPortalPolling();
      stopPortalPollingWhenStable();
    })
    .catch(() => {
      portalApiMode = false;
    });
};
