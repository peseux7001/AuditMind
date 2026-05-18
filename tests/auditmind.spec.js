const { test, expect } = require("@playwright/test");

test("AuditMind customer submission portal renders core workflow", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("AuditMind Submission Portal");
  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 업로드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 제출", exact: true })).toBeVisible();
  await expect(page.getByText("샘플테크 주식회사")).toBeVisible();
  await expect(page.locator("label").filter({ hasText: "파일 선택" })).toBeVisible();
  await expect(page.getByRole("button", { name: "지원파일" })).toBeVisible();
});

test("AuditMind customer checklist shows submission states", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "부가세 신고서" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "카드매출 내역" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "통장 입금 내역" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "주요 매출계약서" })).toBeVisible();
  await expect(page.getByText("검수완료").first()).toBeVisible();
  await expect(page.getByText("반려").first()).toBeVisible();
  await expect(page.getByText("미접수").first()).toBeVisible();
  await expect(page.getByLabel("분석 중").first()).toBeVisible();
  await expect(page.getByText("파일 업로드").first()).toBeVisible();
  await expect(page.getByText("최종 접수 버튼을 누르기 전까지는 자료가 전달되지 않습니다.")).toBeVisible();
  await expect(page.getByText("파일 갱신")).toHaveCount(0);
  await expect(page.getByText("신규 업로드")).toHaveCount(0);
  await expect(page.getByText("새로 업로드")).toHaveCount(0);
  await expect(page.getByText("교체")).toHaveCount(0);
  await expect(page.getByText("직접 지정")).toHaveCount(0);
  await expect(page.getByText("확인필요")).toHaveCount(0);
  await expect(page.getByText("자동 분류 중")).toHaveCount(0);
});

test("AuditMind shows a soft accountant or AI customer message", async ({ page }) => {
  let qwenRequestBody;
  await page.route("**/api/qwen/chat/completions", async (route) => {
    qwenRequestBody = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        choices: [
          {
            message: {
              content:
                "샘플테크 주식회사 담당자님, 현재 **자료 제출률은 58%**이며 **접수 마감일은 2026년 5월 27일**입니다. 남은 자료도 편하실 때 이어서 올려주시면 검토가 더 부드럽게 진행됩니다. 바쁜 일정 속에서도 여기까지 준비해 주신 것만으로도 충분히 잘 진행되고 있습니다.",
            },
          },
        ],
      }),
    });
  });

  await page.goto("/");

  const requestSection = page.locator('section[aria-labelledby="request-title"]');
  const checklistSection = page.locator('section[aria-labelledby="checklist-title"]');

  await expect(requestSection.getByLabel("안내 메시지")).toBeVisible();
  await expect(checklistSection.getByLabel("안내 메시지")).toHaveCount(0);
  await expect(page.getByText("메시지를 준비하고 있습니다.")).toBeVisible();
  await page.waitForTimeout(700);
  await expect(requestSection.getByLabel("안내 메시지")).not.toContainText("**");
  await expect(page.getByText("샘플테크 주식회사 담당자님")).toBeVisible();
  await expect(page.getByText("현재 자료 제출률은 58%이며 접수 마감일은 2026년 5월 27일입니다.")).toBeVisible();
  await expect(requestSection.locator("strong", { hasText: "자료 제출률은 58%" })).toBeVisible();
  await expect(requestSection.locator("strong", { hasText: "접수 마감일은 2026년 5월 27일" })).toBeVisible();
  await expect(requestSection.locator("strong", { hasText: "자료 제출률은 58%" })).toHaveClass(/underline/);
  await expect(requestSection.locator("strong", { hasText: "접수 마감일은 2026년 5월 27일" })).toHaveClass(/underline/);
  await expect(requestSection.getByText("회계사가")).toHaveCount(0);
  await expect(requestSection.getByText("이 페이지를 보는")).toHaveCount(0);
  await expect(page.getByText("바쁜 일정 속에서도 여기까지 준비해 주신 것만으로도 충분히 잘 진행되고 있습니다.")).toBeVisible();
  await expect(requestSection.getByLabel("안내 메시지")).not.toContainText("**");
  expect(qwenRequestBody?.model).toBe("Qwen3.6-35B-A3B-NVFP4");
  expect(qwenRequestBody?.enable_thinking).toBe(false);
  expect(qwenRequestBody?.chat_template_kwargs?.enable_thinking).toBe(false);
  expect(qwenRequestBody?.messages?.at(-1)?.content).toContain("담당자에게 개인적으로 힘이 되는 응원 문장");
  expect(qwenRequestBody?.messages?.at(-1)?.content).toContain("이 페이지를 보는");
});

