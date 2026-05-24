import { accountantConsoleContent } from "./accountantConsoleContent.js";
import {
  componentClasses,
  cx,
  escapeHtml,
  getAccountantToneClass,
  renderAccountantShell,
} from "./accountantShell.js";

const renderCustomerHoverBubble = ({ bubbleText, customers, title, tone, titleDataAttribute = "" }) => `
  <div class="group relative inline-flex">
    <button class="${cx(componentClasses.pill, getAccountantToneClass(tone), "min-h-7 cursor-default px-3 text-sm")}" type="button" aria-describedby="${escapeHtml(title)}" data-summary-bubble>
      ${escapeHtml(bubbleText)}
    </button>
    <div class="pointer-events-none absolute right-0 top-9 z-20 hidden w-64 rounded-lg border border-[#dde6f0] bg-white p-3 text-left shadow-[0_12px_32px_rgba(0,0,0,0.14)] group-hover:block">
      <p class="text-xs font-semibold text-[#717171]" ${titleDataAttribute}>${escapeHtml(title)}</p>
      <ul class="mt-2 grid gap-1.5">
        ${customers.map((customer) => `<li class="truncate text-sm font-semibold text-[#2a2a2a]">${escapeHtml(customer)}</li>`).join("")}
      </ul>
    </div>
  </div>
`;

const renderSummaryHelper = (item) => {
  const helperText = item.helper || `${item.value || 0}개사`;

  if (item.dueCustomers?.length) {
    return renderCustomerHoverBubble({
      bubbleText: `${item.dueCustomers.length}개사`,
      customers: item.dueCustomers,
      title: `마감 ${item.alertDays || 5}일 이내 미제출`,
      tone: "primary",
      titleDataAttribute: "data-due-threshold-label",
    });
  }

  if (item.customers?.length) {
    return renderCustomerHoverBubble({
      bubbleText: helperText,
      customers: item.customers,
      title: item.hoverTitle || item.label,
      tone: "primary",
    });
  }

  return `<span class="${cx(componentClasses.pill, getAccountantToneClass("primary"), "min-h-7 px-3 text-sm")}">${escapeHtml(helperText)}</span>`;
};

const formatReceivedAt = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const getQueueRows = (items, sortState) => {
  const direction = sortState.direction === "asc" ? 1 : -1;
  const sortedItems = [...items].sort((a, b) => {
    if (sortState.key === "company") {
      return a.company.localeCompare(b.company, ["ko", "en"], { numeric: true }) * direction;
    }

    if (sortState.key === "deadline") {
      return (new Date(a.deadlineSort).getTime() - new Date(b.deadlineSort).getTime()) * direction;
    }

    return (new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()) * direction;
  });

  return sortedItems
    .map(
      (item, index) => `
        <tr class="${index === 0 ? "bg-[#fffafa]" : "bg-white"} hover:bg-[#f7fbff]">
          <td class="px-4 py-3 font-semibold text-[#2a2a2a]">${escapeHtml(item.company)}</td>
          <td class="max-w-[220px] px-4 py-3 text-[#616161]">${escapeHtml(item.request)}</td>
          <td class="px-4 py-3 font-semibold text-[#2a2a2a]">${escapeHtml(item.document)}</td>
          <td class="px-4 py-3 text-[#616161]">${escapeHtml(formatReceivedAt(item.receivedAt))}</td>
          <td class="px-4 py-3 text-center">
            <span class="${cx(
              componentClasses.pill,
              getAccountantToneClass(item.status === "검토 주의" ? "warning" : "success"),
            )}">${escapeHtml(item.status)}</span>
          </td>
          <td class="px-4 py-3 text-[#616161]">${escapeHtml(item.deadline)}</td>
        </tr>
      `,
    )
    .join("");
};

const getSortButtonClass = ({ active }) =>
  cx(
    componentClasses.filterButton,
    active ? "bg-white font-semibold text-[#2a2a2a] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#616161]",
  );

