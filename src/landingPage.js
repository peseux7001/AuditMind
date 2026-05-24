import landingHtml from "./landingLayout.html?raw";

const CONSOLE_PATH = "/console";

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
  bindLandingInteractions();
};
