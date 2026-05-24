import { componentClasses, cx, escapeHtml, getButtonClass, renderAccountantShell } from "./accountantShell.js";
import documentTypeSeedSql from "../database/seeds/001_document_type_seed.sql?raw";
import documentRequiredFieldsSeedSql from "../database/seeds/002_document_required_fields_seed.sql?raw";
import requestTemplateSeedSql from "../database/seeds/003_request_template_seed.sql?raw";
import requestTemplateDocumentSeedSql from "../database/seeds/004_request_template_document_seed.sql?raw";

const inputClass =
  "h-10 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-sm text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20";

const fieldLabelClass = "block text-xs font-semibold text-[#616161]";
const requestTemplatesEndpoint = "/api/request-templates";
const documentTypesEndpoint = "/api/document-types";

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

const extractSeedSection = (sql, startMarker, endMarker) => {
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start);
  if (start < 0 || end < 0) return "";
  return sql.slice(start, end);
};

const parseCategoryRows = () =>
  [
    ...extractSeedSection(documentTypeSeedSql, "WITH category_seed", "INSERT INTO document_categories").matchAll(
      /\('([^']+)', '([^']+)', '([^']+)', (\d+)\)/g,
    ),
  ].map((match) => ({
    code: match[1],
    name: match[2],
    description: match[3],
    sortOrder: Number(match[4]),
  }));

const categoryNameByCode = new Map(parseCategoryRows().map((category) => [category.code, category.name]));

const parseCommonRequiredFields = () =>
  [
    ...extractSeedSection(documentRequiredFieldsSeedSql, "WITH common_fields", "category_fields").matchAll(
      /\('([^']+)', '([^']+)', '([^']+)', (true|false), '([^']*)', (\d+)\)/g,
    ),
  ]
    .filter((match) => match[4] === "true")
    .map((match) => ({ key: match[1], label: match[2], sortOrder: Number(match[6]) }));

const parseCategoryRequiredFields = () =>
  [
    ...extractSeedSection(documentRequiredFieldsSeedSql, "category_fields", "type_fields").matchAll(
      /\('([^']+)', '([^']+)', '([^']+)', '([^']+)', (true|false), '([^']*)', (\d+)\)/g,
    ),
  ]
    .filter((match) => match[5] === "true")
    .map((match) => ({ categoryCode: match[1], key: match[2], label: match[3], sortOrder: Number(match[7]) }));

const parseTypeRequiredFields = () =>
  [
    ...extractSeedSection(documentRequiredFieldsSeedSql, "type_fields", "all_fields").matchAll(
      /\('([^']+)', '([^']+)', '([^']+)', '([^']+)', (true|false), '([^']*)', (\d+)\)/g,
    ),
  ]
    .filter((match) => match[5] === "true")
    .map((match) => ({ documentCode: match[1], key: match[2], label: match[3], sortOrder: Number(match[7]) }));

