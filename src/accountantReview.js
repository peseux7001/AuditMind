import {
  componentClasses,
  cx,
  escapeHtml,
  getAccountantToneClass,
  getButtonClass,
  renderAccountantShell,
} from "./accountantShell.js";

const reviewItemsEndpoint = "/api/review-items";

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
    throw new Error(payload.error || "요청을 처리하지 못했습니다.");
  }
  return payload;
};

const fetchReviewItemsFromApi = async () => {
  const payload = await requestJson(reviewItemsEndpoint);
  return Array.isArray(payload.items) ? payload.items : [];
};

const updateReviewItemFromApi = async (itemId, payload) => {
  const result = await requestJson(`${reviewItemsEndpoint}/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return result.item;
};

const directRenderTypes = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const imageConvertTypes = new Set(["tiff", "tif", "heic", "heif"]);
const reviewColumnHeaderClass = "flex items-center justify-between gap-3 border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3";

const getRenderMode = (item) => {
  if (item.renderMode) return item.renderMode;
  if (item.fileType === "pdf") return "direct-pdf";
  if (directRenderTypes.has(item.fileType)) return "direct-image";
  if (imageConvertTypes.has(item.fileType)) return "converted-image";
  return "converted-pdf";
};

const getRenderBadgeLabel = (item) => {
  const mode = getRenderMode(item);
  if (mode === "direct-pdf") return "원본 PDF";
  if (mode === "direct-image") return "원본 이미지";
  if (mode === "converted-image") return "표시용 이미지";
  return "보기용 PDF";
};

const getPageAriaLabel = (item, pageNumber) => {
  const mode = getRenderMode(item);
  if (mode === "direct-image" || mode === "converted-image") return `이미지 ${pageNumber}페이지`;
  return `PDF ${pageNumber}페이지`;
};

const getRecognitionBoxClass = (confidence) => {
  if (confidence === "낮음" || confidence === "미확인") {
    return "border-[#d13438] bg-[#d13438]/[0.11]";
  }
  if (confidence === "중간") {
    return "border-[#b38600] bg-[#c19c00]/[0.12]";
  }
  return "border-[#0f6cbd] bg-[#4f9cf9]/[0.12]";
};

const getRecognitionColor = (confidence) => {
  if (confidence === "낮음" || confidence === "미확인") return "rgb(209 52 56 / 62%)";
  if (confidence === "중간") return "rgb(193 156 0 / 62%)";
  return "rgb(79 156 249 / 62%)";
};

const hasRenderableSourceRegion = (field, pageNumber) => {
  const region = field?.sourceRegion;
  if (!region || Number(region.page || 1) !== Number(pageNumber)) return false;
  const trustedSource = String(region.source || region.provider || region.origin || "").toLowerCase();
  if (!(trustedSource === "ocr" || trustedSource === "paddleocr" || trustedSource === "qwen" || region.verified === true)) return false;
  return ["x", "y", "width", "height"].every((key) => Number.isFinite(Number(region[key])));
};

const getRecognitionSourceClass = (region) => {
  const source = String(region?.source || "").toLowerCase();
  if (source === "qwen" && region?.verified !== true) {
    return "border-dashed";
  }
  return "border-solid";
};

const renderRecognitionOverlays = (item, pageNumber) => {
  const fieldsWithRegions = (item.fields || []).filter((field) => hasRenderableSourceRegion(field, pageNumber));
  if (!fieldsWithRegions.length) return "";

  return `
    <div class="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      ${fieldsWithRegions
        .map((field) => {
          const region = field.sourceRegion;
          return `
            <div class="${cx(
              "absolute rounded-[5px] border-[3px] opacity-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.88),0_0_0_1px_rgba(4,56,115,0.18),0_4px_12px_rgba(4,56,115,0.16)] backdrop-blur-[0.5px] transition-[opacity,box-shadow,transform,border-width] duration-150",
              getRecognitionBoxClass(field.confidence),
              getRecognitionSourceClass(region),
            )}" data-recognition-region="${escapeHtml(field.label)}" data-recognition-color="${escapeHtml(getRecognitionColor(field.confidence))}" title="${escapeHtml(field.label)}: ${escapeHtml(field.value || "미확인")} · ${region.verified === true ? "OCR 확정 위치" : "Qwen 추정 위치"}" style="left:${escapeHtml(region.x)}%;top:${escapeHtml(region.y)}%;width:${escapeHtml(region.width)}%;height:${escapeHtml(region.height)}%;"></div>
          `;
        })
        .join("")}
    </div>
  `;
};

const isFinishedStatus = (status) => ["검수완료", "접수완료", "최종 접수"].includes(status);
const isMissingStatus = (status) => ["미제출", "미접수", "not_received"].includes(status);
const isReviewableStatus = (status) => !["오류", "rejected"].includes(status);
const getReviewableItems = (items) => items.filter((item) => isReviewableStatus(item.status));

const getCompanyGroups = (items) =>
  items.reduce((groups, item) => {
    const key = `${item.company}__${item.serviceName}`;
    const existing = groups.find((group) => group.id === key);
    if (existing) existing.items.push(item);
    else groups.push({ id: key, company: item.company, serviceName: item.serviceName, deadline: item.deadline, receivedAt: item.receivedAt, items: [item] });
    return groups;
  }, []);

const getSortedCompanyGroups = (items, sortState) => {
  const groups = getCompanyGroups(items);
  const direction = sortState.direction === "asc" ? 1 : -1;
  return groups.sort((a, b) => {
    if (sortState.key === "company") return a.company.localeCompare(b.company, ["ko", "en"], { numeric: true }) * direction;
    if (sortState.key === "deadline") return a.deadline.localeCompare(b.deadline, ["ko", "en"], { numeric: true }) * direction;
    return a.receivedAt.localeCompare(b.receivedAt, ["ko", "en"], { numeric: true }) * direction;
  });
};

const getGroupMetrics = (group) => {
  const total = group.items.length;
  const finished = group.items.filter((item) => isFinishedStatus(item.status)).length;
  const remaining = total - finished;
  return {
    total,
    finished,
    remaining,
    progress: total ? Math.round((finished / total) * 100) : 0,
  };
};

const getSortedDocumentItems = (items, sortState) => {
  const direction = sortState.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortState.key === "status") return a.status.localeCompare(b.status, ["ko", "en"], { numeric: true }) * direction;
    return a.documentName.localeCompare(b.documentName, ["ko", "en"], { numeric: true }) * direction;
  });
};

const getPreferredReviewItem = (items, selectedId = "") =>
  items.find((item) => item.id === selectedId) ||
  items.find((item) => !isMissingStatus(item.status) && item.fileUrl) ||
  items.find((item) => !isMissingStatus(item.status)) ||
  items[0];

const renderCompanyDocumentRows = (items, selectedId, sortState) =>
  getSortedDocumentItems(items, sortState)
    .map(
      (item) => `
        <tr class="${cx("cursor-pointer bg-white transition-colors hover:bg-[#f7fbff]", item.id === selectedId ? "bg-[#eef6ff]" : "")}" data-review-document="${escapeHtml(item.id)}">
          <td class="px-3 py-2.5 align-middle">
            <button class="block max-w-full truncate text-left text-sm font-semibold text-[#2a2a2a]" type="button" data-select-review="${escapeHtml(item.id)}">${escapeHtml(item.documentName)}</button>
            <p class="mt-1 truncate text-xs text-[#717171]">${escapeHtml(isMissingStatus(item.status) ? "아직 제출된 파일이 없습니다." : item.fileName)}</p>
          </td>
          <td class="px-3 py-2.5 align-middle text-right"><span class="${cx(componentClasses.pill, getAccountantToneClass(item.tone))}">${escapeHtml(item.status)}</span></td>
        </tr>
      `,
    )
    .join("");

const getCustomerOptions = (groups) =>
  [...new Set(groups.map((group) => group.company))].map((company) => {
    const customerGroups = groups.filter((group) => group.company === company);
    const customerItems = customerGroups.flatMap((group) => group.items);
    const total = customerGroups.reduce((sum, group) => sum + group.items.length, 0);
    const remaining = customerGroups.reduce((sum, group) => sum + getGroupMetrics(group).remaining, 0);
    const submitted = total - remaining;
    const tone = submitted === 0 ? "danger" : submitted === total ? "success" : "warning";
    const requestedDates = customerItems.map((item) => item.requestedAt).filter(Boolean).sort();
    const deadlineDates = customerItems.map((item) => item.deadline).filter(Boolean).sort();
    return { company, total, remaining, submitted, tone, requestedAt: requestedDates[0] || "-", deadline: deadlineDates[0] || "-" };
  });

const customerSelectorGridClass = "grid grid-cols-[minmax(0,1fr)_104px_104px_64px] items-center gap-2 px-3";

const renderCustomerSelectorRows = (groups, selectedCompany) =>
  getCustomerOptions(groups)
    .map(
      (customer) => `
        <button class="${cx(
          customerSelectorGridClass,
          "w-full border-b border-[#e6e6e6] py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#f7fbff]",
          customer.company === selectedCompany ? "bg-[#eef6ff]" : "bg-white",
        )}" type="button" data-select-customer="${escapeHtml(customer.company)}">
          <span class="min-w-0 truncate text-sm font-semibold text-[#2a2a2a]">${escapeHtml(customer.company)}</span>
          <span class="text-center text-xs font-semibold tabular-nums text-[#616161]">${escapeHtml(customer.requestedAt)}</span>
          <span class="text-center text-xs font-semibold tabular-nums text-[#616161]">${escapeHtml(customer.deadline)}</span>
          <span class="${cx(componentClasses.pill, getAccountantToneClass(customer.tone), "min-w-[48px] justify-center justify-self-center")}">${escapeHtml(customer.submitted)} / ${escapeHtml(customer.total)}</span>
        </button>
      `,
    )
    .join("");

const renderCustomerSelectorHeader = () => `
  <div class="${cx(customerSelectorGridClass, "border-b border-[#e6e6e6] bg-[#fafafa] py-2 text-xs font-semibold text-[#616161]")}" role="row">
    <span role="columnheader">고객사</span>
    <span class="text-center" role="columnheader">제출요청일</span>
    <span class="text-center" role="columnheader">제출마감일</span>
    <span class="text-center" role="columnheader">제출</span>
  </div>
`;

const renderServiceSelectorRows = (groups, selectedGroupId, selectedCompany) =>
  groups
    .filter((group) => group.company === selectedCompany)
    .map((group) => {
      const metrics = getGroupMetrics(group);
      return `
        <button class="${cx(
          "flex w-full items-center justify-between gap-3 border-b border-[#e6e6e6] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#f7fbff]",
          group.id === selectedGroupId ? "bg-[#eef6ff]" : "bg-white",
        )}" type="button" data-select-service="${escapeHtml(group.id)}">
          <span class="min-w-0 truncate text-sm font-semibold text-[#2a2a2a]">${escapeHtml(group.serviceName)}</span>
          <span class="${cx(componentClasses.pill, getAccountantToneClass(metrics.remaining ? "warning" : "success"))}">${escapeHtml(metrics.progress)}%</span>
        </button>
      `;
    })
    .join("");

const renderImagePages = (item) => `
  <article class="mx-auto w-max shrink-0 snap-start" aria-label="${escapeHtml(getPageAriaLabel(item, 1))}">
    <div class="relative inline-block">
      <img class="block max-w-none rounded-sm border border-[#d1d1d1] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.18)]" src="${escapeHtml(item.fileUrl)}" alt="${escapeHtml(item.documentName)} 원본 이미지">
      ${renderRecognitionOverlays(item, 1)}
    </div>
  </article>
