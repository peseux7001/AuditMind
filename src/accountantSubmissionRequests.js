import { componentClasses, cx, escapeHtml, getButtonClass, renderAccountantShell } from "./accountantShell.js";
import documentTypeSeedSql from "../database/seeds/001_document_type_seed.sql?raw";
import requestTemplateSeedSql from "../database/seeds/003_request_template_seed.sql?raw";
import requestTemplateDocumentSeedSql from "../database/seeds/004_request_template_document_seed.sql?raw";

const fallbackRequestCustomers = [
  {
    id: "sample-tech",
    company: "샘플테크 주식회사",
    primaryContact: "최지훈",
    contactTitle: "CFO",
    contactPhone: "010-4567-8901",
    contactEmail: "finance@sampletech.kr",
    contacts: [
      {
        id: "sample-tech-contact-1",
        name: "최지훈",
        title: "CFO",
        phone: "010-4567-8901",
        email: "finance@sampletech.kr",
        primary: true,
      },
      {
        id: "sample-tech-contact-2",
        name: "한서윤",
        title: "회계팀장",
        phone: "010-2222-3333",
        email: "tax@sampletech.kr",
        primary: false,
      },
    ],
  },
  {
    id: "lumen-commerce",
    company: "루멘커머스",
    primaryContact: "이서연",
    contactTitle: "재무팀장",
    contactPhone: "010-3344-7812",
    contactEmail: "tax@lumencommerce.kr",
    contacts: [
      {
        id: "lumen-commerce-contact-1",
        name: "이서연",
        title: "재무팀장",
        phone: "010-3344-7812",
        email: "tax@lumencommerce.kr",
        primary: true,
      },
    ],
  },
  {
    id: "orbit-health",
    company: "오르빗헬스",
    primaryContact: "정다은",
    contactTitle: "운영매니저",
    contactPhone: "010-8877-1204",
    contactEmail: "ops@orbithealth.kr",
    contacts: [
      {
        id: "orbit-health-contact-1",
        name: "정다은",
        title: "운영매니저",
        phone: "010-8877-1204",
        email: "ops@orbithealth.kr",
        primary: true,
      },
    ],
  },
];

const parseSeedRows = (sql, withDescription = false) =>
  [...sql.matchAll(/\('([^']+)', '([^']+)', '([^']+)'(?:, '([^']+)')?, (\d+)\)/g)].map((match) =>
    withDescription
      ? {
          code: match[1],
          name: match[2],
          description: match[3],
          sortOrder: Number(match[5]),
        }
      : {
          categoryCode: match[1],
          code: match[2],
          name: match[3],
          sortOrder: Number(match[5]),
        },
  );

const extractSeedSection = (sql, startMarker, endMarker) => {
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start);
  if (start < 0 || end < 0) return "";
  return sql.slice(start, end);
};

const categoryRows = parseSeedRows(
  extractSeedSection(documentTypeSeedSql, "WITH category_seed", "INSERT INTO document_categories"),
  true,
);

const categoryNameByCode = new Map(categoryRows.map((category) => [category.code, category.name]));

let documentTypeRows = parseSeedRows(
  extractSeedSection(documentTypeSeedSql, "WITH document_seed", "INSERT INTO document_types"),
).map((document) => ({
  ...document,
  categoryName: categoryNameByCode.get(document.categoryCode) || document.categoryCode,
}));

let requestTemplateRows = [
  ...requestTemplateSeedSql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '([^']+)', (\d+)\)/g),
].map((match) => ({
  code: match[1],
  name: match[2],
  serviceArea: match[3],
  description: match[4],
  sortOrder: Number(match[5]),
}));

const parseQuotedList = (value) => [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]);

const profileRows = [
  ...requestTemplateDocumentSeedSql.matchAll(/\('([^']+)',\s*ARRAY\[(.*?)\],\s*ARRAY\[(.*?)\]\s*\)/gs),
].map((match) => ({
  code: match[1],
  requiredDocumentCodes: parseQuotedList(match[2]),
  optionalDocumentCodes: parseQuotedList(match[3]),
}));

const profileByCode = new Map(profileRows.map((profile) => [profile.code, profile]));

const templateProfileRows = [
  ...extractSeedSection(requestTemplateDocumentSeedSql, "template_profile", "required_expanded").matchAll(
    /\('([^']+)', '([^']+)'\)/g,
  ),
].map((match) => ({
  templateCode: match[1],
  profileCode: match[2],
}));

let templateDocumentCodesByTemplateCode = new Map(
  templateProfileRows.map(({ templateCode, profileCode }) => {
    const profile = profileByCode.get(profileCode);
    const documentCodes = profile ? [...profile.requiredDocumentCodes, ...profile.optionalDocumentCodes] : [];
    return [templateCode, documentCodes];
  }),
);

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했습니다.");
  return payload;
};

const normalizeRequestCustomers = (customers) =>
  customers.map((customer) => {
    const contacts = (customer.contacts || []).map((contact, index) => ({
      id: contact.id || `${customer.id}-contact-${index + 1}`,
      name: contact.name || "",
      title: contact.title || "",
      phone: contact.phone || "",
      email: contact.email || "",
      primary: Boolean(contact.primary),
    }));
    const primaryContact = contacts.find((contact) => contact.primary) || contacts[0] || {};
    return {
      id: customer.id,
      company: customer.company,
      primaryContact: primaryContact.name || "",
      contactTitle: primaryContact.title || "",
      contactPhone: primaryContact.phone || "",
      contactEmail: primaryContact.email || "",
      contacts,
    };
  });

const getCustomerContacts = (customer) => {
  if (customer.contacts?.length) return customer.contacts;
  return [
    {
      id: `${customer.id}-primary`,
      name: customer.primaryContact || "",
      title: customer.contactTitle || "",
      phone: customer.contactPhone || "",
      email: customer.contactEmail || "",
      primary: true,
    },
  ].filter((contact) => contact.name || contact.phone || contact.email);
};

