import { accountantCustomerManagementContent } from "./accountantCustomerManagementContent.js";
import { componentClasses, cx, escapeHtml, getButtonClass, renderAccountantShell } from "./accountantShell.js";

const inputClass =
  "h-10 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-sm text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20";

const fieldLabelClass = "block text-xs font-semibold text-[#616161]";
const qwenEndpoint = "/api/qwen/chat/completions";
const qwenModel = "Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf";
const customersEndpoint = "/api/customers";
const businessLicenseParseEndpoint = "/api/customers/business-license/parse";

const hasJapaneseOrChineseCharacters = (value) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(value);

const extractQwenMessage = (payload) =>
  payload?.choices?.[0]?.message?.content ||
  payload?.choices?.[0]?.delta?.content ||
  payload?.choices?.[0]?.text ||
  "";

const normalizeAiAnalysis = (value) =>
  String(value)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const emphasisUnderlineClass = "font-semibold underline decoration-[#4f9cf9] decoration-2 underline-offset-4";

const parseInlineMessageSegments = (value) => {
  const segments = [];
  const source = String(value);
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

const getCustomerSubmissionSummary = (customer) => ({
  requestCount: Number(customer.submissionSummary?.requestCount || 0),
  openRequestCount: Number(customer.submissionSummary?.openRequestCount || 0),
  requestedItemCount: Number(customer.submissionSummary?.requestedItemCount || 0),
  acceptedItemCount: Number(customer.submissionSummary?.acceptedItemCount || 0),
  finalSubmittedItemCount: Number(customer.submissionSummary?.finalSubmittedItemCount || 0),
  failedItemCount: Number(customer.submissionSummary?.failedItemCount || 0),
  processingItemCount: Number(customer.submissionSummary?.processingItemCount || 0),
  missingItemCount: Number(customer.submissionSummary?.missingItemCount || 0),
  recentRequests: Array.isArray(customer.submissionSummary?.recentRequests) ? customer.submissionSummary.recentRequests : [],
  recentFailedItems: Array.isArray(customer.submissionSummary?.recentFailedItems) ? customer.submissionSummary.recentFailedItems : [],
});

const buildCustomerAnalysisSourceSnapshot = (customer) => ({
  analysisVersion: "customer-analysis-v2",
  company: customer.company,
  businessNumber: customer.businessNumber,
  ceoName: customer.ceoName,
  businessType: customer.businessType,
  businessItem: customer.businessItem,
  address: customer.address,
  contactCount: customer.contacts.length,
  primaryContactId: getPrimaryContact(customer)?.id || "",
  submissionSummary: getCustomerSubmissionSummary(customer),
});

const isSameSnapshot = (left, right) => JSON.stringify(left || {}) === JSON.stringify(right || {});

const formatSubmissionSummaryForPrompt = (customer) => {
  const summary = getCustomerSubmissionSummary(customer);
  const recentRequests = summary.recentRequests
    .map(
      (request) =>
        `${request.title || "제목 없음"} / 요청일 ${request.createdAt || "-"} / 마감 ${request.dueDate || "-"} / 접수 ${request.accepted || 0}/${request.total || 0} / 실패 ${request.failed || 0} / 미제출 ${request.missing || 0}`,
    )
    .join("\n");
  const failedItems = summary.recentFailedItems
    .map((item) => `${item.requestTitle || "요청명 없음"} / ${item.documentName || "자료명 없음"} / ${item.message || "사유 미기록"}`)
    .join("\n");

  return [
    `자료요청 수: ${summary.requestCount}`,
    `진행 중 요청 수: ${summary.openRequestCount}`,
    `요청 자료 수: ${summary.requestedItemCount}`,
    `AI 검수 통과 또는 최종 접수 자료 수: ${summary.acceptedItemCount}`,
    `최종 접수 자료 수: ${summary.finalSubmittedItemCount}`,
    `업로드 후 오류 처리된 자료 수: ${summary.failedItemCount}`,
    `분석 중 자료 수: ${summary.processingItemCount}`,
    `미제출 자료 수: ${summary.missingItemCount}`,
    `최근 자료요청:\n${recentRequests || "없음"}`,
    `최근 오류 자료:\n${failedItems || "없음"}`,
  ].join("\n");
};

const buildCustomerAnalysisFallback = (customer) => {
  const primaryContact = getPrimaryContact(customer);
  const industry = [customer.businessType, customer.businessItem].filter(Boolean).join(" / ") || "업종 정보 미입력";
  const contactText = primaryContact ? `${primaryContact.name} ${primaryContact.title || ""}`.trim() : "대표 담당자 미등록";
  const summary = getCustomerSubmissionSummary(customer);
  const submissionText = summary.requestedItemCount
    ? `현재 요청 자료 **${summary.requestedItemCount}건** 중 검수 통과 또는 최종 접수된 자료는 **${summary.acceptedItemCount}건**이고, 오류 처리된 자료는 **${summary.failedItemCount}건**, 미제출 자료는 **${summary.missingItemCount}건**입니다.`
    : "아직 연결된 자료제출 요청 이력은 없습니다.";
  return `**${customer.company}**는 **${industry}** 고객사입니다. 사업자등록번호, 대표자명, 업태와 업종을 기준으로 고객사 기본정보가 관리되고 있습니다. 현재 등록된 담당자는 **${customer.contacts.length}명**이며, 주요 연락 창구는 **${contactText}**입니다. ${submissionText} 자료요청을 발송하거나 재요청할 때는 제출 성공 이력과 오류 이력을 함께 보면서 필요한 자료만 좁혀 안내하는 것이 좋습니다.`;
};

const buildCustomerAnalysisPrompt = (customer, retryCount) => {
  const primaryContact = getPrimaryContact(customer);
  const contacts = customer.contacts
    .map((contact) => `${contact.name || "이름 미입력"} / ${contact.title || "직급 미입력"} / ${contact.phone || "연락처 미입력"} / ${contact.email || "이메일 미입력"}`)
    .join("\n");
  const retryInstruction = retryCount
    ? "\n이전 답변에는 금지된 문자나 형식 문제가 있었습니다. 일본어, 중국어, 한자를 절대 쓰지 말고 한국어 문장만 반환하세요."
    : "";

  return [
    "회계법인 내부 고객사 관리 화면에 표시할 AI 고객사 분석을 한국어로 작성하세요.",
    "5~7문장으로 작성하세요.",
    "회계사가 고객사를 빠르게 파악할 수 있도록 기본정보, 담당자 상태, 자료요청 관점, 잠재 리스크, 다음 확인 포인트를 요약하세요.",
    "아래 제출 현황 DB 요약을 반드시 참고해 현재 제출된 자료, 업로드 후 오류 처리된 자료, 미제출 자료를 자연스럽게 언급하세요.",
    "오류 자료가 있으면 고객 탓처럼 쓰지 말고 재요청 또는 확인이 필요한 자료로 부드럽게 표현하세요.",
    "너무 단정적인 판단은 피하고, 현재 입력된 정보 기준의 관리 참고사항처럼 작성하세요.",
    "표, 번호 목록은 쓰지 마세요.",
    "중요하다고 판단한 핵심 표현 2~4개만 **강조**로 감싸세요.",
    "강조는 고객사명, 업종, 담당자 상태, 리스크, 다음 액션 중 실제로 중요한 내용에만 사용하세요.",
    "강조 외의 마크다운은 쓰지 마세요.",
    "일본어, 중국어, 한자를 섞지 마세요.",
    `고객사명: ${customer.company}`,
    `사업자등록번호: ${customer.businessNumber || "미입력"}`,
    `대표자명: ${customer.ceoName || "미입력"}`,
    `업태: ${customer.businessType || "미입력"}`,
    `업종: ${customer.businessItem || "미입력"}`,
    `사업장 주소: ${customer.address || "미입력"}`,
    `기존 메모: ${customer.memo || "없음"}`,
    `대표 담당자: ${primaryContact ? `${primaryContact.name} / ${primaryContact.title || "직급 미입력"}` : "없음"}`,
    `담당자 목록:\n${contacts || "없음"}`,
    `제출 현황 DB 요약:\n${formatSubmissionSummaryForPrompt(customer)}`,
    retryInstruction,
  ].join("\n");
};

const requestQwenCustomerAnalysis = async (customer, retryCount, signal) => {
  const response = await fetch(qwenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: qwenModel,
      stream: false,
      temperature: 0.55,
      max_tokens: 520,
      enable_thinking: false,
      chat_template_kwargs: {
        enable_thinking: false,
      },
      messages: [
        {
          role: "system",
          content: "당신은 한국 회계법인 내부 고객사 관리 화면에 들어갈 짧은 분석문을 작성합니다. 최종 문장만 반환합니다.",
        },
        {
          role: "user",
          content: buildCustomerAnalysisPrompt(customer, retryCount),
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Qwen request failed: ${response.status}`);
  }

  return normalizeAiAnalysis(extractQwenMessage(await response.json()));
};

const getQwenCustomerAnalysis = async (customer, signal) => {
  for (let retryCount = 0; retryCount < 2; retryCount += 1) {
    const message = await requestQwenCustomerAnalysis(customer, retryCount, signal);
    if (message && !hasJapaneseOrChineseCharacters(message)) return message;
  }

  throw new Error("Qwen returned an invalid customer analysis.");
};

const createDraftCustomer = (index, values = {}) => ({
  id: `new-customer-${Date.now()}`,
  company: values.company || `신규 고객사 ${index}`,
  businessNumber: values.businessNumber || "",
  ceoName: values.ceoName || "",
  businessType: values.businessType || "",
  businessItem: values.businessItem || "",
  address: values.address || "",
  memo: values.memo || "",
  contacts: [],
});

const createDraftContact = (index, values = {}, shouldBePrimary = false) => ({
  id: `contact-${Date.now()}-${index}`,
  name: values.name || "",
  title: values.title || "",
  phone: values.phone || "",
  email: values.email || "",
  primary: shouldBePrimary,
});

const getPrimaryContact = (customer) => customer.contacts.find((contact) => contact.primary) || customer.contacts[0];

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
};

const fetchCustomersFromApi = async () => {
  const payload = await requestJson(customersEndpoint);
  return Array.isArray(payload.customers) ? payload.customers : [];
};

const createCustomerFromApi = async (values) => {
  const payload = await requestJson(customersEndpoint, {
    method: "POST",
    body: JSON.stringify(values),
  });
  return payload.customer;
};

const parseBusinessLicenseFromApi = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(businessLicenseParseEndpoint, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
};

const updateCustomerFromApi = async (customerId, values) => {
  const payload = await requestJson(`${customersEndpoint}/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
  return payload.customer;
};

const deleteCustomerFromApi = async (customerId) => {
  await requestJson(`${customersEndpoint}/${encodeURIComponent(customerId)}`, {
    method: "DELETE",
  });
};

const createContactFromApi = async (customerId, values) => {
  const payload = await requestJson(`${customersEndpoint}/${encodeURIComponent(customerId)}/contacts`, {
    method: "POST",
    body: JSON.stringify(values),
  });
  return payload.contact;
};

const deleteContactsFromApi = async (customerId, contactIds) => {
  const payload = await requestJson(`${customersEndpoint}/${encodeURIComponent(customerId)}/contacts`, {
    method: "DELETE",
    body: JSON.stringify({ contactIds }),
  });
  return Array.isArray(payload.contacts) ? payload.contacts : [];
};

const saveCustomerAiAnalysisToApi = async (customer, analysisText) =>
  requestJson(`${customersEndpoint}/${encodeURIComponent(customer.id)}/ai-analysis`, {
    method: "PUT",
    body: JSON.stringify({
      analysisText,
      modelName: qwenModel,
      sourceSnapshot: buildCustomerAnalysisSourceSnapshot(customer),
    }),
  });

const renderSummaryCards = () => `
  <section class="grid gap-3 md:grid-cols-3" aria-label="고객사 요약">
    ${accountantCustomerManagementContent.summary
      .map(
        (item) => `
          <article class="${cx(componentClasses.surface, "p-4")}">
            <p class="text-xs font-semibold text-[#616161]">${escapeHtml(item.label)}</p>
            <div class="mt-2 flex items-end justify-between gap-3">
              <strong class="text-3xl font-semibold text-[#242424]">${escapeHtml(item.value)}</strong>
              <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-[#f7fbff] px-3 text-sm text-[#043873]")}">${escapeHtml(item.helper)}</span>
            </div>
          </article>
        `,
      )
      .join("")}
  </section>
`;

const renderCustomerRows = (customers, selectedId) =>
  customers
    .map((customer) => {
      const primaryContact = getPrimaryContact(customer);
      return `
        <tr class="${cx(
          "cursor-pointer bg-white transition-colors hover:bg-[#f7fbff]",
          customer.id === selectedId ? "bg-[#eef6ff]" : "",
        )}" data-customer-row="${escapeHtml(customer.id)}">
          <td class="px-2 py-3 align-middle">
            <div class="flex min-w-0 items-center gap-1.5">
              <button class="min-w-0 truncate text-left font-semibold text-[#2a2a2a]" type="button" data-select-customer="${escapeHtml(customer.id)}">
                ${escapeHtml(customer.company)}
              </button>
              <span class="${cx(
                componentClasses.pill,
                "w-[50px] shrink-0 border border-[#dbe8f6] bg-[#f7fbff] px-2 py-0.5 text-[11px] text-[#043873]",
                customer.id === selectedId ? "" : "invisible",
              )}" ${customer.id === selectedId ? "" : `aria-hidden="true"`}>${customer.id === selectedId ? "선택됨" : ""}</span>
            </div>
          </td>
          <td class="px-2 py-3 align-middle text-[#616161]">
            <span class="font-semibold text-[#2a2a2a]">${escapeHtml(primaryContact?.name || "미입력")}</span>
            <span class="ml-1 text-xs">${escapeHtml(primaryContact?.title || "")}</span>
          </td>
          <td class="px-2 py-3 align-middle font-semibold text-[#2a2a2a]">${escapeHtml(customer.contacts.length)}명</td>
        </tr>
      `;
    })
    .join("");

const renderContactRows = (contacts, selectedContactIds = new Set()) =>
  contacts.length
    ? contacts
        .map(
          (contact) => `
            <tr class="bg-white hover:bg-[#f7fbff]">
              <td class="px-2 py-3 align-middle text-center">
                <input class="h-4 w-4 rounded border-[#8a8886] accent-[#4f9cf9]" type="checkbox" data-select-contact="${escapeHtml(contact.id)}" aria-label="${escapeHtml(contact.name || "담당자")} 선택" ${selectedContactIds.has(contact.id) ? "checked" : ""}>
              </td>
              <td class="px-2 py-3 align-middle">
                <div class="flex min-w-0 items-center gap-1.5">
                  <span class="min-w-0 truncate font-semibold text-[#2a2a2a]">${escapeHtml(contact.name || "미입력")}</span>
                  <span class="${cx(
                    componentClasses.pill,
                    "w-[38px] shrink-0 border border-[#dbe8f6] bg-[#f7fbff] px-2 py-0.5 text-[11px] text-[#043873]",
                    contact.primary ? "" : "invisible",
                  )}" ${contact.primary ? "" : `aria-hidden="true"`}>${contact.primary ? "대표" : ""}</span>
                </div>
              </td>
              <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(contact.title || "-")}</td>
              <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(contact.phone || "-")}</td>
              <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(contact.email || "-")}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td class="px-2 py-6 text-center text-xs text-[#717171]" colspan="5">등록된 담당자가 없습니다.</td></tr>`;

const renderEmptyCustomerEditor = () => `
  <section class="${cx(componentClasses.surface, "flex h-full min-h-0 items-center justify-center overflow-hidden p-8 text-center")}" aria-label="고객사 없음">
    <div>
      <h3 class="text-base font-semibold text-[#2a2a2a]">등록된 고객사가 없습니다.</h3>
      <p class="mt-2 text-sm leading-6 text-[#717171]">신규 고객사 추가 버튼으로 고객사를 등록해 주세요.</p>
    </div>
  </section>
`;

const renderCustomerEditor = (selectedCustomer, isDirty = false, saveMessageVisible = false, selectedContactIds = new Set()) => `
  <section class="${cx(componentClasses.surface, "flex h-full min-h-0 flex-col overflow-hidden")}" aria-labelledby="customer-editor-title">
    <div class="flex min-h-[73px] items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] p-4">
      <div>
        <h3 id="customer-editor-title" class="text-base font-semibold text-[#2a2a2a]">${escapeHtml(selectedCustomer.company)}</h3>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="${cx("text-xs font-semibold text-[#107c10]", saveMessageVisible ? "" : "invisible")}" data-save-customer-message>저장되었습니다.</span>
        <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-save-customer ${isDirty ? "" : "disabled"}>저장</button>
        <button class="${getButtonClass({ variant: "secondary", size: "md" })} border-[#f1b8be] text-[#a4262c] hover:bg-[#fff4f5]" type="button" data-open-delete-customer-dialog>고객사 삭제</button>
      </div>
    </div>

    <div class="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-4">
      <div class="grid gap-3 md:grid-cols-2">
        <label>
          <span class="${fieldLabelClass}">고객사명</span>
          <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedCustomer.company)}" data-customer-field="company">
        </label>
        <label>
          <span class="${fieldLabelClass}">사업자등록번호</span>
          <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedCustomer.businessNumber || "")}" data-customer-field="businessNumber">
        </label>
        <label>
          <span class="${fieldLabelClass}">대표자명</span>
          <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedCustomer.ceoName || "")}" data-customer-field="ceoName">
        </label>
        <label>
          <span class="${fieldLabelClass}">업태</span>
          <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedCustomer.businessType || "")}" data-customer-field="businessType">
        </label>
        <label>
          <span class="${fieldLabelClass}">업종</span>
          <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedCustomer.businessItem || "")}" data-customer-field="businessItem">
        </label>
        <label>
          <span class="${fieldLabelClass}">사업장 주소</span>
          <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedCustomer.address || "")}" data-customer-field="address">
        </label>
        <label class="md:col-span-2">
          <span class="${fieldLabelClass}">AI 고객사 분석</span>
          <div class="mt-1 min-h-32 w-full rounded-md border border-[#d1d1d1] bg-[#f7fbff] px-3 py-2 text-sm leading-6 text-[#242424] focus-within:border-[#6264a7] focus-within:ring-2 focus-within:ring-[#6264a7]/20" role="textbox" aria-label="AI 고객사 분석" aria-readonly="true" tabindex="0" data-ai-customer-analysis data-customer-id="${escapeHtml(selectedCustomer.id)}">
            <div class="grid gap-2 py-1" data-ai-analysis-skeleton aria-hidden="true">
              <span class="h-3 w-11/12 animate-pulse rounded-full bg-gradient-to-r from-[#dbe8f6] via-white to-[#dbe8f6] bg-[length:200%_100%]"></span>
              <span class="h-3 w-4/5 animate-pulse rounded-full bg-gradient-to-r from-[#dbe8f6] via-white to-[#dbe8f6] bg-[length:200%_100%] [animation-delay:120ms]"></span>
              <span class="h-3 w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[#dbe8f6] via-white to-[#dbe8f6] bg-[length:200%_100%] [animation-delay:240ms]"></span>
            </div>
          </div>
        </label>
      </div>

      <section class="overflow-hidden rounded-lg border border-[#e6e6e6]" aria-labelledby="contacts-title">
        <div class="flex min-h-[73px] flex-col gap-3 border-b border-[#e6e6e6] bg-[#fafafa] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 id="contacts-title" class="text-base font-semibold text-[#2a2a2a]">담당자 목록</h4>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-open-add-contact>담당자 추가</button>
            <button class="${getButtonClass({ variant: "secondary", size: "md" })} border-[#f1b8be] text-[#a4262c] hover:bg-[#fff4f5]" type="button" data-open-delete-contact-dialog ${selectedContactIds.size ? "" : "disabled"}>담당자 삭제</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            <thead class="bg-[#fafafa] text-xs font-semibold text-[#616161]">
              <tr class="border-b border-[#e6e6e6]">
                <th class="w-[48px] px-2 py-2 text-center">선택</th>
                <th class="w-[24%] px-2 py-2">이름</th>
                <th class="w-[16%] px-2 py-2">직급</th>
                <th class="w-[23%] px-2 py-2">연락처</th>
                <th class="px-2 py-2">이메일</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#e6e6e6]">
              ${renderContactRows(selectedCustomer.contacts, selectedContactIds)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
`;

const renderAddCustomerDialog = ({ isOpen }) => {
  if (!isOpen) return "";

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5" data-add-customer-dialog aria-hidden="false">
      <section class="max-h-[calc(100vh-40px)] w-full max-w-[640px] overflow-y-auto rounded-lg border border-[#dde6f0] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="add-customer-title">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold text-[#717171]">신규 고객사 추가</p>
            <h3 id="add-customer-title" class="mt-1 text-lg font-semibold text-[#242424]">고객사 정보를 입력해 주세요</h3>
          </div>
          <button class="${componentClasses.iconButton}" type="button" data-close-add-customer aria-label="신규 고객사 추가 닫기">
            <span aria-hidden="true" class="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <label>
            <span class="${fieldLabelClass}">고객사명 <span class="text-[#a4262c]" aria-hidden="true">*</span></span>
            <input class="${inputClass} mt-1" type="text" data-new-customer-field="company" aria-required="true" placeholder="예: 고객사명">
          </label>
          <label>
            <span class="${fieldLabelClass}">사업자등록번호</span>
            <input class="${inputClass} mt-1" type="text" data-new-customer-field="businessNumber" placeholder="예: 123-45-67890">
          </label>
          <label>
            <span class="${fieldLabelClass}">대표자명</span>
            <input class="${inputClass} mt-1" type="text" data-new-customer-field="ceoName" placeholder="예: 김샘플">
          </label>
          <label>
            <span class="${fieldLabelClass}">업태</span>
            <input class="${inputClass} mt-1" type="text" data-new-customer-field="businessType" placeholder="예: 정보통신업">
          </label>
          <label>
            <span class="${fieldLabelClass}">업종</span>
            <input class="${inputClass} mt-1" type="text" data-new-customer-field="businessItem" placeholder="예: 소프트웨어 개발 및 공급업">
          </label>
          <label>
            <span class="${fieldLabelClass}">사업장 주소</span>
            <input class="${inputClass} mt-1" type="text" data-new-customer-field="address" placeholder="예: 서울특별시 강남구 테헤란로 123">
          </label>
          <label class="md:col-span-2">
            <span class="${fieldLabelClass}">메모</span>
            <textarea class="min-h-24 w-full resize-y rounded-md border border-[#d1d1d1] bg-white px-3 py-2 text-sm leading-6 text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20 mt-1" data-new-customer-field="memo" placeholder="선택 입력"></textarea>
          </label>
        </div>
        <div class="mt-4 border-t border-[#e6e6e6] pt-4">
          <label class="block">
            <span class="${fieldLabelClass}">사업자등록증 업로드</span>
            <label class="${cx(getButtonClass({ variant: "secondary", size: "md" }), "mt-1 flex cursor-pointer items-center gap-2")}">
              <span class="text-[#4f9cf9]">
                <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M17 8 12 3 7 8" />
                  <path d="M12 3v12" />
                </svg>
              </span>
              <span class="text-sm">파일 선택</span>
              <input class="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp" data-upload-business-license>
            </label>
            <p class="mt-2 text-xs text-[#717171]">PDF, JPG, PNG, HEIF, WEBP 파일을 업로드하면 입력란에 자동으로 채웁니다.</p>
            <p class="mt-2 hidden text-xs font-semibold text-[#0f6cbd]" data-business-license-status></p>
          </label>
        </div>
        <p class="mt-3 hidden text-sm font-semibold text-[#a4262c]" data-new-customer-error>고객사명을 입력해 주세요.</p>
        <div class="mt-5 flex justify-end gap-2">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-add-customer>취소</button>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-save-new-customer>추가</button>
        </div>
      </section>
    </div>
  `;
};

const renderAddContactDialog = ({ isOpen, selectedCustomer }) => {
  if (!isOpen) return "";

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5" data-add-contact-dialog aria-hidden="false">
      <section class="w-full max-w-[560px] rounded-lg border border-[#dde6f0] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="add-contact-title">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold text-[#717171]">${escapeHtml(selectedCustomer.company)}</p>
            <h3 id="add-contact-title" class="mt-1 text-lg font-semibold text-[#242424]">담당자 추가</h3>
          </div>
          <button class="${componentClasses.iconButton}" type="button" data-close-add-contact aria-label="담당자 추가 닫기">
            <span aria-hidden="true" class="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <label>
            <span class="${fieldLabelClass}">이름 <span class="text-[#a4262c]" aria-hidden="true">*</span></span>
            <input class="${inputClass} mt-1" type="text" data-new-contact-field="name" aria-required="true" required placeholder="예: 홍길동">
          </label>
          <label>
            <span class="${fieldLabelClass}">직급</span>
            <input class="${inputClass} mt-1" type="text" data-new-contact-field="title" placeholder="예: 재무팀장">
          </label>
          <label>
            <span class="${fieldLabelClass}">연락처 <span class="text-[#a4262c]" aria-hidden="true">*</span></span>
            <input class="${inputClass} mt-1" type="tel" data-new-contact-field="phone" aria-required="true" required placeholder="010-0000-0000">
          </label>
          <label>
            <span class="${fieldLabelClass}">이메일 <span class="text-[#a4262c]" aria-hidden="true">*</span></span>
            <input class="${inputClass} mt-1" type="email" data-new-contact-field="email" aria-required="true" required placeholder="finance@example.com">
          </label>
        </div>
        <p class="mt-3 hidden text-sm font-semibold text-[#a4262c]" data-new-contact-error>이름, 연락처, 이메일을 입력해 주세요.</p>
        <div class="mt-5 flex justify-end gap-2">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-add-contact>취소</button>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-save-new-contact>추가</button>
        </div>
      </section>
    </div>
  `;
};

const renderDeleteCustomerDialog = ({ step, selectedCustomer }) => {
  const isOpen = step > 0;
  if (!isOpen) return "";

  const isFinalStep = step === 2;
  const title = isFinalStep ? "정말 삭제하시겠습니까?" : "고객사를 삭제할까요?";
  const description = isFinalStep
    ? "이 작업은 두 번 다시 되돌릴 수 없습니다. 삭제 후에는 고객사 정보와 담당자 목록을 복구할 수 없습니다."
    : `${selectedCustomer.company}의 기본정보와 담당자 목록이 삭제 대상에 포함됩니다.`;
  const actionLabel = isFinalStep ? "영구 삭제" : "계속";
  const actionAttribute = isFinalStep ? "data-confirm-delete-customer" : "data-continue-delete-customer";

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5" data-delete-customer-dialog aria-hidden="false">
      <section class="w-full max-w-[420px] rounded-lg border border-[#dde6f0] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="delete-customer-title">
        <div>
          <p class="text-xs font-semibold text-[#a4262c]">고객사 삭제</p>
          <h3 id="delete-customer-title" class="mt-1 text-lg font-semibold text-[#242424]">${escapeHtml(title)}</h3>
          <p class="mt-3 text-sm leading-6 text-[#616161]">${escapeHtml(description)}</p>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-delete-customer>취소</button>
          <button class="${getButtonClass({ variant: "secondary", size: "md" })} border-[#f1b8be] text-[#a4262c] hover:bg-[#fff4f5]" type="button" ${actionAttribute}>${escapeHtml(actionLabel)}</button>
        </div>
      </section>
    </div>
  `;
};

const renderDeleteContactDialog = ({ isOpen, selectedCustomer, selectedContactIds }) => {
  if (!isOpen || !selectedCustomer) return "";

  const selectedContacts = selectedCustomer.contacts.filter((contact) => selectedContactIds.has(contact.id));
  const names = selectedContacts.map((contact) => contact.name || "이름 미입력").join(", ");

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5" data-delete-contact-dialog aria-hidden="false">
      <section class="w-full max-w-[460px] rounded-lg border border-[#dde6f0] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="delete-contact-title">
        <div>
          <p class="text-xs font-semibold text-[#a4262c]">담당자 삭제</p>
          <h3 id="delete-contact-title" class="mt-1 text-lg font-semibold text-[#242424]">선택한 담당자를 삭제할까요?</h3>
          <p class="mt-3 text-sm leading-6 text-[#616161]">
            ${escapeHtml(names || `${selectedContactIds.size}명`)} 담당자 정보가 삭제됩니다. 이 작업은 두 번 다시 되돌릴 수 없습니다.
          </p>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-delete-contact>취소</button>
          <button class="${getButtonClass({ variant: "secondary", size: "md" })} border-[#f1b8be] text-[#a4262c] hover:bg-[#fff4f5]" type="button" data-confirm-delete-contact>삭제</button>
        </div>
      </section>
    </div>
  `;
};

const renderCustomerManagementBody = (customers, selectedId, dialogs = {}, dirtyCustomerIds = new Set(), saveMessageVisible = false) => {
  const selectedCustomer = customers.find((customer) => customer.id === selectedId) || customers[0];
  const isDirty = selectedCustomer ? dirtyCustomerIds.has(selectedCustomer.id) : false;
  const selectedContactIds = dialogs.selectedContactIds || new Set();

  return `
    <section class="grid min-h-[calc(100vh-130px)] items-stretch gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section class="${cx(componentClasses.surface, "flex h-full min-h-0 flex-col overflow-hidden")}" aria-labelledby="customer-management-title">
        <div class="flex min-h-[73px] items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] p-4">
          <div class="flex items-center gap-2">
            <h3 id="customer-management-title" class="text-base font-semibold text-[#2a2a2a]">고객사 목록</h3>
            <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-[#f7fbff] text-[#043873]")}">전체 ${escapeHtml(customers.length)}개사</span>
          </div>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-add-customer>신규 고객사 추가</button>
        </div>
        <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            <thead class="text-xs font-semibold text-[#616161]">
              <tr class="border-b border-[#e6e6e6]">
                <th class="w-[46%] px-2 py-2" role="columnheader">고객사</th>
                <th class="w-[34%] px-2 py-2" role="columnheader">대표 담당자</th>
                <th class="w-[20%] px-2 py-2" role="columnheader">담당자 수</th>
              </tr>
            </thead>
          </table>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            <tbody class="divide-y divide-[#e6e6e6]" data-customer-table-body>
              ${
                customers.length
                  ? renderCustomerRows(customers, selectedCustomer?.id)
                  : `<tr><td class="px-2 py-8 text-center text-xs text-[#717171]" colspan="3">등록된 고객사가 없습니다.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>

      <div class="min-h-0" data-customer-editor>
        ${selectedCustomer ? renderCustomerEditor(selectedCustomer, isDirty, saveMessageVisible, selectedContactIds) : renderEmptyCustomerEditor()}
      </div>
    </section>
    ${renderAddCustomerDialog({ isOpen: dialogs.addCustomerOpen })}
    ${selectedCustomer ? renderAddContactDialog({ isOpen: dialogs.addContactOpen, selectedCustomer }) : ""}
    ${selectedCustomer ? renderDeleteCustomerDialog({ step: dialogs.deleteCustomerStep || 0, selectedCustomer }) : ""}
    ${renderDeleteContactDialog({ isOpen: dialogs.deleteContactOpen, selectedCustomer, selectedContactIds })}
  `;
};

const attachCustomerManagementInteractions = (app, initialCustomers) => {
  let customers = structuredClone(initialCustomers);
  let selectedId = customers[0]?.id;
  let addCustomerOpen = false;
  let addContactOpen = false;
  let deleteCustomerStep = 0;
  let deleteContactOpen = false;
  let selectedContactIds = new Set();
  let dirtyCustomerIds = new Set();
  let saveMessageVisible = false;
  let saveMessageTimer;
  let customerAnalysisTimer;
  let customerAnalysisStreamingTimer;
  let customerAnalysisAbortController;
  const customerAnalysisCache = new Map();

  const selectedCustomer = () => customers.find((customer) => customer.id === selectedId) || customers[0];

  const rerenderWorkspace = () => {
    const main = app.querySelector("main");
    if (!main) return;
    main.innerHTML = renderCustomerManagementBody(
      customers,
      selectedId,
      {
        addCustomerOpen,
        addContactOpen,
        deleteCustomerStep,
        deleteContactOpen,
        selectedContactIds,
      },
      dirtyCustomerIds,
      saveMessageVisible,
    );
    bindWorkspaceEvents();
    bindCustomerAnalysis();
  };

  const updateSelectedCustomer = (field, value) => {
    const customer = selectedCustomer();
    if (!customer) return;
    customer[field] = value;
    customerAnalysisCache.delete(customer.id);
  };

  const streamCustomerAnalysis = (target, text) => {
    clearInterval(customerAnalysisStreamingTimer);
    target.innerHTML = "";
    let index = 0;
    const messageLength = getInlineMessageLength(text);
    if (!messageLength) return;
    customerAnalysisStreamingTimer = window.setInterval(() => {
      target.innerHTML = renderInlineMessageSegments(parseInlineMessageSegments(text), index + 1);
      index += 1;
      if (index >= messageLength) {
        clearInterval(customerAnalysisStreamingTimer);
        target.innerHTML = renderInlineMessage(text);
      }
    }, 12);
  };

  const bindCustomerAnalysis = () => {
    clearTimeout(customerAnalysisTimer);
    clearInterval(customerAnalysisStreamingTimer);
    customerAnalysisAbortController?.abort();

    const target = app.querySelector("[data-ai-customer-analysis]");
    const customer = selectedCustomer();
    if (!target || !customer) return;

    const currentSnapshot = buildCustomerAnalysisSourceSnapshot(customer);
    const cachedAnalysis = customerAnalysisCache.get(customer.id);
    if (cachedAnalysis && isSameSnapshot(cachedAnalysis.snapshot, currentSnapshot)) {
      target.innerHTML = renderInlineMessage(cachedAnalysis.text);
      return;
    }

    if (customer.aiAnalysis && isSameSnapshot(customer.aiAnalysisSourceSnapshot, currentSnapshot)) {
      customerAnalysisCache.set(customer.id, { snapshot: currentSnapshot, text: customer.aiAnalysis });
      target.innerHTML = renderInlineMessage(customer.aiAnalysis);
      return;
    }

    customerAnalysisAbortController = new AbortController();
    const signal = customerAnalysisAbortController.signal;

    customerAnalysisTimer = window.setTimeout(async () => {
      const timeoutController = new AbortController();
      const timeoutId = window.setTimeout(() => timeoutController.abort(), 25000);
      signal.addEventListener("abort", () => timeoutController.abort(), { once: true });

      try {
        const message = await getQwenCustomerAnalysis(customer, timeoutController.signal);
        clearTimeout(timeoutId);
        if (signal.aborted) return;
        customerAnalysisCache.set(customer.id, { snapshot: currentSnapshot, text: message });
        customer.aiAnalysis = message;
        customer.aiAnalysisSourceSnapshot = currentSnapshot;
        saveCustomerAiAnalysisToApi(customer, message).catch(() => {});
        streamCustomerAnalysis(target, message);
      } catch {
        clearTimeout(timeoutId);
        if (signal.aborted) return;
        const fallback = buildCustomerAnalysisFallback(customer);
        streamCustomerAnalysis(target, fallback);
      }
    }, 320);
  };

  function bindWorkspaceEvents() {
    app.querySelectorAll("[data-select-customer]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedId = button.dataset.selectCustomer;
        selectedContactIds = new Set();
        deleteContactOpen = false;
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-customer-row]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        selectedId = row.dataset.customerRow;
        selectedContactIds = new Set();
        deleteContactOpen = false;
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-add-customer]")?.addEventListener("click", () => {
      addCustomerOpen = true;
      addContactOpen = false;
      deleteCustomerStep = 0;
      rerenderWorkspace();
    });

    app.querySelector("[data-open-add-contact]")?.addEventListener("click", () => {
      addContactOpen = true;
      addCustomerOpen = false;
      deleteCustomerStep = 0;
      deleteContactOpen = false;
      rerenderWorkspace();
    });

    app.querySelectorAll("[data-select-contact]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const contactId = checkbox.dataset.selectContact;
        selectedContactIds = new Set(selectedContactIds);
        if (checkbox.checked) {
          selectedContactIds.add(contactId);
        } else {
          selectedContactIds.delete(contactId);
        }
        deleteContactOpen = false;
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-open-delete-contact-dialog]")?.addEventListener("click", () => {
      if (!selectedContactIds.size) return;
      addCustomerOpen = false;
      addContactOpen = false;
      deleteCustomerStep = 0;
      deleteContactOpen = true;
      rerenderWorkspace();
    });

    app.querySelector("[data-open-delete-customer-dialog]")?.addEventListener("click", () => {
      deleteCustomerStep = 1;
      addCustomerOpen = false;
      addContactOpen = false;
      deleteContactOpen = false;
      rerenderWorkspace();
    });

    app.querySelector("[data-save-customer]")?.addEventListener("click", () => {
      if (!dirtyCustomerIds.has(selectedId)) return;
      const customer = selectedCustomer();
      if (!customer) return;
      app.querySelector("[data-save-customer]")?.setAttribute("disabled", "");
      updateCustomerFromApi(customer.id, customer)
        .then((savedCustomer) => {
          customers = customers.map((item) => (item.id === savedCustomer.id ? savedCustomer : item));
          selectedId = savedCustomer.id;
          dirtyCustomerIds = new Set(dirtyCustomerIds);
          dirtyCustomerIds.delete(selectedId);
          customerAnalysisCache.delete(selectedId);
          saveMessageVisible = true;
          clearTimeout(saveMessageTimer);
          rerenderWorkspace();
          saveMessageTimer = window.setTimeout(() => {
            saveMessageVisible = false;
            rerenderWorkspace();
          }, 1800);
        })
        .catch(() => {
          dirtyCustomerIds = new Set(dirtyCustomerIds);
          dirtyCustomerIds.add(selectedId);
          saveMessageVisible = false;
          rerenderWorkspace();
        });
    });

    app.querySelectorAll("[data-close-add-customer]").forEach((button) =>
      button.addEventListener("click", () => {
        addCustomerOpen = false;
        rerenderWorkspace();
      }),
    );

    app.querySelector("[data-save-new-customer]")?.addEventListener("click", () => {
      const values = {};
      app.querySelectorAll("[data-new-customer-field]").forEach((field) => {
        values[field.dataset.newCustomerField] = field.value.trim();
      });
      const companyInput = app.querySelector("[data-new-customer-field='company']");
      const error = app.querySelector("[data-new-customer-error]");
      if (!values.company) {
        error?.classList.remove("hidden");
        companyInput?.focus();
        return;
      }
      createCustomerFromApi(values)
        .then((createdCustomer) => {
          customers = [createdCustomer, ...customers];
          selectedId = createdCustomer.id;
          addCustomerOpen = false;
          deleteCustomerStep = 0;
          deleteContactOpen = false;
          selectedContactIds = new Set();
          dirtyCustomerIds = new Set(dirtyCustomerIds);
          dirtyCustomerIds.delete(selectedId);
          rerenderWorkspace();
        })
        .catch((error) => {
          const errorMessage = app.querySelector("[data-new-customer-error]");
          if (errorMessage) {
            errorMessage.textContent = error.message || "고객사를 저장하지 못했습니다.";
            errorMessage.classList.remove("hidden");
          }
        });
    });

    app.querySelector("[data-upload-business-license]")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const status = app.querySelector("[data-business-license-status]");
      const saveButton = app.querySelector("[data-save-new-customer]");
      const setStatus = (message, tone = "info") => {
        if (!status) return;
        status.textContent = message;
        status.classList.remove("hidden", "text-[#a4262c]", "text-[#107c10]", "text-[#0f6cbd]");
        status.classList.add(tone === "danger" ? "text-[#a4262c]" : tone === "success" ? "text-[#107c10]" : "text-[#0f6cbd]");
      };

      setStatus("사업자등록증을 읽는 중입니다.");
      saveButton?.setAttribute("disabled", "");

      parseBusinessLicenseFromApi(file)
        .then((payload) => {
          const extracted = payload.extraction?.fields || {};
          if (payload.extraction?.isBusinessRegistrationCertificate) {
            Object.entries(extracted).forEach(([fieldName, value]) => {
              const input = app.querySelector(`[data-new-customer-field="${fieldName}"]`);
              if (input && value) input.value = value;
            });
          }
          const warnings = Array.isArray(payload.extraction?.warnings) ? payload.extraction.warnings : [];
          const message = payload.extraction?.isBusinessRegistrationCertificate
            ? "사업자등록증 내용을 입력란에 채웠습니다. 저장 전 내용을 확인해 주세요."
            : "사업자등록증 여부가 확실하지 않습니다. 입력된 내용을 직접 확인해 주세요.";
          setStatus(warnings.length ? `${message} ${warnings[0]}` : message, payload.extraction?.isBusinessRegistrationCertificate ? "success" : "danger");
        })
        .catch((error) => {
          setStatus(error.message || "사업자등록증을 읽지 못했습니다.", "danger");
        })
        .finally(() => {
          saveButton?.removeAttribute("disabled");
          event.target.value = "";
        });
    });

    app.querySelectorAll("[data-close-add-contact]").forEach((button) =>
      button.addEventListener("click", () => {
        addContactOpen = false;
        rerenderWorkspace();
      }),
    );

    app.querySelector("[data-save-new-contact]")?.addEventListener("click", () => {
      const customer = selectedCustomer();
      if (!customer) return;
      const values = {};
      app.querySelectorAll("[data-new-contact-field]").forEach((field) => {
        values[field.dataset.newContactField] = field.value.trim();
      });
      const missingRequiredFields = ["name", "phone", "email"].filter((fieldName) => !values[fieldName]);
      if (missingRequiredFields.length) {
        app.querySelector("[data-new-contact-error]")?.classList.remove("hidden");
        app.querySelector(`[data-new-contact-field="${missingRequiredFields[0]}"]`)?.focus();
        return;
      }
      createContactFromApi(customer.id, values)
        .then((createdContact) => {
          customer.contacts = [...customer.contacts, createdContact];
          selectedContactIds = new Set();
          customerAnalysisCache.delete(customer.id);
          addContactOpen = false;
          rerenderWorkspace();
        })
        .catch((error) => {
          const errorMessage = app.querySelector("[data-new-contact-error]");
          if (errorMessage) {
            errorMessage.textContent = error.message || "담당자를 저장하지 못했습니다.";
            errorMessage.classList.remove("hidden");
          }
        });
    });

    app.querySelectorAll("[data-close-delete-customer]").forEach((button) =>
      button.addEventListener("click", () => {
        deleteCustomerStep = 0;
        rerenderWorkspace();
      }),
    );

    app.querySelectorAll("[data-close-delete-contact]").forEach((button) =>
      button.addEventListener("click", () => {
        deleteContactOpen = false;
        rerenderWorkspace();
      }),
    );

    app.querySelector("[data-confirm-delete-contact]")?.addEventListener("click", () => {
      const customer = selectedCustomer();
      const ids = [...selectedContactIds];
      if (!customer || !ids.length) return;
      deleteContactsFromApi(customer.id, ids)
        .then((contacts) => {
          customer.contacts = contacts;
          selectedContactIds = new Set();
          deleteContactOpen = false;
          customerAnalysisCache.delete(customer.id);
          rerenderWorkspace();
        })
        .catch(() => {
          deleteContactOpen = false;
          rerenderWorkspace();
        });
    });

    app.querySelector("[data-continue-delete-customer]")?.addEventListener("click", () => {
      deleteCustomerStep = 2;
      rerenderWorkspace();
    });

    app.querySelector("[data-confirm-delete-customer]")?.addEventListener("click", () => {
      const currentId = selectedId;
      if (!currentId) return;
      deleteCustomerFromApi(currentId)
        .then(() => {
          customers = customers.filter((customer) => customer.id !== currentId);
          selectedId = customers[0]?.id;
          selectedContactIds = new Set();
          dirtyCustomerIds = new Set(dirtyCustomerIds);
          dirtyCustomerIds.delete(currentId);
          customerAnalysisCache.delete(currentId);
          deleteCustomerStep = 0;
          rerenderWorkspace();
        })
        .catch(() => {
          deleteCustomerStep = 0;
          rerenderWorkspace();
        });
    });

    app.querySelectorAll("[data-customer-field]").forEach((input) => {
      input.addEventListener("input", () => {
        saveMessageVisible = false;
        clearTimeout(saveMessageTimer);
        updateSelectedCustomer(input.dataset.customerField, input.value);
        dirtyCustomerIds = new Set(dirtyCustomerIds);
        dirtyCustomerIds.add(selectedId);
        app.querySelector("[data-save-customer]")?.removeAttribute("disabled");
        app.querySelector("[data-save-customer-message]")?.classList.add("invisible");
        if (input.dataset.customerField === "company") {
          const title = app.querySelector("#customer-editor-title");
          if (title) title.textContent = input.value || "신규 고객사";
        }
      });
    });
  }

  bindWorkspaceEvents();
  bindCustomerAnalysis();
};

export const renderAccountantCustomerManagement = (app) => {
  renderAccountantShell({
    app,
    activePage: "customers",
    eyebrow: "",
    title: "고객사 관리",
    bodyHtml: renderCustomerManagementBody(accountantCustomerManagementContent.customers, accountantCustomerManagementContent.customers[0]?.id),
    onReady: (shellRoot) => {
      const attach = (customers) => attachCustomerManagementInteractions(shellRoot, customers.length ? customers : accountantCustomerManagementContent.customers);
      fetchCustomersFromApi()
        .then((customers) => {
          const main = shellRoot.querySelector("main");
          if (main) {
            main.innerHTML = renderCustomerManagementBody(customers, customers[0]?.id);
          }
          attach(customers);
        })
        .catch(() => attach(accountantCustomerManagementContent.customers));
    },
  });
};