`;

const renderPdfDocument = (item) => `
  <article class="mx-auto h-[min(760px,calc(100vh-430px))] min-h-[520px] w-[min(980px,calc(100vw-520px))] min-w-[720px] shrink-0 snap-start rounded-sm bg-white shadow-[0_18px_48px_rgba(0,0,0,0.18)]" aria-label="${escapeHtml(getPageAriaLabel(item, 1))}">
    <object class="h-full w-full rounded-sm border border-[#d1d1d1] bg-white" data="${escapeHtml(item.fileUrl)}" type="application/pdf">
      <iframe class="h-full w-full rounded-sm border border-[#d1d1d1] bg-white" src="${escapeHtml(item.fileUrl)}" title="${escapeHtml(item.documentName)} PDF"></iframe>
    </object>
  </article>
`;

const renderUnavailableViewer = (message = "고객이 아직 파일을 제출하지 않았습니다.") => `
  <div class="flex min-h-full items-center justify-center p-8 text-center">
    <h4 class="text-lg font-semibold text-[#242424]">${escapeHtml(message)}</h4>
  </div>
`;

const renderFileViewer = (item) => `
  <div class="h-full min-h-0 snap-y snap-mandatory overflow-x-auto overflow-y-auto scroll-smooth bg-[#eef2f7]" aria-label="문서 스크롤 뷰어" data-document-viewer>
    ${
      isMissingStatus(item.status)
        ? renderUnavailableViewer()
        : !item.fileUrl
          ? renderUnavailableViewer("제출된 파일을 불러올 수 없습니다.")
          : `<div class="grid w-max min-w-full gap-8 p-6">
              ${getRenderMode(item) === "direct-image" || getRenderMode(item) === "converted-image" ? renderImagePages(item) : renderPdfDocument(item)}
            </div>`
    }
  </div>