test("AuditMind status bubbles keep a consistent width", async ({ page }) => {
  await page.goto("/");

  const rejectedBox = await page.locator('[data-status-bubble="danger"]').first().boundingBox();
  const processingBox = await page.locator('[data-status-bubble="processing"]').first().boundingBox();
  const missingBox = await page.locator('[data-status-bubble="neutral"]').first().boundingBox();
  const approvedBox = await page.locator('[data-status-bubble="success"]').first().boundingBox();

  expect(rejectedBox.width).toBe(processingBox.width);
  expect(missingBox.width).toBe(processingBox.width);
  expect(approvedBox.width).toBe(processingBox.width);
  expect(processingBox.height).toBeLessThanOrEqual(26);
});

test("AuditMind final submit changes a row into received state", async ({ page }) => {
  await page.goto("/");

  const vatRow = page.locator('section[aria-labelledby="checklist-title"] ol > li').filter({
    has: page.getByRole("heading", { name: "부가세 신고서" }),
  });

  await expect(vatRow.locator("[data-status-bubble]")).toHaveText("검수완료");
  await vatRow.getByRole("button", { name: "최종 접수" }).click();

  await expect(vatRow.locator("[data-status-bubble]")).toHaveText("접수완료");
  await expect(vatRow.getByRole("button", { name: "파일 업로드" })).toBeDisabled();
  await expect(vatRow.getByRole("button", { name: "최종 접수" })).toBeDisabled();
  await expect(vatRow.getByText("최종 접수가 완료되었습니다.", { exact: true })).toBeVisible();
  await expect(vatRow.getByText("회계사에게 안전하게 전달되었습니다.")).toHaveCount(0);
  await expect(vatRow.getByRole("link", { name: "부가세_신고서_2025_1기.pdf" })).toBeVisible();
});

test("AuditMind checklist rows use AI review lines and downloadable approved files", async ({ page }) => {
  await page.goto("/");

  const checklistRows = page.locator('section[aria-labelledby="checklist-title"] ol > li');
  const vatRow = checklistRows.filter({ has: page.getByRole("heading", { name: "부가세 신고서" }) });
  const cardSalesRow = checklistRows.filter({ has: page.getByRole("heading", { name: "카드매출 내역" }) });
  const taxInvoiceRow = checklistRows.filter({ has: page.getByRole("heading", { name: "매출 세금계산서 합계표" }) });
  const bankRow = checklistRows.filter({ has: page.getByRole("heading", { name: "통장 입금 내역" }) });

  await expect(vatRow.getByText("AI 검수 완료율 100%입니다. 제출 기준에 맞게 첨부되었습니다.")).toBeVisible();
  await expect(vatRow.getByRole("link", { name: "부가세_신고서_2025_1기.pdf" })).toHaveAttribute("download", "부가세_신고서_2025_1기.pdf");
  await expect(vatRow.getByRole("link", { name: "부가세_신고서_2025_1기.pdf" })).toHaveAttribute("href", /data:text\/plain/);
  await expect(cardSalesRow.getByText("반려 사유: 3월 자료가 빠진 것으로 보입니다. 1월, 2월 파일만 자동 매칭되었습니다.")).toBeVisible();
  await expect(taxInvoiceRow.getByText("AI가 문서를 분석 중입니다. 잠시 후 검수 완료율과 결과가 표시됩니다.")).toBeVisible();
  await expect(bankRow.getByText("아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.")).toBeVisible();
  await expect(bankRow.getByRole("link")).toHaveCount(0);
});

test("AuditMind status and action labels are paired by item state", async ({ page }) => {
  await page.goto("/");

  const pairs = await page.locator('section[aria-labelledby="checklist-title"] ol > li').evaluateAll((rows) =>
    rows.map((row) => {
      const status = row.querySelector("[data-status-bubble]")?.textContent.trim();
      const action = row.querySelector("button")?.textContent.trim();
      return [status, action];
    }),
  );

  expect(pairs).toEqual([
    ["분석 중", "파일 업로드"],
    ["반려", "파일 업로드"],
    ["미접수", "파일 업로드"],
    ["미접수", "파일 업로드"],
    ["검수완료", "파일 업로드"],
    ["검수완료", "파일 업로드"],
  ]);
});