const groupByKey = (items, getKey) =>
  items.reduce((groups, item) => {
    const key = getKey(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
    return groups;
  }, new Map());

const commonRequiredFields = parseCommonRequiredFields();
const categoryRequiredFieldsByCode = groupByKey(parseCategoryRequiredFields(), (field) => field.categoryCode);
const typeRequiredFieldsByDocumentCode = groupByKey(parseTypeRequiredFields(), (field) => field.documentCode);

const getRequiredFieldLabels = (documentCode, categoryCode) => {
  const fields = [
    ...commonRequiredFields,
    ...(categoryRequiredFieldsByCode.get(categoryCode) || []),
    ...(typeRequiredFieldsByDocumentCode.get(documentCode) || []),
  ].sort((a, b) => a.sortOrder - b.sortOrder);
  const labels = [];
  const seen = new Set();
  fields.forEach((field) => {
    if (seen.has(field.key)) return;
    seen.add(field.key);
    labels.push(field.label);
  });
  return labels;
};

let documentTypeRows = [
  ...extractSeedSection(documentTypeSeedSql, "WITH document_seed", "INSERT INTO document_types").matchAll(
    /\('([^']+)', '([^']+)', '([^']+)', (\d+)\)/g,
  ),
].map((match) => ({
  categoryCode: match[1],
  code: match[2],
  name: match[3],
  sortOrder: Number(match[4]),
  categoryName: categoryNameByCode.get(match[1]) || match[1],
  requiredFieldLabels: getRequiredFieldLabels(match[2], match[1]),
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

const initialTemplateDocumentCodes = new Map(
  templateProfileRows.map(({ templateCode, profileCode }) => {
    const profile = profileByCode.get(profileCode);
    return [
      templateCode,
      profile ? [...profile.requiredDocumentCodes, ...profile.optionalDocumentCodes] : [],
    ];
  }),
);

const buildInitialTemplateDocumentCodeMap = (templates) =>
  new Map(
    templates.map((template) => [
      template.code,
      new Set(Array.isArray(template.documentCodes) ? template.documentCodes : initialTemplateDocumentCodes.get(template.code) || []),
    ]),
  );

const fetchTemplateWorkspaceFromApi = async () => {
  const payload = await requestJson(requestTemplatesEndpoint);
  return {
    templates: Array.isArray(payload.templates) ? payload.templates : [],
    documents: Array.isArray(payload.documents) ? payload.documents : [],
  };
};

const createTemplateFromApi = async (values) => {
  const payload = await requestJson(requestTemplatesEndpoint, {
    method: "POST",
    body: JSON.stringify(values),
  });
  return payload.template;
};

const updateTemplateFromApi = async (templateCode, values) => {
  const payload = await requestJson(`${requestTemplatesEndpoint}/${encodeURIComponent(templateCode)}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
  return payload.template;
};

const deleteTemplateFromApi = async (templateCode) => {
  await requestJson(`${requestTemplatesEndpoint}/${encodeURIComponent(templateCode)}`, {
    method: "DELETE",
  });
};

const updateRequiredFieldsFromApi = async (documentCode, labels) => {
  const payload = await requestJson(`${documentTypesEndpoint}/${encodeURIComponent(documentCode)}/required-fields`, {
    method: "PUT",
    body: JSON.stringify({ labels }),
  });
  return payload.document;
};

const normalizeSearchText = (value) => value.trim().toLocaleLowerCase("ko-KR");

const matchesSearchText = (values, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearchText(String(value || "")).includes(normalizedQuery));
};

const createTemplateDraft = ({ name, serviceArea, description, sortOrder }) => ({
  code: `custom_template_${Date.now()}`,
  name,
  serviceArea,
  description,
  sortOrder,
});

const renderTemplateRows = (templates, selectedTemplateCode, documentCodeMap) =>
  templates
    .map((template) => {
      const isSelected = template.code === selectedTemplateCode;
      const documentCount = documentCodeMap.get(template.code)?.size || 0;
      return `
        <tr class="${cx(
          "cursor-pointer bg-white transition-colors hover:bg-[#f7fbff]",
          isSelected ? "bg-[#eef6ff]" : "",
        )}" data-template-management-row="${escapeHtml(template.code)}">
          <td class="px-2 py-3 align-middle">
            <div class="flex min-w-0 items-center gap-1.5">
              <button class="min-w-0 truncate text-left font-semibold text-[#2a2a2a]" type="button" data-select-template="${escapeHtml(template.code)}">
                ${escapeHtml(template.name)}
              </button>
              <span class="${cx(
                componentClasses.pill,
                "w-[50px] shrink-0 border border-[#dbe8f6] bg-[#f7fbff] px-2 py-0.5 text-[11px] text-[#043873]",
                isSelected ? "" : "invisible",
              )}" ${isSelected ? "" : `aria-hidden="true"`}>${isSelected ? "선택됨" : ""}</span>
            </div>
          </td>
          <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(template.serviceArea || "-")}</td>
          <td class="px-2 py-3 align-middle font-semibold text-[#2a2a2a]">${escapeHtml(documentCount)}개</td>
        </tr>
      `;
    })
    .join("");

const sortDocumentsBySelectionAndName = (documents, selectedDocumentCodes) =>
  [...documents].sort((a, b) => {
    const selectionDifference = Number(selectedDocumentCodes.has(b.code)) - Number(selectedDocumentCodes.has(a.code));
    if (selectionDifference !== 0) return selectionDifference;
    return a.name.localeCompare(b.name, ["ko", "en"], { numeric: true });
  });

const renderDocumentRows = (documents, selectedDocumentCodes) =>
  sortDocumentsBySelectionAndName(documents, selectedDocumentCodes)
    .map(
      (document) => `
        <tr class="cursor-pointer ${selectedDocumentCodes.has(document.code) ? "bg-[#eef6ff]" : "bg-white"} hover:bg-[#f7fbff]" data-template-document-row="${escapeHtml(document.code)}" title="우클릭하면 필수 항목을 수정할 수 있습니다.">
          <td class="px-2 py-3 align-middle">
            <label class="flex min-w-0 items-center gap-2">
              <input class="size-4 shrink-0 accent-[#4f9cf9]" type="checkbox" data-template-document="${escapeHtml(document.code)}" ${selectedDocumentCodes.has(document.code) ? "checked" : ""}>
              <span class="min-w-0 truncate font-semibold ${selectedDocumentCodes.has(document.code) ? "text-[#043873]" : "text-[#2a2a2a]"}">${escapeHtml(document.name)}</span>
            </label>
          </td>
          <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(document.requiredFieldLabels.join(", ") || "-")}</td>
        </tr>
      `,
    )
    .join("");

const renderDeleteDialog = ({ isOpen, selectedTemplate }) => {
  if (!isOpen) return "";

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5" data-delete-template-dialog aria-hidden="false">
      <section class="w-full max-w-[420px] rounded-lg border border-[#dde6f0] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="delete-template-title">
        <div>
          <p class="text-xs font-semibold text-[#a4262c]">서비스 삭제</p>
          <h3 id="delete-template-title" class="mt-1 text-lg font-semibold text-[#242424]">서비스를 삭제할까요?</h3>
          <p class="mt-3 text-sm leading-6 text-[#616161]">${escapeHtml(selectedTemplate.name)} 서비스가 목록에서 삭제됩니다. 이미 발송된 요청에는 영향을 주지 않습니다.</p>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-delete-template>취소</button>
          <button class="${getButtonClass({ variant: "secondary", size: "md" })} border-[#f1b8be] text-[#a4262c] hover:bg-[#fff4f5]" type="button" data-confirm-delete-template>삭제</button>
        </div>
      </section>
    </div>
  `;
};

