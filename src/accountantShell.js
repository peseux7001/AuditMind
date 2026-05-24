export const cx = (...classes) => classes.filter(Boolean).join(" ");

export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const componentClasses = {
  surface: "rounded-lg border border-[#dde6f0] bg-white shadow-[0_1px_2px_rgba(4,56,115,0.06)]",
  buttonBase:
    "inline-flex items-center justify-center rounded-md border font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6264a7] disabled:cursor-not-allowed disabled:border-[#d1d1d1] disabled:bg-[#f3f2f1] disabled:text-[#a0a0a0] disabled:hover:bg-[#f3f2f1] disabled:active:bg-[#f3f2f1]",
  buttonSizes: {
    md: "h-9 min-w-[104px] px-3 text-sm",
    full: "h-9 w-full px-3 text-sm",
  },
  buttonVariants: {
    primary: "border-[#4f9cf9] bg-[#4f9cf9] text-white hover:bg-[#3188ee] active:bg-[#1976d2]",
    secondary: "border-[#d1d1d1] bg-white text-[#424242] hover:bg-[#fafafa] active:bg-[#f3f2f1]",
  },
  pill: "inline-flex min-h-6 items-center rounded-full px-2 text-xs font-semibold",
  filterGroup: "inline-flex w-fit rounded-lg bg-[#f3f2f1] p-[3px]",
  filterButton:
    "h-8 rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6264a7]",
  iconButton:
    "inline-flex size-7 items-center justify-center rounded-md border border-[#d1d1d1] bg-white text-[#616161] transition-colors hover:bg-[#fafafa] hover:text-[#242424] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6264a7]",
};

export const getButtonClass = ({ variant = "secondary", size = "md" } = {}) =>
  cx(componentClasses.buttonBase, componentClasses.buttonSizes[size], componentClasses.buttonVariants[variant]);

export const getAccountantToneClass = (tone) => {
  const classes = {
    primary: "border-[#dbe8f6] bg-[#f7fbff] text-[#043873]",
    warning: "border-[#f2dd8d] bg-[#fff9df] text-[#8a6100]",
    danger: "border-[#f1b8be] bg-[#fff4f5] text-[#a4262c]",
    success: "border-[#c9e7ca] bg-[#f3fbf3] text-[#107c10]",
    neutral: "border-[#d1d1d1] bg-[#f7f7f7] text-[#616161]",
  };

  return classes[tone] || classes.neutral;
};

const shellContent = {
  brand: {
    eyebrow: "AuditMind",
    title: "자료 검토 콘솔",
    firmName: "AuditMind 파트너스",
    userName: "데모 계정",
    logoImage: "/brand/auditmind-logo.png",
    logoAlt: "AuditMind",
  },
  nav: [
    { label: "대시보드", href: "/", page: "dashboard", count: "" },
    { label: "고객사 관리", href: "/?page=customers", page: "customers", count: "" },
    { label: "자료제출 요청", href: "/?page=submission-requests", page: "submission-requests", count: "" },
    { label: "제출자료 검토", href: "/?page=review", page: "review", count: "" },
    { label: "서비스 관리", href: "/?page=templates", page: "templates", count: "" },
    { label: "자료 제출 페이지 (고객용 데모)", href: "/submit/demo-token", page: "customer-test", count: "" },
  ],
  notifications: [
    {
      type: "자료 접수",
      title: "샘플테크 주식회사",
      detail: "통장 입금 내역",
      receivedAt: Date.now() - 35 * 1000,
    },
    {
      type: "자료 접수",
      title: "브릿지AI",
      detail: "PG 정산자료",
      receivedAt: Date.now() - 3 * 60 * 1000,
    },
    {
      type: "자료 접수",
      title: "오르빗헬스",
      detail: "부가세 신고서",
      receivedAt: Date.now() - 7 * 60 * 1000,
    },
    {
      type: "자료 접수",
      title: "루멘커머스",
      detail: "주요 매출계약서",
      receivedAt: Date.now() - 11 * 60 * 1000,
    },
  ],
};

let timestampTimer;

const getLatestSubmissionPortalUrl = () => {
  try {
    return window.localStorage.getItem("auditmind.latestSubmissionPortalUrl") || "/submit/demo-token";
  } catch {
    return "/submit/demo-token";
  }
};