`;

const sortKorean = (a, b) => a.localeCompare(b, "ko-KR");

const renderFieldRows = (fields, sortState) => {
  const sortedFields = [...fields].sort((a, b) => {
    if (sortState.key === "label") {
      return sortState.direction === "asc"
        ? sortKorean(a.label, b.label)
        : sortKorean(b.label, a.label);
    } else if (sortState.key === "value") {
      return sortState.direction === "asc"
        ? sortKorean(String(a.value || ""), String(b.value || ""))
        : sortKorean(String(b.value || ""), String(a.value || ""));
    } else {
      // confidence
      const confidenceOrder = { "높음": 3, "중간": 2, "낮음": 1, "미확인": 0 };
      return sortState.direction === "asc"
        ? (confidenceOrder[a.confidence] || 0) - (confidenceOrder[b.confidence] || 0)
        : (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0);
    }
  });

  if (!sortedFields.length) {
    return `
      <tr>
        <td class="px-3 py-5 text-center text-[#717171]" colspan="3">제출된 파일이 없어 확인할 항목이 없습니다.</td>
      </tr>
    `;
  }

  const formatConfidenceLabel = (confidence) => (confidence === "미확인" ? "확인 필요" : confidence);

  return sortedFields
    .map(
      (field) => `
        <tr class="cursor-pointer border-b border-[#e6e6e6] transition-colors last:border-b-0 hover:bg-[#f7fbff]" data-field-row="${escapeHtml(field.label)}" tabindex="0">
          <td class="px-3 py-3 text-[#616161]">${escapeHtml(field.label)}</td>
          <td class="px-3 py-3 font-semibold text-[#2a2a2a]">${escapeHtml(field.value || "미확인")}</td>
          <td class="px-3 py-3"><span class="${cx(componentClasses.pill, getAccountantToneClass(field.confidence === "미확인" || field.confidence === "낮음" ? "danger" : field.confidence === "중간" ? "warning" : "success"))}">${escapeHtml(formatConfidenceLabel(field.confidence))}</span></td>
        </tr>
      `,
    )
    .join("");
};

const renderReviewNotes = (item) => `
  <section class="mt-4 grid gap-3">
    <label class="block">
      <span class="text-xs font-semibold text-[#616161]">메모</span>
      <textarea class="mt-1 min-h-24 w-full resize-y rounded-md border border-[#d1d1d1] bg-white px-3 py-2 text-sm leading-6 text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20" data-review-note="internalMemo" placeholder="내부 검토 기록을 입력하세요.">${escapeHtml(item.internalMemo || "")}</textarea>
    </label>
    <label class="block">
      <span class="text-xs font-semibold text-[#616161]">고객에게 보낼 코멘트</span>
      <textarea class="mt-1 min-h-24 w-full resize-y rounded-md border border-[#d1d1d1] bg-white px-3 py-2 text-sm leading-6 text-[#242424] focus:border-[#6264a7] focus:outline-none focus:ring-2 focus:ring-[#6264a7]/20" data-review-note="customerComment" placeholder="재요청시 고객 자료제출포털에 표시할 코멘트를 입력하세요.">${escapeHtml(item.customerComment || "")}</textarea>
    </label>
  </section>