test("AuditMind upload refresh is disabled while a row is being analyzed", async ({ page }) => {
  await page.goto("/");

  const actionStates = await page.locator('section[aria-labelledby="checklist-title"] ol > li').evaluateAll((rows) =>
    rows.map((row) => {
      const status = row.querySelector("[data-status-bubble]")?.textContent.trim();
      const uploadButton = row.querySelector("button");
      return [status, uploadButton?.disabled ?? null];
    }),
  );

  expect(actionStates).toEqual([
    ["분석 중", true],
    ["반려", false],
    ["미접수", false],
    ["미접수", false],
    ["검수완료", false],
    ["검수완료", false],
  ]);
});

test("AuditMind final submit is enabled only for approved files", async ({ page }) => {
  await page.goto("/");

  const finalSubmitStates = await page.locator('section[aria-labelledby="checklist-title"] ol > li').evaluateAll((rows) =>
    rows.map((row) => {
      const status = row.querySelector("[data-status-bubble]")?.textContent.trim();
      const finalSubmitButton = Array.from(row.querySelectorAll("button")).find(
        (button) => button.textContent.trim() === "최종 접수",
      );
      return [status, finalSubmitButton?.disabled ?? null];
    }),
  );

  expect(finalSubmitStates).toEqual([
    ["분석 중", true],
    ["반려", true],
    ["미접수", true],
    ["미접수", true],
    ["검수완료", false],
    ["검수완료", false],
  ]);
});

test("AuditMind shows upload progress overlay after file selection", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-upload-input]').setInputFiles([
    {
      name: "부가세신고서.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 감사마인드 샘플"),
    },
    {
      name: "매출자료.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("감사마인드 샘플"),
    },
  ]);

  const overlay = page.locator("#upload-overlay");
  await expect(overlay).toBeVisible();
  await expect(page.getByText("2개 파일")).toBeVisible();
  await expect(page.getByText("파일 업로드 중")).toBeVisible();
  await expect(page.getByText("선택한 파일을 안전하게 접수하고 있습니다.")).toBeVisible();
  await expect(page.getByText("이 단계가 끝나면 분석은 백그라운드에서 계속 진행됩니다.")).toBeVisible();
  await expect(page.locator("#upload-overlay-percent")).not.toHaveText("0%");
  await expect(page.getByRole("heading", { name: "파일 분석 시작" })).toBeVisible();
  await expect(page.getByText("파일 업로드가 완료되었습니다.")).toBeVisible();
  await expect(page.getByText("문서 분류와 분석은 이 페이지를 나가셔도 계속 진행됩니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "확인" })).toBeVisible();
});

test("AuditMind upload overlay card keeps a stable height between steps", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-upload-input]').setInputFiles([
    {
      name: "부가세신고서.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 감사마인드 샘플"),
    },
  ]);

  const card = page.locator("#upload-overlay-card");
  await expect(page.getByText("파일 업로드 중")).toBeVisible();
  const uploadingBox = await card.boundingBox();
  await expect(page.getByRole("heading", { name: "파일 분석 시작" })).toBeVisible();
  const analysisBox = await card.boundingBox();

  expect(analysisBox.height).toBe(uploadingBox.height);
});

test("AuditMind moves every item into analysis after confirming upload receipt", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-upload-input]').setInputFiles([
    {
      name: "자료모음.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("감사마인드 샘플"),
    },
  ]);

  await expect(page.getByRole("heading", { name: "파일 분석 시작" })).toBeVisible();
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.locator("#upload-overlay")).toBeHidden();

  const analyzingStates = await page.locator('section[aria-labelledby="checklist-title"] ol > li').evaluateAll((rows) =>
    rows.map((row) => {
      const status = row.querySelector("[data-status-bubble]")?.textContent.trim();
      const uploadButton = row.querySelector("button");
      const finalSubmitButton = Array.from(row.querySelectorAll("button")).find(
        (button) => button.textContent.trim() === "최종 접수",
      );
      return [status, uploadButton?.disabled ?? null, finalSubmitButton?.disabled ?? null];
    }),
  );

  expect(analyzingStates).toEqual([
    ["분석 중", true, true],
    ["분석 중", true, true],
    ["분석 중", true, true],
    ["분석 중", true, true],
    ["분석 중", true, true],
    ["분석 중", true, true],
  ]);

  await expect(page.getByText("검수완료").first()).toBeVisible();
});