const renderDashboardBody = (summaryItems, queueItems, sortState) => `
  <section class="grid gap-3 md:grid-cols-3" aria-label="검토 요약">
    ${summaryItems
      .map(
        (item) => `
          <article class="${cx(componentClasses.surface, "p-4")}">
            <div class="flex items-start justify-between gap-3">
              <p class="text-xs font-semibold text-[#616161]">${escapeHtml(item.label)}</p>
            </div>
            <div class="mt-2 flex items-end justify-between gap-3">
              <strong class="text-3xl font-semibold text-[#242424]">${escapeHtml(item.value)}</strong>
              ${renderSummaryHelper(item)}
            </div>
          </article>
        `,
      )
      .join("")}
  </section>

  <section class="grid gap-4">
    <section class="${cx(componentClasses.surface, "overflow-hidden")}" aria-labelledby="accountant-queue-title">
      <div class="flex flex-col gap-3 border-b border-[#e6e6e6] p-4 md:flex-row md:items-center md:justify-between">
        <h3 id="accountant-queue-title" class="text-base font-semibold text-[#2a2a2a]">검토 대기자료</h3>
        <div class="${componentClasses.filterGroup}" aria-label="검토 대기자료 정렬">
          <button class="${getSortButtonClass({ active: false })}" type="button" data-queue-sort="company" aria-pressed="false">고객사별</button>
          <button class="${getSortButtonClass({ active: true })}" type="button" data-queue-sort="received" aria-pressed="true">접수순</button>
          <button class="${getSortButtonClass({ active: false })}" type="button" data-queue-sort="deadline" aria-pressed="false">마감임박순</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead class="bg-[#fafafa] text-xs font-semibold text-[#616161]">
            <tr>
              <th class="px-4 py-3">고객사</th>
              <th class="px-4 py-3">서비스명</th>
              <th class="px-4 py-3">자료명</th>
              <th class="px-4 py-3">접수 일시</th>
              <th class="px-4 py-3 text-center">상태</th>
              <th class="px-4 py-3">마감</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#e6e6e6]" data-queue-body>
            ${getQueueRows(queueItems, sortState)}
          </tbody>
        </table>
      </div>
    </section>
  </section>
`;

const attachDashboardInteractions = (app, queueItems, sortStateRef) => {
  const queueBody = app.querySelector("[data-queue-body]");
  const queueSortButtons = app.querySelectorAll("[data-queue-sort]");
  let sortState = sortStateRef;

  const updateQueueSortButtons = () => {
    queueSortButtons.forEach((button) => {
      const isActive = button.dataset.queueSort === sortState.key;
      button.className = getSortButtonClass({ active: isActive });
      button.setAttribute("aria-pressed", String(isActive));
      button.dataset.sortDirection = isActive ? sortState.direction : "";
    });
  };

  const renderSortedQueue = () => {
    if (queueBody) queueBody.innerHTML = getQueueRows(queueItems, sortState);
    updateQueueSortButtons();
  };

  app.querySelectorAll("[data-summary-bubble]").forEach((button) =>
    button.addEventListener("click", () => {
      button.blur();
    }),
  );

  queueSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.queueSort;
      if (sortState.key === key) {
        sortState = { key, direction: sortState.direction === "desc" ? "asc" : "desc" };
      } else {
        sortState = { key, direction: key === "received" ? "desc" : "asc" };
      }
      renderSortedQueue();
    });
  });
};

export const renderAccountantConsole = (app) => {
  let summaryItems = accountantConsoleContent.summary;
  let queueItems = accountantConsoleContent.queue;
  const sortState = { key: "received", direction: "desc" };

  renderAccountantShell({
    app,
    activePage: "dashboard",
    eyebrow: "",
    title: "대시보드",
    bodyHtml: renderDashboardBody(summaryItems, queueItems, sortState),
    onReady: (shellRoot) => {
      const attach = () => attachDashboardInteractions(shellRoot, queueItems, sortState);
      fetch("/api/dashboard")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload) {
            attach();
            return;
          }
          summaryItems = Array.isArray(payload.summary) ? payload.summary : summaryItems;
          queueItems = Array.isArray(payload.queue) ? payload.queue : queueItems;
          const main = shellRoot.querySelector("main");
          if (main) main.innerHTML = renderDashboardBody(summaryItems, queueItems, sortState);
          attachDashboardInteractions(shellRoot, queueItems, sortState);
        })
        .catch(() => attach());
    },
  });
};
