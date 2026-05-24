import "./styles.css";
import { renderAccountantConsole } from "./accountantConsole.js";
import { renderAccountantCustomerManagement } from "./accountantCustomerManagement.js";
import { renderAccountantReview } from "./accountantReview.js";
import { renderAccountantSubmissionRequests } from "./accountantSubmissionRequests.js";
import { renderAccountantTemplateManagement } from "./accountantTemplateManagement.js";
import { startCustomerPortal } from "./customerPortal.js";
import { renderLandingPage } from "./landingPage.js";

const app = document.querySelector("#app");
const searchParams = new URLSearchParams(window.location.search);
const pathname = window.location.pathname;
const viewMode = searchParams.get("view");
const accountantPage = searchParams.get("page") || "dashboard";
const isCustomerSubmissionRoute = pathname === "/submit" || pathname.startsWith("/submit/");
const isAccountantConsoleRoute = pathname === "/console" || pathname.startsWith("/console/");

if (isCustomerSubmissionRoute || viewMode === "customer") {
  startCustomerPortal();
} else if (isAccountantConsoleRoute || searchParams.has("page")) {
  if (accountantPage === "customers") {
    renderAccountantCustomerManagement(app);
  } else if (accountantPage === "submission-requests") {
    renderAccountantSubmissionRequests(app);
  } else if (accountantPage === "review") {
    renderAccountantReview(app);
  } else if (accountantPage === "templates") {
    renderAccountantTemplateManagement(app);
  } else {
    renderAccountantConsole(app);
  }
} else {
  renderLandingPage(app);
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