const renderAddTemplateDocumentRows = (documents, selectedDocumentCodes) =>
  sortDocumentsBySelectionAndName(documents, selectedDocumentCodes)
    .map(
      (document) => `
        <tr class="cursor-pointer ${selectedDocumentCodes.has(document.code) ? "bg-[#eef6ff]" : "bg-white"} hover:bg-[#f7fbff]" data-new-template-document-row="${escapeHtml(document.code)}" title="우클릭하면 필수 항목을 수정할 수 있습니다.">
          <td class="px-2 py-3 align-middle">
            <label class="flex min-w-0 items-center gap-2">
              <input class="size-4 shrink-0 accent-[#4f9cf9]" type="checkbox" data-new-template-document="${escapeHtml(document.code)}" ${selectedDocumentCodes.has(document.code) ? "checked" : ""}>
              <span class="min-w-0 truncate font-semibold ${selectedDocumentCodes.has(document.code) ? "text-[#043873]" : "text-[#2a2a2a]"}">${escapeHtml(document.name)}</span>
            </label>
          </td>
          <td class="px-2 py-3 align-middle text-[#616161]">${escapeHtml(document.requiredFieldLabels.join(", ") || "-")}</td>
        </tr>
      `,
    )
    .join("");

const renderAddTemplateDialog = ({ isOpen, draft, selectedDocumentCodes, documentQuery, errorMessage }) => {
  if (!isOpen) return "";
  const filteredDocuments = documentTypeRows.filter((document) =>
    matchesSearchText([document.name, document.requiredFieldLabels.join(" ")], documentQuery),
  );

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5" data-add-template-dialog aria-hidden="false">
      <section class="flex max-h-[calc(100vh-56px)] w-full max-w-[860px] flex-col overflow-hidden rounded-lg border border-[#dde6f0] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="add-template-title">
        <div class="border-b border-[#e6e6e6] bg-[#fafafa] p-5">
          <p class="text-xs font-semibold text-[#043873]">신규 서비스 등록</p>
          <h3 id="add-template-title" class="mt-1 text-lg font-semibold text-[#242424]">서비스 설정</h3>
        </div>
        <div class="min-h-0 flex-1 overflow-auto p-5">
          <div class="grid gap-3">
            <label>
              <span class="${fieldLabelClass}">서비스명 <span class="text-[#a4262c]" aria-hidden="true">*</span></span>
              <input class="${inputClass} mt-1" type="text" value="${escapeHtml(draft.name)}" data-new-template-field="name" aria-describedby="new-template-error">
            </label>
            <label>
              <span class="${fieldLabelClass}">업무 영역</span>
              <input class="${inputClass} mt-1" type="text" value="${escapeHtml(draft.serviceArea)}" data-new-template-field="serviceArea">
            </label>
            <label>
              <span class="${fieldLabelClass}">내용</span>
              <textarea class="mt-1 min-h-20 w-full resize-y rounded-md border border-[#d1d1d1] bg-white px-3 py-2 text-sm leading-6 text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20" data-new-template-field="description">${escapeHtml(draft.description)}</textarea>
            </label>
            <p id="new-template-error" class="${cx("text-xs font-semibold text-[#a4262c]", errorMessage ? "" : "invisible")}">${escapeHtml(errorMessage || "입력 오류")}</p>
          </div>

          <section class="mt-4 flex h-[min(420px,calc(100vh-430px))] min-h-[300px] flex-col overflow-hidden rounded-lg border border-[#e6e6e6]" aria-labelledby="new-template-documents-title">
            <div class="grid min-h-[56px] grid-cols-1 items-center gap-3 border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)]">
              <h4 id="new-template-documents-title" class="text-base font-semibold text-[#2a2a2a]">요청자료</h4>
              <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_108px] items-center gap-2 justify-self-stretch md:max-w-[388px] md:justify-self-end">
                <label class="sr-only" for="new-template-document-search">요청자료 검색</label>
                <input id="new-template-document-search" class="h-9 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-xs font-medium text-[#2a2a2a] outline-none transition focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20" type="search" value="${escapeHtml(documentQuery)}" placeholder="자료 검색" data-new-template-document-search>
                <span class="${cx(componentClasses.pill, "w-[108px] justify-center border border-[#dbe8f6] bg-[#f7fbff] px-2 text-[#043873]")}">선택 ${escapeHtml(selectedDocumentCodes.size)}개</span>
              </div>
            </div>
            <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
              <table class="w-full table-fixed border-collapse text-left text-xs">
                <thead class="text-xs font-semibold text-[#616161]">
                  <tr>
                    <th class="w-[42%] px-2 py-2" role="columnheader">자료명</th>
                    <th class="w-[58%] px-2 py-2" role="columnheader">필수 항목</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div class="min-h-0 flex-1 overflow-auto">
              <table class="w-full table-fixed border-collapse text-left text-xs">
                <tbody class="divide-y divide-[#e6e6e6]">
                  ${renderAddTemplateDocumentRows(filteredDocuments, selectedDocumentCodes)}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#e6e6e6] bg-white p-5">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-add-template>취소</button>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-confirm-add-template>생성</button>
        </div>
      </section>
    </div>
  `;
};

const renderRequiredItemDialog = ({ isOpen, document, draft }) => {
  if (!isOpen || !document) return "";

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-5" data-required-item-dialog aria-hidden="false">
      <section class="w-full max-w-[520px] overflow-hidden rounded-lg border border-[#dde6f0] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="required-item-title">
        <div class="border-b border-[#e6e6e6] bg-[#fafafa] p-5">
          <p class="text-xs font-semibold text-[#043873]">${escapeHtml(document.name)}</p>
          <h3 id="required-item-title" class="mt-1 text-lg font-semibold text-[#242424]">필수 항목 수정</h3>
        </div>
        <div class="p-5">
          <label>
            <span class="${fieldLabelClass}">필수 항목</span>
            <textarea class="mt-1 min-h-32 w-full resize-y rounded-md border border-[#d1d1d1] bg-white px-3 py-2 text-sm leading-6 text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20" data-required-item-draft>${escapeHtml(draft)}</textarea>
          </label>
          <p class="mt-2 text-xs leading-5 text-[#616161]">쉼표 또는 줄바꿈으로 구분해 입력합니다.</p>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#e6e6e6] bg-white p-5">
          <button class="${getButtonClass({ variant: "secondary", size: "md" })}" type="button" data-close-required-item>취소</button>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-save-required-item>저장</button>
        </div>
      </section>
    </div>
  `;
};

const renderTemplateEditor = (
  selectedTemplate,
  selectedDocumentCodes,
  documentQuery,
  dirtyTemplateCodes,
  saveMessageVisible,
) => {
  const filteredDocuments = documentTypeRows.filter((document) =>
    matchesSearchText([document.name, document.requiredFieldLabels.join(" ")], documentQuery),
  );
  const isDirty = dirtyTemplateCodes.has(selectedTemplate.code);

  return `
    <section class="${cx(componentClasses.surface, "flex h-full min-h-0 flex-col overflow-hidden")}" aria-labelledby="template-editor-title">
      <div class="flex min-h-[73px] items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] p-4">
        <div class="min-w-0">
          <h3 id="template-editor-title" class="text-base font-semibold text-[#2a2a2a]">서비스 설정</h3>
          <p class="mt-1 truncate text-xs font-semibold text-[#616161]" data-selected-template-name>${escapeHtml(selectedTemplate.name)}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span class="${cx("text-xs font-semibold text-[#107c10]", saveMessageVisible ? "" : "invisible")}" data-save-template-message>저장되었습니다.</span>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-save-template ${isDirty ? "" : "disabled"}>저장</button>
          <button class="${getButtonClass({ variant: "secondary", size: "md" })} border-[#f1b8be] text-[#a4262c] hover:bg-[#fff4f5]" type="button" data-open-delete-template>서비스 삭제</button>
        </div>
      </div>

      <div class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-4">
        <section class="rounded-lg border border-[#e6e6e6] bg-[#fafafa] p-4" aria-label="서비스 기본정보">
          <div class="grid gap-3 md:grid-cols-2">
            <label>
              <span class="${fieldLabelClass}">서비스명 <span class="text-[#a4262c]" aria-hidden="true">*</span></span>
              <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedTemplate.name)}" data-template-field="name">
            </label>
            <label>
              <span class="${fieldLabelClass}">업무 영역</span>
              <input class="${inputClass} mt-1" type="text" value="${escapeHtml(selectedTemplate.serviceArea || "")}" data-template-field="serviceArea">
            </label>
            <label class="md:col-span-2">
              <span class="${fieldLabelClass}">내용</span>
              <textarea class="mt-1 min-h-20 w-full resize-y rounded-md border border-[#d1d1d1] bg-white px-3 py-2 text-sm leading-6 text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20" data-template-field="description">${escapeHtml(selectedTemplate.description || "")}</textarea>
            </label>
          </div>
        </section>

        <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#e6e6e6]" aria-labelledby="template-documents-title">
          <div class="grid min-h-[56px] grid-cols-1 items-center gap-3 border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)]">
            <h4 id="template-documents-title" class="text-base font-semibold text-[#2a2a2a]">요청 자료</h4>
            <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_108px] items-center gap-2 justify-self-stretch md:max-w-[388px] md:justify-self-end">
              <label class="sr-only" for="template-document-search">요청 자료 검색</label>
              <input id="template-document-search" class="h-9 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-xs font-medium text-[#2a2a2a] outline-none transition focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20" type="search" value="${escapeHtml(documentQuery)}" placeholder="자료 검색" data-template-document-search>
              <span class="${cx(componentClasses.pill, "w-[108px] justify-center border border-[#dbe8f6] bg-[#f7fbff] px-2 text-[#043873]")}">선택 ${escapeHtml(selectedDocumentCodes.size)}개</span>
            </div>
          </div>
          <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
            <table class="w-full table-fixed border-collapse text-left text-xs">
              <thead class="bg-[#fafafa] text-xs font-semibold text-[#616161]">
                <tr class="border-b border-[#e6e6e6]">
                  <th class="w-[42%] px-2 py-2" role="columnheader">자료명</th>
                  <th class="w-[58%] px-2 py-2" role="columnheader">필수 항목</th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full table-fixed border-collapse text-left text-xs">
              <tbody class="divide-y divide-[#e6e6e6]">
                ${renderDocumentRows(filteredDocuments, selectedDocumentCodes)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  `;
};

const renderTemplateManagementBody = (
  templates,
  selectedTemplateCode,
  templateDocumentCodeMap,
  templateQuery = "",
  documentQuery = "",
  dirtyTemplateCodes = new Set(),
  saveMessageVisible = false,
  deleteDialogOpen = false,
  addDialogOpen = false,
  addTemplateDraft = { name: "", serviceArea: "", description: "" },
  addTemplateDocumentCodes = new Set(),
  addTemplateDocumentQuery = "",
  addTemplateError = "",
  requiredItemDialogOpen = false,
  requiredItemDocumentCode = "",
  requiredItemDraft = "",
) => {
  const selectedTemplate = templates.find((template) => template.code === selectedTemplateCode) || templates[0];
  const selectedDocumentCodes = templateDocumentCodeMap.get(selectedTemplate.code) || new Set();
  const filteredTemplates = templates.filter((template) =>
    matchesSearchText([template.name, template.serviceArea, template.description], templateQuery),
  );

  return `
    <section class="grid h-[calc(100vh-130px)] min-h-0 items-stretch gap-4 overflow-hidden xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section class="${cx(componentClasses.surface, "flex h-full min-h-0 flex-col overflow-hidden")}" aria-labelledby="template-list-title">
        <div class="flex min-h-[73px] items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] p-4">
          <div class="flex min-w-0 items-center gap-2">
            <h3 id="template-list-title" class="text-base font-semibold text-[#2a2a2a]">서비스 목록</h3>
            <span class="${cx(componentClasses.pill, "border border-[#dbe8f6] bg-[#f7fbff] text-[#043873]")}">전체 ${escapeHtml(templates.length)}개</span>
          </div>
          <button class="${getButtonClass({ variant: "primary", size: "md" })}" type="button" data-add-template>신규 서비스 등록</button>
        </div>
        <div class="grid min-h-[56px] grid-cols-[minmax(0,1fr)_108px] items-center gap-2 border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3">
          <label class="sr-only" for="template-management-search">서비스 검색</label>
          <input id="template-management-search" class="h-9 w-full rounded-md border border-[#d1d1d1] bg-white px-3 text-xs font-medium text-[#2a2a2a] outline-none transition focus:border-[#4f9cf9] focus:ring-2 focus:ring-[#4f9cf9]/20" type="search" value="${escapeHtml(templateQuery)}" placeholder="서비스 검색" data-template-management-search>
          <span class="${cx(componentClasses.pill, "w-[108px] justify-center border border-[#dbe8f6] bg-[#f7fbff] px-2 text-[#043873]")}">${escapeHtml(filteredTemplates.length)} / ${escapeHtml(templates.length)}개</span>
        </div>
        <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            <thead class="text-xs font-semibold text-[#616161]">
              <tr class="border-b border-[#e6e6e6]">
                <th class="w-[48%] px-2 py-2" role="columnheader">서비스명</th>
                <th class="w-[34%] px-2 py-2" role="columnheader">업무 영역</th>
                <th class="w-[18%] px-2 py-2" role="columnheader">자료 수</th>
              </tr>
            </thead>
          </table>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            <tbody class="divide-y divide-[#e6e6e6]">
              ${renderTemplateRows(filteredTemplates, selectedTemplate.code, templateDocumentCodeMap)}
            </tbody>
          </table>
        </div>
      </section>

      <div class="h-full min-h-0" data-template-editor>
        ${renderTemplateEditor(selectedTemplate, selectedDocumentCodes, documentQuery, dirtyTemplateCodes, saveMessageVisible)}
      </div>
    </section>
    ${renderDeleteDialog({ isOpen: deleteDialogOpen, selectedTemplate })}
    ${renderRequiredItemDialog({
      isOpen: requiredItemDialogOpen,
      document: documentTypeRows.find((document) => document.code === requiredItemDocumentCode),
      draft: requiredItemDraft,
    })}
    ${renderAddTemplateDialog({
      isOpen: addDialogOpen,
      draft: addTemplateDraft,
      selectedDocumentCodes: addTemplateDocumentCodes,
      documentQuery: addTemplateDocumentQuery,
      errorMessage: addTemplateError,
    })}
  `;
};

const attachTemplateManagementInteractions = (app) => {
  let templates = structuredClone(requestTemplateRows);
  let selectedTemplateCode = templates[0]?.code;
  let serviceApiReady = false;
  let templateQuery = "";
  let documentQuery = "";
  let saveMessageVisible = false;
  let deleteDialogOpen = false;
  let addDialogOpen = false;
  let addTemplateDraft = { name: "", serviceArea: "", description: "" };
  let addTemplateDocumentQuery = "";
  let addTemplateDocumentCodes = new Set();
  let addTemplateError = "";
  let requiredItemDialogOpen = false;
  let requiredItemDocumentCode = "";
  let requiredItemDraft = "";
  let saveMessageTimer;
  let dirtyTemplateCodes = new Set();
  let templateDocumentCodeMap = buildInitialTemplateDocumentCodeMap(templates);

  const selectedTemplate = () => templates.find((template) => template.code === selectedTemplateCode) || templates[0];

  const markSelectedTemplateDirty = () => {
    dirtyTemplateCodes = new Set(dirtyTemplateCodes);
    dirtyTemplateCodes.add(selectedTemplateCode);
    saveMessageVisible = false;
    clearTimeout(saveMessageTimer);
  };

  const rerenderWorkspace = ({ focusSelector, cursorPosition } = {}) => {
    const main = app.querySelector("main");
    if (!main) return;
    main.innerHTML = renderTemplateManagementBody(
      templates,
      selectedTemplateCode,
      templateDocumentCodeMap,
      templateQuery,
      documentQuery,
      dirtyTemplateCodes,
      saveMessageVisible,
      deleteDialogOpen,
      addDialogOpen,
      addTemplateDraft,
      addTemplateDocumentCodes,
      addTemplateDocumentQuery,
      addTemplateError,
      requiredItemDialogOpen,
      requiredItemDocumentCode,
      requiredItemDraft,
    );
    bindWorkspaceEvents();
    if (focusSelector) {
      const focusedInput = app.querySelector(focusSelector);
      focusedInput?.focus();
      if (typeof cursorPosition === "number") focusedInput?.setSelectionRange(cursorPosition, cursorPosition);
    }
  };

  const updateSelectedTemplate = (field, value) => {
    const template = selectedTemplate();
    if (!template) return;
    template[field] = value;
  };

  const getSelectedDocumentCodesArray = (templateCode = selectedTemplateCode) => [
    ...(templateDocumentCodeMap.get(templateCode) || new Set()),
  ];

  const syncWorkspaceFromApi = async () => {
    try {
      const workspace = await fetchTemplateWorkspaceFromApi();
      if (!workspace.templates.length || !workspace.documents.length) return;
      serviceApiReady = true;
      requestTemplateRows = workspace.templates;
      documentTypeRows = workspace.documents;
      templates = structuredClone(workspace.templates);
      selectedTemplateCode =
        templates.find((template) => template.code === selectedTemplateCode)?.code ||
        templates[0]?.code;
      templateDocumentCodeMap = buildInitialTemplateDocumentCodeMap(templates);
      dirtyTemplateCodes = new Set();
      saveMessageVisible = false;
      rerenderWorkspace();
    } catch {
      serviceApiReady = false;
    }
  };

  const captureAddTemplateDraft = () => {
    const nameInput = app.querySelector("[data-new-template-field='name']");
    const serviceAreaInput = app.querySelector("[data-new-template-field='serviceArea']");
    const descriptionInput = app.querySelector("[data-new-template-field='description']");
    addTemplateDraft = {
      name: nameInput ? nameInput.value : addTemplateDraft.name,
      serviceArea: serviceAreaInput ? serviceAreaInput.value : addTemplateDraft.serviceArea,
      description: descriptionInput ? descriptionInput.value : addTemplateDraft.description,
    };
  };

  const openRequiredItemDialog = (documentCode) => {
    const document = documentTypeRows.find((item) => item.code === documentCode);
    if (!document) return;
    requiredItemDialogOpen = true;
    requiredItemDocumentCode = document.code;
    requiredItemDraft = document.requiredFieldLabels.join(", ");
    deleteDialogOpen = false;
    rerenderWorkspace();
  };

  const closeRequiredItemDialog = () => {
    requiredItemDialogOpen = false;
    requiredItemDocumentCode = "";
    requiredItemDraft = "";
  };

  function bindWorkspaceEvents() {
    app.querySelector("[data-template-management-search]")?.addEventListener("input", (event) => {
      templateQuery = event.target.value;
      rerenderWorkspace({
        focusSelector: "[data-template-management-search]",
        cursorPosition: event.target.selectionStart,
      });
    });

    app.querySelector("[data-template-document-search]")?.addEventListener("input", (event) => {
      documentQuery = event.target.value;
      rerenderWorkspace({
        focusSelector: "[data-template-document-search]",
        cursorPosition: event.target.selectionStart,
      });
    });

    app.querySelectorAll("[data-select-template]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedTemplateCode = button.dataset.selectTemplate;
        documentQuery = "";
        saveMessageVisible = false;
        deleteDialogOpen = false;
        addDialogOpen = false;
        requiredItemDialogOpen = false;
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-template-management-row]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        selectedTemplateCode = row.dataset.templateManagementRow;
        documentQuery = "";
        saveMessageVisible = false;
        deleteDialogOpen = false;
        addDialogOpen = false;
        requiredItemDialogOpen = false;
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-add-template]")?.addEventListener("click", () => {
      saveMessageVisible = false;
      deleteDialogOpen = false;
      addDialogOpen = true;
      requiredItemDialogOpen = false;
      addTemplateDraft = { name: "", serviceArea: "", description: "" };
      addTemplateDocumentQuery = "";
      addTemplateDocumentCodes = new Set();
      addTemplateError = "";
      rerenderWorkspace();
    });

    app.querySelectorAll("[data-close-add-template]").forEach((button) =>
      button.addEventListener("click", () => {
        addDialogOpen = false;
        addTemplateError = "";
        addTemplateDraft = { name: "", serviceArea: "", description: "" };
        addTemplateDocumentQuery = "";
        addTemplateDocumentCodes = new Set();
        requiredItemDialogOpen = false;
        rerenderWorkspace();
      }),
    );

    app.querySelector("[data-new-template-document-search]")?.addEventListener("input", (event) => {
      captureAddTemplateDraft();
      addTemplateDocumentQuery = event.target.value;
      rerenderWorkspace({
        focusSelector: "[data-new-template-document-search]",
        cursorPosition: event.target.selectionStart,
      });
    });

    app.querySelectorAll("[data-new-template-document]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        captureAddTemplateDraft();
        const documentCode = checkbox.dataset.newTemplateDocument;
        addTemplateDocumentCodes = new Set(addTemplateDocumentCodes);
        if (checkbox.checked) addTemplateDocumentCodes.add(documentCode);
        else addTemplateDocumentCodes.delete(documentCode);
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-new-template-document-row]").forEach((row) => {
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        captureAddTemplateDraft();
        openRequiredItemDialog(row.dataset.newTemplateDocumentRow);
      });

      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        captureAddTemplateDraft();
        const documentCode = row.dataset.newTemplateDocumentRow;
        addTemplateDocumentCodes = new Set(addTemplateDocumentCodes);
        if (addTemplateDocumentCodes.has(documentCode)) addTemplateDocumentCodes.delete(documentCode);
        else addTemplateDocumentCodes.add(documentCode);
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-confirm-add-template]")?.addEventListener("click", () => {
      const name = app.querySelector("[data-new-template-field='name']")?.value.trim() || "";
      const serviceArea = app.querySelector("[data-new-template-field='serviceArea']")?.value.trim() || "";
      const description = app.querySelector("[data-new-template-field='description']")?.value.trim() || "";
      addTemplateDraft = { name, serviceArea, description };
      if (!name) {
        addTemplateError = "서비스명을 입력해 주세요.";
        rerenderWorkspace({ focusSelector: "[data-new-template-field='name']" });
        return;
      }

      const finishCreate = (draft) => {
        templates = [draft, ...templates];
        selectedTemplateCode = draft.code;
        templateDocumentCodeMap = new Map(templateDocumentCodeMap);
        templateDocumentCodeMap.set(draft.code, new Set(addTemplateDocumentCodes));
        dirtyTemplateCodes = new Set(dirtyTemplateCodes);
        if (!serviceApiReady) dirtyTemplateCodes.add(draft.code);
        templateQuery = "";
        documentQuery = "";
        saveMessageVisible = false;
        deleteDialogOpen = false;
        addDialogOpen = false;
        requiredItemDialogOpen = false;
        addTemplateError = "";
        addTemplateDraft = { name: "", serviceArea: "", description: "" };
        addTemplateDocumentQuery = "";
        addTemplateDocumentCodes = new Set();
        rerenderWorkspace();
      };

      if (serviceApiReady) {
        createTemplateFromApi({
          name,
          serviceArea,
          description,
          documentCodes: [...addTemplateDocumentCodes],
        })
          .then((template) => finishCreate(template))
          .catch((error) => {
            addTemplateError = error.message || "서비스 등록에 실패했습니다.";
            rerenderWorkspace({ focusSelector: "[data-new-template-field='name']" });
          });
        return;
      }

      finishCreate(
        createTemplateDraft({
          name,
          serviceArea,
          description,
          sortOrder: templates.length + 1,
        }),
      );
    });

    app.querySelectorAll("[data-template-field]").forEach((input) => {
      input.addEventListener("input", () => {
        updateSelectedTemplate(input.dataset.templateField, input.value);
        markSelectedTemplateDirty();
        app.querySelector("[data-save-template]")?.removeAttribute("disabled");
        app.querySelector("[data-save-template-message]")?.classList.add("invisible");
        if (input.dataset.templateField === "name") {
          const title = app.querySelector("[data-selected-template-name]");
          if (title) title.textContent = input.value || "신규 서비스 등록";
        }
      });
    });

    app.querySelectorAll("[data-template-document]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const documentCode = checkbox.dataset.templateDocument;
        templateDocumentCodeMap = new Map(templateDocumentCodeMap);
        const documentCodes = new Set(templateDocumentCodeMap.get(selectedTemplateCode) || []);
        if (checkbox.checked) documentCodes.add(documentCode);
        else documentCodes.delete(documentCode);
        templateDocumentCodeMap.set(selectedTemplateCode, documentCodes);
        markSelectedTemplateDirty();
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-template-document-row]").forEach((row) => {
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRequiredItemDialog(row.dataset.templateDocumentRow);
      });

      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        const documentCode = row.dataset.templateDocumentRow;
        templateDocumentCodeMap = new Map(templateDocumentCodeMap);
        const documentCodes = new Set(templateDocumentCodeMap.get(selectedTemplateCode) || []);
        if (documentCodes.has(documentCode)) documentCodes.delete(documentCode);
        else documentCodes.add(documentCode);
        templateDocumentCodeMap.set(selectedTemplateCode, documentCodes);
        markSelectedTemplateDirty();
        rerenderWorkspace();
      });
    });

    app.querySelector("[data-save-template]")?.addEventListener("click", () => {
      const template = selectedTemplate();
      if (!template || !dirtyTemplateCodes.has(template.code)) return;
      if (!template.name.trim()) {
        const nameInput = app.querySelector("[data-template-field='name']");
        nameInput?.focus();
        return;
      }
      const finishSave = (savedTemplate = template) => {
        if (savedTemplate?.code) {
          templates = templates.map((item) => (item.code === savedTemplate.code ? { ...item, ...savedTemplate } : item));
        }
        dirtyTemplateCodes = new Set(dirtyTemplateCodes);
        dirtyTemplateCodes.delete(template.code);
        saveMessageVisible = true;
        clearTimeout(saveMessageTimer);
        rerenderWorkspace();
        saveMessageTimer = window.setTimeout(() => {
          saveMessageVisible = false;
          rerenderWorkspace();
        }, 1800);
      };

      if (serviceApiReady) {
        updateTemplateFromApi(template.code, {
          name: template.name,
          serviceArea: template.serviceArea,
          description: template.description,
          documentCodes: getSelectedDocumentCodesArray(template.code),
        })
          .then(finishSave)
          .catch(() => {
            saveMessageVisible = false;
            rerenderWorkspace();
          });
        return;
      }

      finishSave();
    });

    app.querySelector("[data-open-delete-template]")?.addEventListener("click", () => {
      deleteDialogOpen = true;
      addDialogOpen = false;
      requiredItemDialogOpen = false;
      rerenderWorkspace();
    });

    app.querySelectorAll("[data-close-delete-template]").forEach((button) =>
      button.addEventListener("click", () => {
        deleteDialogOpen = false;
        rerenderWorkspace();
      }),
    );

    app.querySelector("[data-confirm-delete-template]")?.addEventListener("click", () => {
      if (templates.length <= 1) return;
      const currentCode = selectedTemplateCode;
      const finishDelete = () => {
        templates = templates.filter((template) => template.code !== currentCode);
        templateDocumentCodeMap = new Map(templateDocumentCodeMap);
        templateDocumentCodeMap.delete(currentCode);
        dirtyTemplateCodes = new Set(dirtyTemplateCodes);
        dirtyTemplateCodes.delete(currentCode);
        selectedTemplateCode = templates[0]?.code;
        deleteDialogOpen = false;
        saveMessageVisible = false;
        requiredItemDialogOpen = false;
        rerenderWorkspace();
      };

      if (serviceApiReady) {
        deleteTemplateFromApi(currentCode).then(finishDelete).catch(() => {
          deleteDialogOpen = false;
          rerenderWorkspace();
        });
        return;
      }

      finishDelete();
    });

    app.querySelectorAll("[data-close-required-item]").forEach((button) =>
      button.addEventListener("click", () => {
        closeRequiredItemDialog();
        rerenderWorkspace();
      }),
    );

    app.querySelector("[data-save-required-item]")?.addEventListener("click", () => {
      const document = documentTypeRows.find((item) => item.code === requiredItemDocumentCode);
      if (!document) return;
      const draft = app.querySelector("[data-required-item-draft]")?.value || "";
      const labels = draft
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const finishRequiredFieldSave = (updatedDocument) => {
        document.requiredFieldLabels = updatedDocument?.requiredFieldLabels || labels;
        closeRequiredItemDialog();
        markSelectedTemplateDirty();
        rerenderWorkspace();
      };

      if (serviceApiReady) {
        updateRequiredFieldsFromApi(document.code, labels)
          .then(finishRequiredFieldSave)
          .catch(() => finishRequiredFieldSave({ requiredFieldLabels: labels }));
        return;
      }

      finishRequiredFieldSave({ requiredFieldLabels: labels });
    });
  }

  bindWorkspaceEvents();
  syncWorkspaceFromApi();
};

export const renderAccountantTemplateManagement = (app) => {
  renderAccountantShell({
    app,
    activePage: "templates",
    eyebrow: "",
    title: "서비스 관리",
    bodyHtml: renderTemplateManagementBody(
      requestTemplateRows,
      requestTemplateRows[0]?.code,
      buildInitialTemplateDocumentCodeMap(requestTemplateRows),
    ),
    onReady: (shellRoot) => attachTemplateManagementInteractions(shellRoot),
  });
};