const getPrimaryContactId = (customer) => {
  const contacts = getCustomerContacts(customer);
  return (contacts.find((contact) => contact.primary) || contacts[0])?.id || "";
};

const getContactIdsForCustomer = (customer) => new Set(getCustomerContacts(customer).map((contact) => contact.id));

const getSelectedRecipientCustomerIds = (customers, selectedRecipientIds) =>
  customers
    .filter((customer) => getCustomerContacts(customer).some((contact) => selectedRecipientIds.has(contact.id)))
    .map((customer) => customer.id);

const loadSubmissionRequestWorkspace = async () => {
  const [customerPayload, templatePayload] = await Promise.all([
    requestJson("/api/customers"),
    requestJson("/api/request-templates"),
  ]);

  const apiCustomers = normalizeRequestCustomers(customerPayload.customers || []);
  if (apiCustomers.length) {
    return {
      customers: apiCustomers,
      templates: templatePayload.templates || requestTemplateRows,
      documents: (templatePayload.documents || documentTypeRows).map((document) => ({
        ...document,
        categoryName: document.categoryName || "",
      })),
    };
  }

  return {
    customers: fallbackRequestCustomers,
    templates: requestTemplateRows,
    documents: documentTypeRows,
  };
};

const applyRequestTemplateWorkspace = ({ templates, documents }) => {
  requestTemplateRows = templates.length ? templates : requestTemplateRows;
  documentTypeRows = documents.length ? documents : documentTypeRows;
  templateDocumentCodesByTemplateCode = new Map(
    requestTemplateRows.map((template) => [template.code, template.documentCodes || templateDocumentCodesByTemplateCode.get(template.code) || []]),
  );
};

const getMappedDocumentCodes = (selectedTemplateCodes) =>
  new Set(
    [...selectedTemplateCodes].flatMap((templateCode) => templateDocumentCodesByTemplateCode.get(templateCode) || []),
  );

const getSelectedDocumentCodes = (selectedTemplateCodes, manualDocumentCodes, excludedDocumentCodes) => {
  const selectedDocumentCodes = getMappedDocumentCodes(selectedTemplateCodes);
  manualDocumentCodes.forEach((documentCode) => selectedDocumentCodes.add(documentCode));
  excludedDocumentCodes.forEach((documentCode) => selectedDocumentCodes.delete(documentCode));
  return selectedDocumentCodes;
};

const normalizeSearchText = (value) => value.trim().toLocaleLowerCase("ko-KR");

const matchesSearchText = (values, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearchText(String(value || "")).includes(normalizedQuery));
};

const requestCustomerColgroup = `
  <colgroup>
    <col class="w-14">
    <col class="w-[34%]">
    <col class="w-[22%]">
    <col class="w-[18%]">
    <col>
  </colgroup>
`;

const renderRequestRows = (customers, selectedCustomerIds) =>
  customers
    .map(
      (customer) => `
        <tr class="${cx(
          "cursor-pointer bg-white transition-colors hover:bg-[#f7fbff]",
          selectedCustomerIds.has(customer.id) ? "bg-[#eef6ff]" : "",
        )}" data-request-customer-row="${escapeHtml(customer.id)}">
          <td class="px-2 py-3 text-center align-middle">
            <input class="size-4 accent-[#4f9cf9]" type="checkbox" aria-label="${escapeHtml(customer.company)} 선택" data-select-request-customer="${escapeHtml(customer.id)}" ${selectedCustomerIds.has(customer.id) ? "checked" : ""}>
          </td>
          <td class="px-2 py-3 align-middle">
            <span class="block min-w-0 truncate text-left font-semibold text-[#2a2a2a]">
              ${escapeHtml(customer.company)}
            </span>
          </td>
          <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(customer.primaryContact || "-")}</td>
          <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(customer.contactTitle || "-")}</td>
          <td class="px-2 py-3 align-middle font-semibold tabular-nums text-[#616161]">${escapeHtml(customer.contactPhone || "-")}</td>
        </tr>
      `,
    )
    .join("");

const renderTemplateRows = (templates, selectedTemplateCodes) =>
  templates
    .map(
      (template) => `
        <tr class="scroll-mt-14 cursor-pointer bg-white hover:bg-[#f7fbff]" data-template-row="${escapeHtml(template.code)}">
          <td class="px-2 py-3 align-middle">
            <label class="flex min-w-0 items-center gap-2">
              <input class="size-4 shrink-0 accent-[#4f9cf9]" type="checkbox" data-request-template="${escapeHtml(template.code)}" ${selectedTemplateCodes.has(template.code) ? "checked" : ""}>
              <span class="min-w-0 truncate font-semibold text-[#2a2a2a]">${escapeHtml(template.name)}</span>
            </label>
          </td>
          <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(template.serviceArea)}</td>
          <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(template.description)}</td>
        </tr>
      `,
    )
    .join("");

const sortKorean = (a, b) => a.localeCompare(b, "ko-KR");

const renderDocumentRows = (documents, selectedDocumentCodes) => {
  const selectedDocs = documents.filter((doc) => selectedDocumentCodes.has(doc.code));
  const unselectedDocs = documents.filter((doc) => !selectedDocumentCodes.has(doc.code));

  selectedDocs.sort((a, b) => sortKorean(a.name, b.name));
  unselectedDocs.sort((a, b) => sortKorean(a.name, b.name));

  const renderRow = (document, isSelected) => `
    <tr class="scroll-mt-14 cursor-pointer ${isSelected ? "bg-[#eef6ff]" : "bg-white"} hover:bg-[#f7fbff]" data-document-row="${escapeHtml(document.code)}">
      <td class="px-2 py-3 align-middle">
        <label class="flex items-center gap-2">
          <input class="size-4 shrink-0 accent-[#4f9cf9]" type="checkbox" data-template-document="${escapeHtml(document.code)}" ${selectedDocumentCodes.has(document.code) ? "checked" : ""}>
          <span class="font-semibold ${isSelected ? "text-[#043873]" : "text-[#2a2a2a]"}">${escapeHtml(document.name)}</span>
        </label>
      </td>
    </tr>
  `;

  return selectedDocs.map((doc) => renderRow(doc, true)).join("") + unselectedDocs.map((doc) => renderRow(doc, false)).join("");
};