`;

const getGroupCustomerRequestMessage = (group) =>
  group.items.find((item) => String(item.customerRequestMessage || "").trim())?.customerRequestMessage || "";

const renderCustomerRequestCard = (group) => `
  <section class="${cx(componentClasses.surface, "overflow-hidden")}" aria-label="고객 요청사항">
    <div class="border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3">
      <h3 class="text-sm font-semibold text-[#2a2a2a]">고객 요청사항</h3>
    </div>
    <div class="max-h-44 overflow-y-auto p-4">
      <p class="whitespace-pre-wrap text-sm leading-6 text-[#2a2a2a]">${escapeHtml(
        getGroupCustomerRequestMessage(group) || "고객이 제출한 요청사항이 없습니다.",
      )}</p>
    </div>
  </section>
`;

const getFieldJudgmentSummary = (fields = []) => {
  if (!fields.length) return "아직 제출된 파일이 없어 확인할 필수 항목이 없습니다.";
  const missing = fields.filter((field) => !field.value || field.value === "미확인" || field.confidence === "미확인" || field.confidence === "낮음");
  const uncertain = fields.filter((field) => field.confidence === "중간");

  if (missing.length) {
    return `${missing.map((field) => field.label).join(", ")} 항목이 확인되지 않았습니다. 나머지 필수 항목은 확인되었습니다.`;
  }
  if (uncertain.length) {
    return `${uncertain.map((field) => field.label).join(", ")} 항목은 원본 대조가 필요합니다. 나머지 필수 항목은 확인되었습니다.`;
  }
  return "모든 필수 항목의 내용과 신뢰도가 확인되었습니다.";
};

const renderReviewPanel = (item, sortState) => `
  <section class="${cx(componentClasses.surface, "flex min-h-0 flex-col overflow-hidden")}" aria-labelledby="review-panel-title">
    <div class="${reviewColumnHeaderClass}">
      <h3 id="review-panel-title" class="truncate text-base font-semibold text-[#2a2a2a]">${escapeHtml(item.documentName)}</h3>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4" data-review-panel-scroll>
      <section class="rounded-lg border border-[#e6e6e6] bg-white">
        <table class="w-full table-fixed border-collapse text-left text-xs">
          <thead class="border-b border-[#e6e6e6] bg-[#fafafa] text-[#616161]">
            <tr>
              <th class="w-[34%] px-3 py-2 font-semibold cursor-pointer hover:bg-[#eef6ff]" data-field-sort="label" aria-label="항목 정렬">
                항목<span class="ml-1">${sortState.key === "label" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</span>
              </th>
              <th class="w-[44%] px-3 py-2 font-semibold cursor-pointer hover:bg-[#eef6ff]" data-field-sort="value" aria-label="내용 정렬">
                내용<span class="ml-1">${sortState.key === "value" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</span>
              </th>
              <th class="w-[22%] px-3 py-2 font-semibold cursor-pointer hover:bg-[#eef6ff]" data-field-sort="confidence" aria-label="신뢰도 정렬">
                신뢰도<span class="ml-1">${sortState.key === "confidence" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</span>
              </th>
            </tr>
          </thead>
          <tbody>${renderFieldRows(item.fields, sortState)}</tbody>
        </table>
      </section>
      ${renderReviewNotes(item)}
    </div>
    <div class="border-t border-[#e6e6e6] bg-[#fafafa] p-4">
      <button class="${getButtonClass({ variant: "secondary", size: "full" })} border-[#f1b8be] text-[#a4262c] hover:bg-[#fff4f5]" type="button" data-review-action="rejected" ${isMissingStatus(item.status) ? "disabled" : ""}>재요청</button>
    </div>
  </section>
`;

const renderReviewBody = (items, selectedId, reviewSortState, documentSortState, fieldSortState) => {
  const reviewableItems = getReviewableItems(items);
  const companyGroups = getSortedCompanyGroups(reviewableItems, reviewSortState);
  if (!companyGroups.length) {
    return `
      <section class="${cx(componentClasses.surface, "flex min-h-[calc(100vh-160px)] items-center justify-center p-8 text-center")}" aria-label="제출자료 검토 빈 상태">
        <div>
          <h3 class="text-lg font-semibold text-[#242424]">검토할 제출자료가 없습니다.</h3>
          <p class="mt-2 text-sm leading-6 text-[#616161]">
            고객에게 되돌아간 오류 자료는 이 화면에 표시하지 않습니다.
          </p>
        </div>
      </section>
    `;
  }
  const selectedItemCandidate = items.find((item) => item.id === selectedId);
  const selectedCompanyIdCandidate = selectedItemCandidate ? `${selectedItemCandidate.company}__${selectedItemCandidate.serviceName}` : companyGroups[0]?.id;
  const selectedGroup =
    companyGroups.find((group) => group.id === selectedCompanyIdCandidate) ||
    getCompanyGroups(reviewableItems).find((group) => group.id === selectedCompanyIdCandidate) ||
    companyGroups[0] ||
    getCompanyGroups(reviewableItems)[0];
  const selectedItem = getPreferredReviewItem(selectedGroup.items, selectedId);
  return `
    <section class="grid gap-4 overflow-visible xl:h-[calc(100vh-130px)] xl:min-h-[620px] xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <section class="grid gap-4 xl:grid-cols-[minmax(420px,1.15fr)_minmax(240px,0.85fr)_minmax(260px,0.9fr)]">
        <section class="${cx(componentClasses.surface, "overflow-hidden")}" aria-label="고객사 선택">
          <div class="border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3">
            <h3 class="text-sm font-semibold text-[#2a2a2a]">고객사 선택</h3>
          </div>
          ${renderCustomerSelectorHeader()}
          <div class="max-h-44 overflow-y-auto">
            ${renderCustomerSelectorRows(companyGroups, selectedGroup.company)}
          </div>
        </section>

        <section class="${cx(componentClasses.surface, "overflow-hidden")}" aria-label="서비스 선택">
          <div class="border-b border-[#e6e6e6] bg-[#fafafa] px-4 py-3">
            <h3 class="text-sm font-semibold text-[#2a2a2a]">서비스 선택</h3>
          </div>
          <div class="max-h-44 overflow-y-auto">${renderServiceSelectorRows(companyGroups, selectedGroup.id, selectedGroup.company)}</div>
        </section>

        ${renderCustomerRequestCard(selectedGroup)}
      </section>

      <section class="grid min-h-0 gap-4 overflow-visible xl:grid-cols-[minmax(280px,0.74fr)_minmax(620px,1.9fr)_minmax(340px,0.9fr)] xl:overflow-hidden">
      <section class="${cx(componentClasses.surface, "flex min-h-0 flex-col overflow-hidden xl:h-full")}" aria-label="선택된 자료 목록">
        <div class="${reviewColumnHeaderClass}">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold text-[#2a2a2a]">자료 목록</h3>
          </div>
        </div>
        <div class="shrink-0 border-b border-[#e6e6e6] bg-[#fafafa]">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            <thead class="text-xs font-semibold text-[#616161]">
              <tr class="border-b border-[#e6e6e6]">
                <th class="w-[68%] cursor-pointer px-3 py-2 font-semibold hover:bg-[#eef6ff]" role="columnheader" data-document-sort="documentName" aria-label="자료 정렬">
                  자료<span class="ml-1">${documentSortState.key === "documentName" ? (documentSortState.direction === "asc" ? "↑" : "↓") : ""}</span>
                </th>
                <th class="w-[32%] cursor-pointer px-3 py-2 text-right font-semibold hover:bg-[#eef6ff]" role="columnheader" data-document-sort="status" aria-label="상태 정렬">
                  상태<span class="ml-1">${documentSortState.key === "status" ? (documentSortState.direction === "asc" ? "↑" : "↓") : ""}</span>
                </th>
              </tr>
            </thead>
          </table>
        </div>
        <div class="min-h-0 max-h-[420px] overflow-y-auto xl:max-h-none xl:flex-1">
          <table class="w-full table-fixed border-collapse text-left text-xs">
            <tbody class="divide-y divide-[#e6e6e6]">${renderCompanyDocumentRows(selectedGroup.items, selectedItem.id, documentSortState)}</tbody>
          </table>
        </div>
      </section>

      <section class="${cx(componentClasses.surface, "flex min-h-0 flex-col overflow-hidden xl:h-full")}" aria-labelledby="file-viewer-title">
        <div class="${reviewColumnHeaderClass}">
          <div class="min-w-0">
            <h3 id="file-viewer-title" class="truncate text-base font-semibold text-[#2a2a2a]">선택 자료</h3>
          </div>
          <span class="${cx(componentClasses.pill, getAccountantToneClass("primary"))}">${escapeHtml(selectedItem.fileType.toUpperCase())}</span>
        </div>
        <div class="min-h-0 flex-1 overflow-hidden">${renderFileViewer(selectedItem)}</div>
      </section>

      ${renderReviewPanel(selectedItem, fieldSortState)}
      </section>
    </section>
  `;
};

const renderReviewLoading = () => `
  <section class="${cx(componentClasses.surface, "flex min-h-[calc(100vh-160px)] items-center justify-center p-8 text-center")}" aria-label="제출자료 검토 로딩">
    <div>
      <h3 class="text-lg font-semibold text-[#242424]">저장된 검토 결과를 불러오는 중입니다.</h3>
      <p class="mt-2 text-sm leading-6 text-[#616161]">이 화면에서는 OCR, Qwen 분석, 파일 변환을 새로 실행하지 않습니다.</p>
    </div>
  </section>
`;


const attachReviewInteractions = (app) => {
  let items = [];
  let selectedId = "";
  let reviewSortState = { key: "company", direction: "asc" };
  let documentSortState = { key: "documentName", direction: "asc" };
  let fieldSortState = { key: "label", direction: "asc" };
  let activeFieldLabel = "";

  const rerenderWorkspace = () => {
    const main = app.querySelector("main");
    if (!main) return;
    main.innerHTML = renderReviewBody(items, selectedId, reviewSortState, documentSortState, fieldSortState);
    bindWorkspaceEvents();
  };

  function bindWorkspaceEvents() {
    const clearRecognitionConnector = () => {
      app.querySelector("[data-recognition-connector]")?.remove();
    };

    const setRegionHighlighted = (fieldLabel, isActive) => {
      app.querySelectorAll(`[data-recognition-region="${CSS.escape(fieldLabel)}"]`).forEach((region) => {
        region.classList.toggle("opacity-100", isActive);
        region.classList.toggle("scale-[1.015]", isActive);
        region.classList.toggle("ring-2", isActive);
        region.classList.toggle("ring-[#043873]/45", isActive);
        region.classList.toggle("ring-offset-1", isActive);
        region.classList.toggle("shadow-[0_0_0_2px_rgba(255,255,255,0.9),0_8px_22px_rgba(4,56,115,0.18)]", isActive);
      });
    };

    const clearAllRegionHighlights = () => {
      app.querySelectorAll("[data-recognition-region]").forEach((region) => {
        region.classList.remove(
          "opacity-100",
          "scale-[1.015]",
          "ring-2",
          "ring-[#043873]/45",
          "ring-offset-1",
          "shadow-[0_0_0_2px_rgba(255,255,255,0.9),0_8px_22px_rgba(4,56,115,0.18)]",
        );
      });
      app.querySelectorAll("[data-field-row]").forEach((row) => row.classList.remove("bg-[#eef6ff]"));
    };

    const drawRecognitionConnector = (fieldLabel) => {
      clearRecognitionConnector();
      const row = app.querySelector(`[data-field-row="${CSS.escape(fieldLabel)}"]`);
      const region = app.querySelector(`[data-recognition-region="${CSS.escape(fieldLabel)}"]`);
      if (!row || !region) return;

      const rowRect = row.getBoundingClientRect();
      const regionRect = region.getBoundingClientRect();
      const viewerRect = app.querySelector("[data-document-viewer]")?.getBoundingClientRect();
      const rowPanelRect = app.querySelector("[data-review-panel-scroll]")?.getBoundingClientRect();
      const isRectVisibleIn = (rect, containerRect) =>
        containerRect &&
        rect.right > containerRect.left &&
        rect.left < containerRect.right &&
        rect.bottom > containerRect.top &&
        rect.top < containerRect.bottom;
      if (!isRectVisibleIn(regionRect, viewerRect) || !isRectVisibleIn(rowRect, rowPanelRect)) return;

      const connectorColor = region.dataset.recognitionColor || "rgb(79 156 249 / 62%)";
      const startX = rowRect.left + 4;
      const startY = rowRect.top + rowRect.height / 2;
      const endX = regionRect.right;
      const endY = regionRect.top + regionRect.height / 2;
      const controlOffset = Math.max(56, Math.min(180, Math.abs(startX - endX) * 0.22));
      const pathData = `M ${startX} ${startY} C ${startX - controlOffset} ${startY}, ${endX + controlOffset} ${endY}, ${endX} ${endY}`;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

      svg.setAttribute("data-recognition-connector", "");
      svg.setAttribute("class", "pointer-events-none fixed inset-0 z-[60] h-screen w-screen");
      svg.setAttribute("aria-hidden", "true");
      path.setAttribute("d", pathData);
      path.setAttribute("class", "auditmind-flowing-dash");
      path.style.stroke = connectorColor;
      svg.append(path);
      app.append(svg);
    };

    const drawRecognitionConnectorAfterScroll = (fieldLabel) => {
      drawRecognitionConnector(fieldLabel);
      window.setTimeout(() => drawRecognitionConnector(fieldLabel), 180);
      window.setTimeout(() => drawRecognitionConnector(fieldLabel), 360);
      window.setTimeout(() => drawRecognitionConnector(fieldLabel), 700);
      window.setTimeout(() => drawRecognitionConnector(fieldLabel), 1050);
    };

    const redrawActiveConnector = () => {
      if (!activeFieldLabel) return;
      window.requestAnimationFrame(() => drawRecognitionConnector(activeFieldLabel));
    };

    const scrollRegionIntoView = (fieldLabel) => {
      const viewer = app.querySelector("[data-document-viewer]");
      const region = app.querySelector(`[data-recognition-region="${CSS.escape(fieldLabel)}"]`);
      if (!viewer || !region) return;

      const viewerRect = viewer.getBoundingClientRect();
      const regionRect = region.getBoundingClientRect();
      const targetLeft =
        viewer.scrollLeft + (regionRect.left - viewerRect.left) + regionRect.width / 2 - viewer.clientWidth / 2;
      const targetTop =
        viewer.scrollTop + (regionRect.top - viewerRect.top) + regionRect.height / 2 - viewer.clientHeight / 2;

      viewer.scrollTo({
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    };

    const activateFieldRegion = (fieldLabel) => {
      activeFieldLabel = fieldLabel;
      clearAllRegionHighlights();
      const row = app.querySelector(`[data-field-row="${CSS.escape(fieldLabel)}"]`);
      row?.classList.add("bg-[#eef6ff]");
      setRegionHighlighted(fieldLabel, true);
      scrollRegionIntoView(fieldLabel);
      drawRecognitionConnectorAfterScroll(fieldLabel);
    };

    app.querySelectorAll("[data-select-review]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedId = button.dataset.selectReview;
        activeFieldLabel = "";
        clearRecognitionConnector();
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-select-customer]").forEach((button) => {
      button.addEventListener("click", () => {
        const group = getSortedCompanyGroups(getReviewableItems(items), reviewSortState).find((candidate) => candidate.company === button.dataset.selectCustomer);
        selectedId = group?.items[0]?.id || selectedId;
        activeFieldLabel = "";
        clearRecognitionConnector();
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-select-service]").forEach((button) => {
      button.addEventListener("click", () => {
        const group = getCompanyGroups(getReviewableItems(items)).find((candidate) => candidate.id === button.dataset.selectService);
        selectedId = group?.items[0]?.id || selectedId;
        activeFieldLabel = "";
        clearRecognitionConnector();
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-review-document]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a, select, textarea")) return;
        selectedId = row.dataset.reviewDocument;
        activeFieldLabel = "";
        clearRecognitionConnector();
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-review-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = items.find((candidate) => candidate.id === selectedId);
        if (!item) return;
        if (button.dataset.reviewAction === "rejected") {
          const removedId = item.id;
          const currentCustomerComment =
            app.querySelector('[data-review-note="customerComment"]')?.value ?? item.customerComment ?? "";
          const currentInternalMemo =
            app.querySelector('[data-review-note="internalMemo"]')?.value ?? item.internalMemo ?? "";
          item.customerComment = currentCustomerComment;
          item.internalMemo = currentInternalMemo;
          const remainingItems = getReviewableItems(items.filter((candidate) => candidate.id !== removedId));
          items = remainingItems;
          selectedId = remainingItems[0]?.id || "";
          updateReviewItemFromApi(item.id, {
            status: "rejected",
            internalMemo: currentInternalMemo,
            customerComment: currentCustomerComment,
          }).catch(() => {});
        }
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-review-note]").forEach((field) => {
      field.addEventListener("input", () => {
        const item = items.find((candidate) => candidate.id === selectedId);
        if (!item) return;
        item[field.dataset.reviewNote] = field.value;
      });
      field.addEventListener("change", () => {
        const item = items.find((candidate) => candidate.id === selectedId);
        if (!item) return;
        updateReviewItemFromApi(item.id, {
          internalMemo: item.internalMemo,
          customerComment: item.customerComment,
        }).catch(() => {});
      });
    });

    // Document list sort interaction (left panel)
    app.querySelectorAll("[data-document-sort]").forEach((header) => {
      header.addEventListener("click", () => {
        const key = header.dataset.documentSort;
        if (documentSortState.key === key) {
          documentSortState = { key, direction: documentSortState.direction === "asc" ? "desc" : "asc" };
        } else {
          documentSortState = { key, direction: "asc" };
        }
        rerenderWorkspace();
      });
    });

    // Required field sort interaction (right panel)
    app.querySelectorAll("[data-field-sort]").forEach((header) => {
      header.addEventListener("click", () => {
        const key = header.dataset.fieldSort;
        if (fieldSortState.key === key) {
          fieldSortState = { key, direction: fieldSortState.direction === "asc" ? "desc" : "asc" };
        } else {
          fieldSortState = { key, direction: key === "label" ? "asc" : "asc" };
        }
        rerenderWorkspace();
      });
    });

    app.querySelectorAll("[data-field-row]").forEach((row) => {
      const fieldLabel = row.dataset.fieldRow;
      row.addEventListener("mouseenter", () => {
        setRegionHighlighted(fieldLabel, true);
        scrollRegionIntoView(fieldLabel);
        drawRecognitionConnectorAfterScroll(fieldLabel);
      });
      row.addEventListener("mouseleave", () => {
        if (activeFieldLabel === fieldLabel) return;
        setRegionHighlighted(fieldLabel, false);
        clearRecognitionConnector();
      });
      row.addEventListener("focusin", () => {
        setRegionHighlighted(fieldLabel, true);
        scrollRegionIntoView(fieldLabel);
        drawRecognitionConnectorAfterScroll(fieldLabel);
      });
      row.addEventListener("focusout", () => {
        if (activeFieldLabel === fieldLabel) return;
        setRegionHighlighted(fieldLabel, false);
        clearRecognitionConnector();
      });
      row.addEventListener("click", () => activateFieldRegion(fieldLabel));
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activateFieldRegion(fieldLabel);
      });
    });

    if (activeFieldLabel) activateFieldRegion(activeFieldLabel);

    app.querySelector("[data-document-viewer]")?.addEventListener("scroll", redrawActiveConnector, { passive: true });
    app.querySelector("[data-review-panel-scroll]")?.addEventListener("scroll", redrawActiveConnector, { passive: true });
    window.addEventListener("resize", redrawActiveConnector, { passive: true });
  }

  bindWorkspaceEvents();

  fetchReviewItemsFromApi()
    .then((apiItems) => {
      items = getReviewableItems(apiItems);
      selectedId = items[0]?.id || "";
      rerenderWorkspace();
    })
    .catch(() => {});
};

export const renderAccountantReview = (app) => {
  renderAccountantShell({
    app,
    activePage: "review",
    eyebrow: "",
    title: "제출자료 검토",
    bodyHtml: renderReviewLoading(),
    onReady: (shellRoot) => attachReviewInteractions(shellRoot),
  });
};