const getNotificationTimeValue = (value) => {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const formatNotificationTime = (value, now = Date.now()) => {
  const receivedAt = getNotificationTimeValue(value);
  const diffSeconds = Math.max(0, Math.floor((now - receivedAt) / 1000));
  if (diffSeconds < 60) return "방금 전";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  const receivedDate = new Date(receivedAt);
  const month = String(receivedDate.getMonth() + 1).padStart(2, "0");
  const day = String(receivedDate.getDate()).padStart(2, "0");
  return `${month}-${day}`;
};

const renderNotificationItem = (item) => `
  <article class="border-b border-[#f0f0f0] px-4 py-3 last:border-b-0" data-notification-item>
    <div class="flex items-start justify-between gap-3">
      <span class="${cx(componentClasses.pill, getAccountantToneClass("primary"))}">${escapeHtml(item.type)}</span>
      <span class="shrink-0 text-xs text-[#717171]" data-notification-time data-received-at="${escapeHtml(getNotificationTimeValue(item.receivedAt || item.time))}">${escapeHtml(formatNotificationTime(item.receivedAt || item.time))}</span>
    </div>
    <p class="mt-2 text-sm font-semibold leading-5 text-[#2a2a2a]">${escapeHtml(item.title)}</p>
    <p class="mt-1 text-xs leading-5 text-[#616161]">${escapeHtml(item.detail)}</p>
  </article>
`;

const renderNotifications = () => `
  <div class="relative" data-notification-root>
    <button class="relative inline-flex size-9 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" type="button" data-notification-toggle aria-label="알림 열기" aria-expanded="false">
      <svg aria-hidden="true" class="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#f7630c] px-1 text-[11px] font-semibold leading-5 text-white" data-notification-count>${escapeHtml(shellContent.notifications.length)}</span>
    </button>
    <section class="pointer-events-none absolute right-0 top-11 z-40 w-[360px] translate-y-[-6px] scale-[0.98] overflow-hidden rounded-lg border border-[#dde6f0] bg-white text-[#242424] opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]" data-notification-toast aria-label="실시간 알림" aria-live="polite" aria-hidden="true"></section>
    <section class="pointer-events-none absolute right-0 top-11 z-30 w-[360px] translate-y-[-6px] scale-[0.98] overflow-hidden rounded-lg border border-[#dde6f0] bg-white text-[#242424] opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]" data-notification-list aria-label="알림 목록" aria-hidden="true">
      <div class="max-h-80 overflow-y-auto" data-notification-items>
        ${shellContent.notifications.map((item) => renderNotificationItem(item)).join("")}
      </div>
    </section>
  </div>
`;

const renderAccountMenu = () => `
  <div class="relative" data-account-menu-root>
    <button class="${cx(componentClasses.pill, "min-h-8 border border-white/20 bg-white/10 px-3 text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white")}" type="button" data-account-menu-toggle aria-label="계정 메뉴 열기" aria-expanded="false">
      ${escapeHtml(shellContent.brand.userName)}
    </button>
    <section class="pointer-events-none absolute right-0 top-10 z-30 w-48 translate-y-[-6px] scale-[0.98] overflow-hidden rounded-lg border border-[#dde6f0] bg-white text-[#242424] opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]" data-account-menu aria-label="계정 메뉴" aria-hidden="true">
      <button class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[#a4262c] transition-colors hover:bg-[#fff4f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#6264a7]" type="button">
        <span>로그아웃</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  </div>
`;

const renderHeaderLogo = () => {
  const logoImage = shellContent.brand.logoImage?.trim();
  if (!logoImage) return "";

  return `
    <div class="absolute right-8 top-6 size-16 overflow-hidden rounded-xl border border-white/20 bg-white/90 shadow-[0_8px_18px_rgba(0,0,0,0.16)] ring-1 ring-[#0b477f]/10" data-console-logo aria-label="${escapeHtml(shellContent.brand.logoAlt)}">
      <img class="h-full w-full object-cover object-center opacity-95 saturate-[0.92]" src="${escapeHtml(logoImage)}" alt="${escapeHtml(shellContent.brand.logoAlt)}" />
    </div>
  `;
};

const setPopoverOpen = (element, trigger, isOpen) => {
  element?.classList.toggle("pointer-events-none", !isOpen);
  element?.classList.toggle("opacity-0", !isOpen);
  element?.classList.toggle("translate-y-[-6px]", !isOpen);
  element?.classList.toggle("scale-[0.98]", !isOpen);
  element?.classList.toggle("pointer-events-auto", isOpen);
  element?.classList.toggle("opacity-100", isOpen);
  element?.classList.toggle("translate-y-0", isOpen);
  element?.classList.toggle("scale-100", isOpen);
  element?.setAttribute("aria-hidden", String(!isOpen));
  trigger?.setAttribute("aria-expanded", String(isOpen));
};

const attachShellInteractions = (app) => {
  const notificationToggle = app.querySelector("[data-notification-toggle]");
  const notificationList = app.querySelector("[data-notification-list]");
  const notificationRoot = app.querySelector("[data-notification-root]");
  const notificationToast = app.querySelector("[data-notification-toast]");
  const notificationItems = app.querySelector("[data-notification-items]");
  const notificationCount = app.querySelector("[data-notification-count]");
  const accountMenuRoot = app.querySelector("[data-account-menu-root]");
  const accountMenuToggle = app.querySelector("[data-account-menu-toggle]");
  const accountMenu = app.querySelector("[data-account-menu]");
  let notificationTotal = shellContent.notifications.length;
  let notificationToastTimer;

  const renderNotificationList = () => {
    if (notificationItems) {
      notificationItems.innerHTML = shellContent.notifications.map((item) => renderNotificationItem(item)).join("");
    }
    notificationTotal = shellContent.notifications.length;
    if (notificationCount) notificationCount.textContent = String(notificationTotal);
  };

  const hydrateShellRuntime = async () => {
    try {
      const response = await fetch("/api/shell");
      if (!response.ok) return;
      const payload = await response.json();
      if (payload.brand && typeof payload.brand === "object") {
        shellContent.brand = { ...shellContent.brand, ...payload.brand };
        app.querySelector("[data-shell-brand-eyebrow]")?.replaceChildren(document.createTextNode(shellContent.brand.eyebrow || ""));
        app.querySelector("[data-shell-brand-title]")?.replaceChildren(document.createTextNode(shellContent.brand.title || ""));
        app.querySelector("[data-shell-brand-firm]")?.replaceChildren(document.createTextNode(shellContent.brand.firmName || ""));
        app.querySelector("[data-account-menu-toggle]")?.replaceChildren(document.createTextNode(shellContent.brand.userName || ""));
        const logo = app.querySelector("[data-console-logo] img");
        if (logo && shellContent.brand.logoImage) {
          logo.setAttribute("src", shellContent.brand.logoImage);
          logo.setAttribute("alt", shellContent.brand.logoAlt || "AuditMind");
        }
      }
      if (Array.isArray(payload.notifications)) {
        shellContent.notifications = payload.notifications;
        renderNotificationList();
        updateTimestamp();
      }
    } catch {
      // Keep local fallback shell state when the API is unavailable.
    }
  };

  const setNotificationPanelOpen = (isOpen) => setPopoverOpen(notificationList, notificationToggle, isOpen);
  const setNotificationToastOpen = (isOpen) => setPopoverOpen(notificationToast, null, isOpen);
  const setAccountMenuOpen = (isOpen) => setPopoverOpen(accountMenu, accountMenuToggle, isOpen);

  const pushRealtimeNotification = (notification) => {
    if (notification.kind && notification.kind !== "review-ready") return;
    if (notification.type && !["자료 접수", "검토 대기자료"].includes(notification.type)) return;
    const item = {
      type: "자료 접수",
      title: notification.company || notification.title || "새 제출 자료",
      detail: notification.documentName || notification.detail || "자료명 미확인",
      receivedAt: getNotificationTimeValue(notification.receivedAt || notification.createdAt || notification.time),
    };

    notificationTotal += 1;
    if (notificationCount) notificationCount.textContent = String(notificationTotal);
    notificationItems?.insertAdjacentHTML("afterbegin", renderNotificationItem(item));
    if (notificationToast) notificationToast.innerHTML = renderNotificationItem(item);
    setNotificationPanelOpen(false);
    setNotificationToastOpen(true);
    clearTimeout(notificationToastTimer);
    notificationToastTimer = setTimeout(() => setNotificationToastOpen(false), 3600);
  };

  notificationToggle?.addEventListener("click", () => {
    const isOpen = notificationToggle.getAttribute("aria-expanded") === "true";
    setNotificationToastOpen(false);
    setAccountMenuOpen(false);
    setNotificationPanelOpen(!isOpen);
  });

  accountMenuToggle?.addEventListener("click", () => {
    const isOpen = accountMenuToggle.getAttribute("aria-expanded") === "true";
    setNotificationPanelOpen(false);
    setNotificationToastOpen(false);
    setAccountMenuOpen(!isOpen);
  });

  document.addEventListener("click", (event) => {
    const notificationIsOpen = notificationToggle?.getAttribute("aria-expanded") === "true";
    const accountIsOpen = accountMenuToggle?.getAttribute("aria-expanded") === "true";
    if (notificationIsOpen && !notificationRoot?.contains(event.target)) setNotificationPanelOpen(false);
    if (accountIsOpen && !accountMenuRoot?.contains(event.target)) setAccountMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setNotificationPanelOpen(false);
    setNotificationToastOpen(false);
    setAccountMenuOpen(false);
  });

  window.addEventListener("auditmind:notification", (event) => {
    pushRealtimeNotification(event.detail || {});
  });

  hydrateShellRuntime();
};

const updateTimestamp = () => {
  const timestampEl = document.getElementById("header-timestamp");
  if (timestampEl) {
    const now = new Date();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const weekday = weekdays[now.getDay()];
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    timestampEl.textContent = `${year}-${month}-${day} (${weekday}) ${hours}:${minutes}:${seconds}`;
  }

  document.querySelectorAll("[data-notification-time]").forEach((timeEl) => {
    timeEl.textContent = formatNotificationTime(Number(timeEl.dataset.receivedAt || Date.now()));
  });
};

export const renderAccountantShell = ({ app, activePage, eyebrow, title, bodyHtml, overlaysHtml = "", onReady }) => {
  app.innerHTML = `
    <div class="min-h-screen bg-[#f6f8fb] text-[#242424]">
      <div class="grid min-h-screen lg:grid-cols-[244px_minmax(0,1fr)]">
        <aside class="border-r border-[#043873] bg-[#043873] text-white" aria-label="회계사 메뉴">
          <div class="relative min-h-[104px] border-b border-white/15 p-4 pr-24">
            <p class="text-xs font-semibold text-white/65" data-shell-brand-eyebrow>${escapeHtml(shellContent.brand.eyebrow)}</p>
            <h1 class="mt-1 text-lg font-semibold text-white" data-shell-brand-title>${escapeHtml(shellContent.brand.title)}</h1>
            <p class="mt-2 text-xs text-white/65" data-shell-brand-firm>${escapeHtml(shellContent.brand.firmName)}</p>
            ${renderHeaderLogo()}
          </div>
          <nav class="grid gap-1 p-3" aria-label="회계사 메뉴">
            ${shellContent.nav
              .map((item) => {
                const isActive = item.page === activePage;
                const href = item.page === "customer-test" ? getLatestSubmissionPortalUrl() : item.href || "#";
                return `
                  <a class="${cx(
                    "flex min-h-10 items-center justify-between rounded-md px-3 text-sm font-semibold transition-colors",
                    isActive ? "bg-white text-[#043873]" : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}" href="${escapeHtml(href)}" aria-current="${isActive ? "page" : "false"}">
                    <span>${escapeHtml(item.label)}</span>
                    ${item.count ? `<span class="${cx(componentClasses.pill, isActive ? "bg-[#eef6ff] text-[#043873]" : "bg-white/12 text-white")}">${escapeHtml(item.count)}</span>` : ""}
                  </a>
                `;
              })
              .join("")}
          </nav>
        </aside>

        <div class="min-w-0">
          <header class="border-b border-[#043873] bg-[#043873] text-white">
            <div class="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-xs font-semibold text-white/65">${escapeHtml(eyebrow)}</p>
                <h2 class="mt-1 text-2xl font-semibold text-white">${escapeHtml(title)}</h2>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <span class="w-[190px] whitespace-nowrap text-right text-sm tabular-nums text-white/80" id="header-timestamp"></span>
                ${renderNotifications()}
                ${renderAccountMenu()}
              </div>
            </div>
          </header>

          <main class="grid gap-4 p-5">
            ${bodyHtml}
          </main>
        </div>
      </div>
      ${overlaysHtml}
    </div>
  `;

  attachShellInteractions(app);

  // Keep one stable timestamp updater even when the shell is re-rendered.
  if (timestampTimer) clearInterval(timestampTimer);
  updateTimestamp();
  timestampTimer = setInterval(updateTimestamp, 1000);

  onReady?.(app);
};