test("AuditMind applies mock routing results without filename overfitting", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-upload-input]').setInputFiles([
    {
      name: "자료모음.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("자료모음 샘플"),
    },
  ]);

  await expect(page.getByRole("heading", { name: "파일 분석 시작" })).toBeVisible();
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByRole("heading", { name: "부가세 신고서" })).toBeVisible({ timeout: 7000 });

  const checklistRows = page.locator('section[aria-labelledby="checklist-title"] ol > li');
  const vatRow = checklistRows.filter({ has: page.getByRole("heading", { name: "부가세 신고서" }) });
  const cardSalesRow = checklistRows.filter({ has: page.getByRole("heading", { name: "카드매출 내역" }) });
  const bankRow = checklistRows.filter({ has: page.getByRole("heading", { name: "통장 입금 내역" }) });
  const contractRow = checklistRows.filter({ has: page.getByRole("heading", { name: "주요 매출계약서" }) });

  await expect(vatRow.locator("[data-status-bubble]")).toHaveText("검수완료");
  await expect(vatRow.getByRole("link", { name: "부가세_신고서_2025_1기.pdf" })).toBeVisible();
  await expect(cardSalesRow.locator("[data-status-bubble]")).toHaveText("반려");
  await expect(cardSalesRow.getByText("반려 사유: 3월 자료가 빠진 것으로 보입니다. 1월, 2월 파일만 자동 매칭되었습니다.")).toBeVisible();
  await expect(bankRow.locator("[data-status-bubble]")).toHaveText("미접수");
  await expect(bankRow.getByRole("link")).toHaveCount(0);
  await expect(contractRow.locator("[data-status-bubble]")).toHaveText("미접수");
});

test("AuditMind checklist filters show all or not-final rows", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('section[aria-labelledby="checklist-title"] ol > li')).toHaveCount(6);

  await page.getByRole("button", { name: "미접수" }).click();
  await expect(page.getByRole("button", { name: "미접수" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('section[aria-labelledby="checklist-title"] ol > li')).toHaveCount(4);

  const filteredTitles = await page.locator('section[aria-labelledby="checklist-title"] ol > li h3').evaluateAll((headings) =>
    headings.map((heading) => heading.textContent.trim()),
  );

  expect(filteredTitles).toEqual([
    "매출 세금계산서 합계표",
    "카드매출 내역",
    "통장 입금 내역",
    "주요 매출계약서",
  ]);

  await page.getByRole("button", { name: "전체" }).click();
  await expect(page.locator('section[aria-labelledby="checklist-title"] ol > li')).toHaveCount(6);
});

test("AuditMind customer checklist prioritizes actionable rows", async ({ page }) => {
  await page.goto("/");

  const rowTitles = await page.locator('section[aria-labelledby="checklist-title"] ol > li h3').evaluateAll((headings) =>
    headings.map((heading) => heading.textContent.trim()),
  );

  expect(rowTitles).toEqual([
    "매출 세금계산서 합계표",
    "카드매출 내역",
    "통장 입금 내역",
    "주요 매출계약서",
    "부가세 신고서",
    "PG 정산자료",
  ]);
});

test("AuditMind customer portal has usable responsive layout", async ({ page }) => {
  await page.goto("/");

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();

  const bodyBox = await page.locator("body").boundingBox();
  expect(bodyBox.width).toBeGreaterThan(300);

  await expect(page.getByText("자료 제출률")).toBeVisible();
  await expect(page.getByText("총 12개 자료 중 7개 접수 완료")).toBeVisible();
  await expect(page.getByText("접수 마감일")).toBeVisible();
  await expect(page.getByText("마감까지 9일 남았습니다.")).toBeVisible();
  await expect(page.locator("span", { hasText: "자료 제출률" }).first()).not.toHaveClass(/underline/);
  await expect(page.locator("strong", { hasText: "58%" }).first()).not.toHaveClass(/underline/);
  await expect(page.locator("span", { hasText: "접수 마감일" }).first()).not.toHaveClass(/underline/);
  await expect(page.locator("strong", { hasText: "2026년 5월 27일" }).first()).not.toHaveClass(/underline/);
  await expect(page.locator('input[type="file"]')).toHaveAttribute(
    "accept",
    ".pdf,.xls,.xlsx,.xlsm,.csv,.tsv,.doc,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.heic,.heif,.webp,.tiff,.tif,.zip,.7z",
  );
  await expect(page.getByRole("heading", { name: "제출 상태" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "접근 안내" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "참고 사항" })).toBeVisible();
  await expect(page.getByText("고객님의 개인 정보는 외부로 유출되지 않고 AuditMind 내부에서만 사용됩니다.")).toBeVisible();
  await expect(page.getByText("#####")).toHaveCount(0);
});