const renderAddDocumentRows = (documents, selectedDocumentCodes) =>
  documents
    .map(
      (document) => `
        <tr class="${cx(
          "cursor-pointer bg-white transition-colors hover:bg-[#f7fbff]",
          selectedDocumentCodes.has(document.code) ? "bg-[#eef6ff]" : "",
        )}" data-add-document-row="${escapeHtml(document.code)}">
          <td class="w-12 px-3 py-3 align-middle">
            <input class="size-4 accent-[#4f9cf9]" type="checkbox" data-add-document-checkbox="${escapeHtml(document.code)}" ${selectedDocumentCodes.has(document.code) ? "checked" : ""}>
          </td>
          <td class="px-3 py-3 align-middle">
            <span class="font-semibold text-[#2a2a2a]">${escapeHtml(document.name)}</span>
          </td>
          <td class="px-3 py-3 align-middle text-[#616161]">${escapeHtml(document.categoryName)}</td>
        </tr>
      `,
    )
    .join("");

const renderAddDocumentDialog = (documents, selectedDocumentCodes, addDocumentQuery, isOpen) => {
  if (!isOpen) return "";

  const filteredDocuments = documents.filter((document) =>
    matchesSearchText([document.name, document.categoryName], addDocumentQuery),
  );

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" role="presentation" data-add-document-dialog>
      <section class="flex max-h-[82vh] w-full max-w-[760px] flex-col overflow-hidden rounded-lg border border-[#dde6f0] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="add-document-dialog-title">
        <div class="flex items-center justify-between gap-4 border-b border-[#e6e6e6] bg-[#fafafa] px-5 py-4">
          <div>
            <h3 id="add-document-dialog-title" class="text-lg font-semibold text-[#2a2a2a]">요청자료 추가</h3>
            <p class="mt-1 text-xs font-medium text-[#616161]">서비스 기본자료 외에 이번 요청에 필요한 자료를 추가로 선택합니다.</p>
          </div>
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-add-document-dialog>닫기</button>
        </div>

        <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-5">
          <div class="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-2">
            <label class="sr-only" for="add-document-search">추가 요청자료 검색</label>
            <input id="add-document-search" class="h-10 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-sm font-medium text-[#2a2a2a] outline-none transition focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20" type="search" value="${escapeHtml(addDocumentQuery)}" placeholder="자료명 또는 분류 검색" data-add-document-search>
            <span class="${cx(componentClasses.pill, "justify-center border border-[#dbe8f6] bg-[#f7fbff] text-[#043873]")}">${escapeHtml(filteredDocuments.length)}개</span>
          </div>

          <div class="min-h-[320px] overflow-auto rounded-lg border border-[#e6e6e6]">
            <table class="w-full table-fixed border-collapse text-left text-xs">
              <thead class="sticky top-0 z-10 bg-[#fafafa] text-xs font-semibold text-[#616161]">
                <tr class="border-b border-[#e6e6e6]">
                  <th class="w-12 px-3 py-2">선택</th>
                  <th class="w-[48%] px-3 py-2">자료명</th>
                  <th class="px-3 py-2">분류</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#e6e6e6]">
                ${renderAddDocumentRows(filteredDocuments, selectedDocumentCodes)}
              </tbody>
            </table>
          </div>

          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-medium text-[#616161]">체크한 자료는 현재 자료제출 요청에만 추가됩니다. 서비스 자체는 변경되지 않습니다.</p>
            <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-close-add-document-dialog>완료</button>
          </div>
        </div>
      </section>
    </div>
  `;
};

const sendMethodLabels = {
  kakao: "카카오톡",
  email: "이메일",
  sms: "문자",
};

const renderSendRecipientRows = (customers, selectedRecipientIds) =>
  customers
    .map((customer) => {
      const contacts = getCustomerContacts(customer);
      return `
        <tr class="border-t border-[#e6e6e6] bg-[#f7fbff]">
          <td class="px-3 py-2 align-middle" colspan="5">
            <div class="flex items-center justify-between gap-3">
              <p class="font-semibold text-[#043873]">${escapeHtml(customer.company)}</p>
              <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-white text-[#043873]")}">${escapeHtml(contacts.filter((contact) => selectedRecipientIds.has(contact.id)).length)} / ${escapeHtml(contacts.length)}명</span>
            </div>
          </td>
        </tr>
        ${
          contacts.length
            ? contacts
                .map(
                  (contact) => `
                    <tr class="bg-white">
                      <td class="w-12 px-3 py-3 text-center align-middle">
                        <input class="size-4 accent-[#4f9cf9]" type="checkbox" aria-label="${escapeHtml(`${customer.company} ${contact.name || "담당자"} 발송 대상`)}" data-send-recipient="${escapeHtml(contact.id)}" ${selectedRecipientIds.has(contact.id) ? "checked" : ""}>
                      </td>
                      <td class="px-3 py-3 align-middle text-[#616161]">
                        <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-[#f7fbff] text-[#043873]")}">${contact.primary ? "대표 담당자" : "담당자"}</span>
                      </td>
                      <td class="px-3 py-3 align-middle font-semibold text-[#2a2a2a]">${escapeHtml(contact.name || "-")}</td>
                      <td class="px-3 py-3 align-middle text-[#616161]">${escapeHtml(contact.title || "-")}</td>
                      <td class="px-3 py-3 align-middle text-[#616161]">
                        <p class="font-semibold tabular-nums">${escapeHtml(contact.phone || "-")}</p>
                        <p class="mt-1 text-[11px]">${escapeHtml(contact.email || "-")}</p>
                      </td>
                    </tr>
                  `,
                )
                .join("")
            : `
              <tr class="bg-white">
                <td class="px-3 py-4 text-center text-[#a4262c]" colspan="5">등록된 담당자가 없어 발송할 수 없습니다.</td>
              </tr>
            `
        }
      `;
    })
    .join("");

const renderSendRequestDialog = ({
  isOpen,
  selectedCustomers,
  selectedTemplateCodes,
  selectedDocumentCodes,
  selectedRecipientIds,
  selectedSendMethods,
  sendResult,
  sendError,
  isSending,
  isSendConfirmDialogOpen,
}) => {
  if (!isOpen) return "";

  const selectedTemplates = requestTemplateRows.filter((template) => selectedTemplateCodes.has(template.code));
  const selectedRecipientCustomerIds = new Set(getSelectedRecipientCustomerIds(selectedCustomers, selectedRecipientIds));
  const canSend =
    selectedRecipientIds.size > 0 &&
    selectedRecipientCustomerIds.size === selectedCustomers.length &&
    selectedSendMethods.size > 0 &&
    selectedDocumentCodes.size > 0;
  const serviceNames = selectedTemplates.map((template) => template.name).join(", ") || "선택된 서비스 없음";

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" role="presentation" data-send-dialog>
      <section class="flex max-h-[86vh] w-full max-w-[860px] flex-col overflow-hidden rounded-lg border border-[#dde6f0] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="send-request-dialog-title">
        <div class="flex items-start justify-between gap-4 border-b border-[#e6e6e6] bg-[#fafafa] px-5 py-4">
          <div>
            <h3 id="send-request-dialog-title" class="text-lg font-semibold text-[#2a2a2a]">자료제출 요청을 발송할까요?</h3>
            <p class="mt-1 text-xs font-medium text-[#616161]">선택한 고객사 담당자에게 자료제출 포털 링크를 보냅니다.</p>
          </div>
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-send-dialog>닫기</button>
        </div>

        <div class="min-h-0 overflow-y-auto p-5">
          <div class="grid gap-3 md:grid-cols-3">
            <div class="rounded-lg border border-[#dde6f0] bg-[#f7fbff] p-3">
              <p class="text-xs font-semibold text-[#616161]">대상 고객사</p>
              <p class="mt-1 text-lg font-semibold text-[#043873]">${escapeHtml(selectedCustomers.length)}개사</p>
            </div>
            <div class="rounded-lg border border-[#dde6f0] bg-[#f7fbff] p-3">
              <p class="text-xs font-semibold text-[#616161]">서비스</p>
              <p class="mt-1 truncate text-sm font-semibold text-[#043873]" title="${escapeHtml(serviceNames)}">${escapeHtml(serviceNames)}</p>
            </div>
            <div class="rounded-lg border border-[#dde6f0] bg-[#f7fbff] p-3">
              <p class="text-xs font-semibold text-[#616161]">요청 자료</p>
              <p class="mt-1 text-lg font-semibold text-[#043873]">${escapeHtml(selectedDocumentCodes.size)}개</p>
            </div>
          </div>

          <section class="mt-4 rounded-lg border border-[#e6e6e6]" aria-labelledby="send-method-title">
            <div class="border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3">
              <h4 id="send-method-title" class="text-base font-semibold text-[#2a2a2a]">발송 방식</h4>
            </div>
            <div class="grid gap-2 p-4 sm:grid-cols-3">
              ${Object.entries(sendMethodLabels)
                .map(
                  ([method, label]) => `
                    <label class="${cx(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm font-semibold transition-colors",
                      selectedSendMethods.has(method)
                        ? "border-[#4f9cf9] bg-[#eef6ff] text-[#043873]"
                        : "border-[#d1d1d1] bg-white text-[#424242] hover:bg-[#fafafa]",
                    )}">
                      <input class="size-4 accent-[#4f9cf9]" type="checkbox" data-send-method="${escapeHtml(method)}" ${selectedSendMethods.has(method) ? "checked" : ""}>
                      <span>${escapeHtml(label)}</span>
                    </label>
                  `,
                )
                .join("")}
            </div>
          </section>

          <section class="mt-4 overflow-hidden rounded-lg border border-[#e6e6e6]" aria-labelledby="send-recipient-title">
            <div class="flex items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3">
              <h4 id="send-recipient-title" class="text-base font-semibold text-[#2a2a2a]">발송 대상</h4>
              <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-[#f7fbff] text-[#043873]")}">선택 ${escapeHtml(selectedRecipientIds.size)}명</span>
            </div>
            <div class="max-h-[280px] overflow-auto">
              <table class="w-full min-w-[680px] table-fixed border-collapse text-left text-xs">
                <thead class="sticky top-0 z-10 bg-[#fafafa] text-xs font-semibold text-[#616161]">
                  <tr class="border-b border-[#e6e6e6]">
                    <th class="w-12 px-3 py-2 text-center">선택</th>
                    <th class="w-[24%] px-3 py-2">구분</th>
                    <th class="w-[18%] px-3 py-2">이름</th>
                    <th class="w-[18%] px-3 py-2">직급</th>
                    <th class="px-3 py-2">연락처</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#e6e6e6]">
                  ${renderSendRecipientRows(selectedCustomers, selectedRecipientIds)}
                </tbody>
              </table>
            </div>
          </section>

          ${
            sendError
              ? `<div class="mt-4 rounded-lg border border-[#f1b8be] bg-[#fff4f5] p-4 text-sm font-semibold text-[#a4262c]">${escapeHtml(sendError)}</div>`
              : ""
          }

          ${
            sendResult?.requests?.length
              ? `
                <section class="mt-4 overflow-hidden rounded-lg border border-[#dbe8f6]" aria-label="생성된 자료제출 링크">
                  <div class="border-b border-[#dbe8f6] bg-[#f7fbff] px-4 py-3">
                    <h4 class="text-base font-semibold text-[#043873]">생성된 자료제출 링크</h4>
                  </div>
                  <div class="divide-y divide-[#e6e6e6] bg-white">
                    ${sendResult.requests
                      .map(
                        (request) => `
                          <div class="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div class="min-w-0">
                              <p class="font-semibold text-[#2a2a2a]">${escapeHtml(request.customerName)}</p>
                              <p class="mt-1 truncate text-xs text-[#616161]">${escapeHtml(request.requestTitle)} · 담당자 ${escapeHtml(request.recipientCount || 1)}명 · 요청자료 ${escapeHtml(request.documentCount)}개 · 마감 ${escapeHtml(request.dueDate)}</p>
                            </div>
                            <a class="${getButtonClass({ variant: "primary", size: "sm" })}" href="${escapeHtml(request.url)}" target="_blank" rel="noreferrer">자료제출 포털 미리보기</a>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }
        </div>

        <div class="flex justify-end gap-2 border-t border-[#e6e6e6] bg-[#fafafa] px-5 py-4">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-send-dialog>취소</button>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-open-send-confirm ${canSend && !isSending && !sendResult?.requests?.length ? "" : "disabled"}>${sendResult?.requests?.length ? "발송 완료" : isSending ? "생성 중" : "발송 확정"}</button>
        </div>
      </section>

      ${
        isSendConfirmDialogOpen
          ? `
            <section class="absolute z-10 w-full max-w-[420px] rounded-lg border border-[#dde6f0] bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="send-confirm-title">
              <h4 id="send-confirm-title" class="text-lg font-semibold text-[#2a2a2a]">고객에게 발송하시겠습니까?</h4>
              <p class="mt-3 text-sm leading-6 text-[#616161]">선택한 담당자에게 자료제출 포털 링크를 발송합니다.</p>
              <div class="mt-5 flex justify-end gap-2">
                <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-cancel-send-confirm>취소</button>
                <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-confirm-send-request ${isSending ? "disabled" : ""}>확인</button>
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
};

const renderSubmissionRequestsBody = (
  customers,
  selectedCustomerIds,
  selectedTemplateCodes = new Set(),
  selectedDocumentCodes = new Set(),
  customerQuery = "",
  templateQuery = "",
  documentQuery = "",
  addDocumentQuery = "",
  isAddDocumentDialogOpen = false,
  isSendDialogOpen = false,
  selectedRecipientIds = new Set(),
  selectedSendMethods = new Set(["kakao"]),
  sendResult = null,
  sendError = "",
  isSending = false,
  isSendConfirmDialogOpen = false,
) => {
  const filteredCustomers = customers.filter((customer) =>
    matchesSearchText([customer.company, customer.primaryContact, customer.contactTitle, customer.contactPhone], customerQuery),
  );
  const selectedCustomers = customers.filter((customer) => selectedCustomerIds.has(customer.id));
  const filteredTemplates = requestTemplateRows.filter((template) =>
    matchesSearchText([template.name, template.serviceArea, template.description], templateQuery),
  );
  const filteredDocuments = documentTypeRows.filter((document) =>
    matchesSearchText([document.name, document.categoryName], documentQuery),
  );

  return `
    <section class="grid items-stretch gap-4 overflow-visible xl:h-[calc(100vh-130px)] xl:min-h-[560px] xl:overflow-hidden xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section class="${cx(componentClasses.surface, "flex min-h-0 flex-col overflow-hidden xl:h-full")}" aria-labelledby="submission-request-list-title">
        <div class="flex min-h-[73px] items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] p-4">
          <div class="flex items-center gap-2">
            <h3 id="submission-request-list-title" class="text-base font-semibold text-[#2a2a2a]">고객사 선택</h3>
            <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-[#f7fbff] text-[#043873]")}">선택 ${escapeHtml(selectedCustomerIds.size)}개사</span>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_94px] items-center gap-2 md:w-[300px]">
            <label class="sr-only" for="request-customer-search">고객사 검색</label>
            <input id="request-customer-search" class="h-9 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-xs font-medium text-[#2a2a2a] outline-none transition focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20" type="search" value="${escapeHtml(customerQuery)}" placeholder="고객사 검색" data-request-customer-search>
            <span class="${cx(componentClasses.pill, "w-[94px] justify-center border border-[#dbe8f6] bg-[#f7fbff] px-2 text-[#043873]")}">${escapeHtml(filteredCustomers.length)} / ${escapeHtml(customers.length)}개</span>
          </div>
        </div>
        <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            ${requestCustomerColgroup}
            <thead class="text-xs font-semibold text-[#616161]">
              <tr class="border-b border-[#e6e6e6]">
                <th class="px-2 py-2 text-center" role="columnheader">선택</th>
                <th class="px-2 py-2" role="columnheader">고객사</th>
                <th class="px-2 py-2" role="columnheader">대표 담당자</th>
                <th class="px-2 py-2" role="columnheader">직급</th>
                <th class="px-2 py-2" role="columnheader">전화번호</th>
              </tr>
            </thead>
          </table>
        </div>
        <div class="min-h-0 max-h-[360px] overflow-y-auto xl:max-h-none xl:flex-1">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            ${requestCustomerColgroup}
            <tbody class="divide-y divide-[#e6e6e6]">
              ${renderRequestRows(filteredCustomers, selectedCustomerIds)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="${cx(componentClasses.surface, "flex min-h-0 flex-col overflow-hidden xl:h-full")}" aria-labelledby="template-title">
        <div class="flex min-h-[73px] items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] p-4">
          <div class="flex items-center gap-2">
            <h3 id="template-title" class="text-base font-semibold text-[#2a2a2a]">서비스</h3>
            <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-[#f7fbff] text-[#043873]")}">선택 ${escapeHtml(selectedTemplateCodes.size)}개</span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-send-submission-request>발송</button>
          </div>
        </div>

        <div class="grid min-h-0 gap-4 overflow-visible p-4 xl:flex-1 xl:grid-rows-[auto_minmax(0,1.05fr)_minmax(0,0.95fr)] xl:overflow-hidden">
          <div class="rounded-lg border border-[#dde6f0] bg-[#f7fbff] p-3">
            <p class="text-xs font-semibold text-[#616161]">선택된 고객사</p>
            <p class="mt-1 text-sm font-semibold text-[#043873]">${escapeHtml(selectedCustomers.map((customer) => customer.company).join(", ") || "선택된 고객사가 없습니다.")}</p>
          </div>

          <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#e6e6e6]" aria-labelledby="required-documents-title">
            <div class="grid min-h-[56px] grid-cols-1 items-center gap-3 border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)]">
              <h4 id="required-documents-title" class="text-base font-semibold text-[#2a2a2a]">서비스 선택</h4>
              <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_108px] items-center gap-2 justify-self-stretch md:max-w-[388px] md:justify-self-end">
                <label class="sr-only" for="template-search">서비스 검색</label>
                <input id="template-search" class="h-9 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-xs font-medium text-[#2a2a2a] outline-none transition focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20" type="search" value="${escapeHtml(templateQuery)}" placeholder="서비스 검색" data-template-search>
                <span class="${cx(componentClasses.pill, "w-[108px] justify-center border border-[#dbe8f6] bg-[#f7fbff] px-2 text-[#043873]")}">${escapeHtml(filteredTemplates.length)} / ${escapeHtml(requestTemplateRows.length)}개</span>
              </div>
            </div>
            <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
              <table class="w-full table-fixed border-collapse text-left text-xs">
                <thead class="bg-[#fafafa] text-xs font-semibold text-[#616161]">
                  <tr class="border-b border-[#e6e6e6]">
                    <th class="w-[32%] px-2 py-2" role="columnheader">서비스명</th>
                    <th class="w-[26%] px-2 py-2" role="columnheader">업무 영역</th>
                    <th class="w-[42%] px-2 py-2" role="columnheader">내용</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div class="min-h-0 max-h-[360px] scroll-pt-14 overflow-auto xl:max-h-none xl:flex-1">
              <table class="w-full table-fixed border-collapse text-left text-xs">
                <tbody class="divide-y divide-[#e6e6e6]">
                  ${renderTemplateRows(filteredTemplates, selectedTemplateCodes)}
                </tbody>
              </table>
            </div>
          </section>

          <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#e6e6e6]" aria-labelledby="selected-documents-title">
            <div class="grid min-h-[56px] grid-cols-1 items-center gap-3 border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)]">
              <h4 id="selected-documents-title" class="text-base font-semibold text-[#2a2a2a]">요청 자료</h4>
              <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_108px] items-center gap-2 justify-self-stretch md:max-w-[388px] md:justify-self-end">
                <label class="sr-only" for="document-search">요청 자료 검색</label>
                <input id="document-search" class="h-9 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-xs font-medium text-[#2a2a2a] outline-none transition focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20" type="search" value="${escapeHtml(documentQuery)}" placeholder="자료 검색" data-document-search>
                <span class="${cx(componentClasses.pill, "w-[108px] justify-center border border-[#dbe8f6] bg-[#f7fbff] px-2 text-[#043873]")}">선택 ${escapeHtml(selectedDocumentCodes.size)}개</span>
              </div>
            </div>
            <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
              <table class="w-full table-fixed border-collapse text-left text-xs">
                <thead class="bg-[#fafafa] text-xs font-semibold text-[#616161]">
                  <tr class="border-b border-[#e6e6e6]">
                    <th class="px-2 py-2" role="columnheader">자료명</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div class="min-h-0 max-h-[360px] scroll-pt-14 overflow-auto xl:max-h-none xl:flex-1">
              <table class="w-full table-fixed border-collapse text-left text-xs">
                <tbody class="divide-y divide-[#e6e6e6]">
                  ${renderDocumentRows(filteredDocuments, selectedDocumentCodes)}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </section>
    ${renderAddDocumentDialog(documentTypeRows, selectedDocumentCodes, addDocumentQuery, isAddDocumentDialogOpen)}
    ${renderSendRequestDialog({
      isOpen: isSendDialogOpen,
      selectedCustomers,
      selectedTemplateCodes,
      selectedDocumentCodes,
      selectedRecipientIds,
      selectedSendMethods,
      sendResult,
      sendError,
      isSending,
      isSendConfirmDialogOpen,
    })}
  `;
};

const attachSubmissionRequestInteractions = (app, initialCustomers) => {
  let customers = structuredClone(initialCustomers);
  let selectedCustomerIds = new Set([customers[0]?.id].filter(Boolean));
  let selectedTemplateCodes = new Set();
  let manualDocumentCodes = new Set();
  let excludedDocumentCodes = new Set();
  let customerQuery = "";
  let templateQuery = "";
  let documentQuery = "";
  let addDocumentQuery = "";
  let isAddDocumentDialogOpen = false;
  let isSendDialogOpen = false;
  let selectedRecipientIds = new Set(customers.slice(0, 1).map((customer) => getPrimaryContactId(customer)).filter(Boolean));
  let selectedSendMethods = new Set(["kakao"]);
  let sendResult = null;
  let sendError = "";
  let isSending = false;
  let isSendConfirmDialogOpen = false;

  const rerenderWorkspace = ({ focusSelector, cursorPosition } = {}) => {
    const main = app.querySelector("main");
    if (!main) return;
    const selectedDocumentCodes = getSelectedDocumentCodes(selectedTemplateCodes, manualDocumentCodes, excludedDocumentCodes);
    main.innerHTML = renderSubmissionRequestsBody(
      customers,
      selectedCustomerIds,
      selectedTemplateCodes,
      selectedDocumentCodes,
      customerQuery,
      templateQuery,
      documentQuery,
      addDocumentQuery,
      isAddDocumentDialogOpen,
      isSendDialogOpen,
      selectedRecipientIds,
      selectedSendMethods,
      sendResult,
      sendError,
      isSending,
      isSendConfirmDialogOpen,
    );
    bindWorkspaceEvents();
    if (focusSelector) {
      const focusedInput = app.querySelector(focusSelector);
      focusedInput?.focus();
      if (typeof cursorPosition === "number") focusedInput?.setSelectionRange(cursorPosition, cursorPosition);
    }
  };

  const setDocumentSelection = (documentCode, isSelected) => {
    manualDocumentCodes = new Set(manualDocumentCodes);
    excludedDocumentCodes = new Set(excludedDocumentCodes);
    if (isSelected) {
      manualDocumentCodes.add(documentCode);
      excludedDocumentCodes.delete(documentCode);
    } else {
      manualDocumentCodes.delete(documentCode);
      excludedDocumentCodes.add(documentCode);
    }
  };

  function bindWorkspaceEvents() {
    app.querySelectorAll("[data-select-request-customer]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        selectedCustomerIds = new Set(selectedCustomerIds);
        const customer = customers.find((entry) => entry.id === checkbox.dataset.selectRequestCustomer);
        const contactIds = customer ? getContactIdsForCustomer(customer) : new Set();
        selectedRecipientIds = new Set([...selectedRecipientIds].filter((contactId) => !contactIds.has(contactId)));
        if (checkbox.checked) {
          selectedCustomerIds.add(checkbox.dataset.selectRequestCustomer);
          const primaryContactId = customer ? getPrimaryContactId(customer) : "";
          if (primaryContactId) selectedRecipientIds.add(primaryContactId);
        } else {
          selectedCustomerIds.delete(checkbox.dataset.selectRequestCustomer);
        }
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-request-customer-row]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        selectedCustomerIds = new Set(selectedCustomerIds);
        if (selectedCustomerIds.has(row.dataset.requestCustomerRow)) {
          selectedCustomerIds.delete(row.dataset.requestCustomerRow);
          const customer = customers.find((entry) => entry.id === row.dataset.requestCustomerRow);
          const contactIds = customer ? getContactIdsForCustomer(customer) : new Set();
          selectedRecipientIds = new Set([...selectedRecipientIds].filter((contactId) => !contactIds.has(contactId)));
        } else {
          selectedCustomerIds.add(row.dataset.requestCustomerRow);
          const customer = customers.find((entry) => entry.id === row.dataset.requestCustomerRow);
          const primaryContactId = customer ? getPrimaryContactId(customer) : "";
          if (primaryContactId) selectedRecipientIds.add(primaryContactId);
        }
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-send-submission-request]")?.addEventListener("click", () => {
      const selectedCustomers = customers.filter((customer) => selectedCustomerIds.has(customer.id));
      const validContactIds = new Set(selectedCustomers.flatMap((customer) => getCustomerContacts(customer).map((contact) => contact.id)));
      selectedRecipientIds = new Set([...selectedRecipientIds].filter((contactId) => validContactIds.has(contactId)));
      selectedCustomers.forEach((customer) => {
        const alreadySelected = getCustomerContacts(customer).some((contact) => selectedRecipientIds.has(contact.id));
        const primaryContactId = getPrimaryContactId(customer);
        if (!alreadySelected && primaryContactId) selectedRecipientIds.add(primaryContactId);
      });
      sendResult = null;
      sendError = "";
      isSendConfirmDialogOpen = false;
      isSendDialogOpen = true;
      rerenderWorkspace();
    });

    app.querySelectorAll("[data-close-send-dialog]").forEach((button) => {
      button.addEventListener("click", () => {
        isSendDialogOpen = false;
        isSendConfirmDialogOpen = false;
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-send-dialog]")?.addEventListener("click", (event) => {
      if (event.target.dataset.sendDialog === undefined) return;
      isSendDialogOpen = false;
      isSendConfirmDialogOpen = false;
      rerenderWorkspace();
    });

    app.querySelectorAll("[data-send-method]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        selectedSendMethods = new Set(selectedSendMethods);
        if (checkbox.checked) selectedSendMethods.add(checkbox.dataset.sendMethod);
        else selectedSendMethods.delete(checkbox.dataset.sendMethod);
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-send-recipient]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        selectedRecipientIds = new Set(selectedRecipientIds);
        if (checkbox.checked) selectedRecipientIds.add(checkbox.dataset.sendRecipient);
        else selectedRecipientIds.delete(checkbox.dataset.sendRecipient);
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-open-send-confirm]")?.addEventListener("click", () => {
      isSendConfirmDialogOpen = true;
      sendError = "";
      rerenderWorkspace();
    });

    app.querySelector("[data-cancel-send-confirm]")?.addEventListener("click", () => {
      isSendConfirmDialogOpen = false;
      rerenderWorkspace();
    });

    app.querySelector("[data-confirm-send-request]")?.addEventListener("click", () => {
      isSending = true;
      sendError = "";
      isSendConfirmDialogOpen = false;
      rerenderWorkspace();
      requestJson("/api/submission-requests", {
        method: "POST",
        body: JSON.stringify({
          customerIds: [...selectedCustomerIds],
          contactIds: [...selectedRecipientIds],
          templateCodes: [...selectedTemplateCodes],
          documentCodes: [...getSelectedDocumentCodes(selectedTemplateCodes, manualDocumentCodes, excludedDocumentCodes)],
          sendMethods: [...selectedSendMethods],
        }),
      })
        .then((result) => {
          sendResult = result;
          const firstPortalUrl = result?.requests?.[0]?.url;
          if (firstPortalUrl) {
            try {
              window.localStorage.setItem("auditmind.latestSubmissionPortalUrl", firstPortalUrl);
            } catch {
              // Ignore storage failures; the generated link remains visible in the modal.
            }
          }
          isSending = false;
          rerenderWorkspace();
        })
        .catch((error) => {
          sendError = error.message || "자료제출 요청을 생성하지 못했습니다.";
          isSending = false;
          rerenderWorkspace();
        });
    });

    app.querySelector("[data-request-customer-search]")?.addEventListener("input", (event) => {
      customerQuery = event.target.value;
      rerenderWorkspace({
        focusSelector: "[data-request-customer-search]",
        cursorPosition: event.target.selectionStart,
      });
    });

    app.querySelectorAll("[data-request-template]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const templateCode = checkbox.dataset.requestTemplate;
        const mappedDocumentCodes = templateDocumentCodesByTemplateCode.get(templateCode) || [];
        selectedTemplateCodes = new Set(selectedTemplateCodes);
        if (checkbox.checked) {
          selectedTemplateCodes.add(templateCode);
          excludedDocumentCodes = new Set(excludedDocumentCodes);
          mappedDocumentCodes.forEach((documentCode) => excludedDocumentCodes.delete(documentCode));
        } else {
          selectedTemplateCodes.delete(templateCode);
        }
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-template-search]")?.addEventListener("input", (event) => {
      templateQuery = event.target.value;
      rerenderWorkspace({
        focusSelector: "[data-template-search]",
        cursorPosition: event.target.selectionStart,
      });
    });

    app.querySelector("[data-document-search]")?.addEventListener("input", (event) => {
      documentQuery = event.target.value;
      rerenderWorkspace({
        focusSelector: "[data-document-search]",
        cursorPosition: event.target.selectionStart,
      });
    });

    app.querySelector("[data-open-add-document-dialog]")?.addEventListener("click", () => {
      isAddDocumentDialogOpen = true;
      addDocumentQuery = "";
      rerenderWorkspace({ focusSelector: "[data-add-document-search]" });
    });

    app.querySelectorAll("[data-close-add-document-dialog]").forEach((button) => {
      button.addEventListener("click", () => {
        isAddDocumentDialogOpen = false;
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-add-document-dialog]")?.addEventListener("click", (event) => {
      if (event.target.dataset.addDocumentDialog === undefined) return;
      isAddDocumentDialogOpen = false;
      rerenderWorkspace();
    });

    app.querySelector("[data-add-document-search]")?.addEventListener("input", (event) => {
      addDocumentQuery = event.target.value;
      rerenderWorkspace({
        focusSelector: "[data-add-document-search]",
        cursorPosition: event.target.selectionStart,
      });
    });

    app.querySelectorAll("[data-template-row]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        const templateCode = row.dataset.templateRow;
        const mappedDocumentCodes = templateDocumentCodesByTemplateCode.get(templateCode) || [];
        selectedTemplateCodes = new Set(selectedTemplateCodes);
        if (selectedTemplateCodes.has(templateCode)) {
          selectedTemplateCodes.delete(templateCode);
        } else {
          selectedTemplateCodes.add(templateCode);
          excludedDocumentCodes = new Set(excludedDocumentCodes);
          mappedDocumentCodes.forEach((documentCode) => excludedDocumentCodes.delete(documentCode));
        }
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-template-document]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        setDocumentSelection(checkbox.dataset.templateDocument, checkbox.checked);
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-add-document-checkbox]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        setDocumentSelection(checkbox.dataset.addDocumentCheckbox, checkbox.checked);
        rerenderWorkspace({
          focusSelector: "[data-add-document-search]",
          cursorPosition: addDocumentQuery.length,
        });
      });
    });

    app.querySelectorAll("[data-document-row]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        const documentCode = row.dataset.documentRow;
        const selectedDocumentCodes = getSelectedDocumentCodes(
          selectedTemplateCodes,
          manualDocumentCodes,
          excludedDocumentCodes,
        );
        setDocumentSelection(documentCode, !selectedDocumentCodes.has(documentCode));
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-add-document-row]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        const documentCode = row.dataset.addDocumentRow;
        const selectedDocumentCodes = getSelectedDocumentCodes(
          selectedTemplateCodes,
          manualDocumentCodes,
          excludedDocumentCodes,
        );
        setDocumentSelection(documentCode, !selectedDocumentCodes.has(documentCode));
        rerenderWorkspace({
          focusSelector: "[data-add-document-search]",
          cursorPosition: addDocumentQuery.length,
        });
      });
    });
  }

  bindWorkspaceEvents();
};

export const renderAccountantSubmissionRequests = (app) => {
  renderAccountantShell({
    app,
    activePage: "submission-requests",
    eyebrow: "",
    title: "자료제출 요청",
    bodyHtml: renderSubmissionRequestsBody(fallbackRequestCustomers, new Set([fallbackRequestCustomers[0]?.id].filter(Boolean))),
    onReady: (shellRoot) => {
      const attach = (customers) => attachSubmissionRequestInteractions(shellRoot, customers.length ? customers : fallbackRequestCustomers);
      loadSubmissionRequestWorkspace()
        .then((workspace) => {
          applyRequestTemplateWorkspace(workspace);
          const main = shellRoot.querySelector("main");
          const customers = workspace.customers.length ? workspace.customers : fallbackRequestCustomers;
          if (main) {
            main.innerHTML = renderSubmissionRequestsBody(customers, new Set([customers[0]?.id].filter(Boolean)));
          }
          attach(customers);
        })
        .catch(() => attach(fallbackRequestCustomers));
    },
  });
};
