import landingHtml from "./landingLayout.html?raw";

const CONSOLE_PATH = "/console";
const SESSION_STORAGE_KEY = "auditmind.landingSessionId";

const extractFirstMatch = (pattern, fallback = "") => landingHtml.match(pattern)?.[1] || fallback;

const landingStyles = extractFirstMatch(/<style>([\s\S]*?)<\/style>/i);
const landingBody = extractFirstMatch(/<body[^>]*>([\s\S]*?)<\/body>/i, landingHtml)
  .replaceAll("https://auditmind.navingate.com", CONSOLE_PATH)
  .replaceAll("AI Translation", "AI 검증");

const ensureLandingFont = () => {
  if (document.querySelector('link[data-auditmind-landing-font="true"]')) return;

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = "https://fonts.googleapis.com";
  preconnect.dataset.auditmindLandingFont = "true";
  document.head.append(preconnect);

  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href =
    "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Serif+KR:wght@400;600;700;900&display=swap";
  font.dataset.auditmindLandingFont = "true";
  document.head.append(font);
};

const getLandingSessionId = () => {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const nextId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const logLandingEvent = (eventType) => {
  const payload = {
    eventType,
    sessionId: getLandingSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || "",
    metadata: {
      title: document.title,
    },
  };
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/landing-events", blob);
      return;
    }
  } catch {
    // Fall through to fetch below.
  }

  fetch("/api/landing-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
};

const bindLandingInteractions = () => {
  const nav = document.getElementById("nav");
  if (nav) {
    const updateNavState = () => nav.classList.toggle("scrolled", window.scrollY > 40);
    updateNavState();
    window.addEventListener("scroll", updateNavState, { passive: true });
  }

  const revealItems = [...document.querySelectorAll(".reveal")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1 },
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("visible"));
  }

  document.querySelectorAll("[data-open-console], .nav-cta, .btn-primary, .banner-btn").forEach((element) => {
    const text = element.textContent || "";
    if (!text.includes("MVP")) return;
    element.addEventListener("click", (event) => {
      event.preventDefault();
      logLandingEvent("console_demo_click");
      window.location.href = CONSOLE_PATH;
    });
  });
};

export const renderLandingPage = (app) => {
  ensureLandingFont();
  document.title = "AuditMind — Better Evidence, PwC-ready Growth";
  app.innerHTML = `
    <style data-auditmind-landing-style>
      ${landingStyles}
    </style>
    <div data-auditmind-landing>
      ${landingBody.replace(/<script>[\s\S]*?<\/script>/gi, "")}
    </div>
  `;
  logLandingEvent("landing_view");
  bindLandingInteractions();
};
