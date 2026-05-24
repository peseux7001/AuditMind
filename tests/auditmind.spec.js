const { test, expect } = require("@playwright/test");

test("AuditMind customer submission portal renders core workflow", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  await expect(page).toHaveTitle("AuditMind");
  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 업로드" })).toBeVisible();
  await expect(page.getByText("실행 파일, 암호가 걸린 압축 파일, 손상된 파일은 처리할 수 없습니다.")).toHaveCount(0);
  await expect(page.getByText("자료의 품질이 낮거나 누락 사항이 많은 경우 오류로 표시되거나 다시 제출요청을 받으실 수 있습니다.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 제출", exact: true })).toBeVisible();
  await expect(page.getByText("샘플테크 주식회사")).toBeVisible();
  await expect(page.locator("label").filter({ hasText: "파일 다중 선택" })).toBeVisible();
  await expect(page.getByRole("button", { name: "지원파일" })).toBeVisible();
  await expect(page.getByLabel("사업자 및 약관 정보")).toBeVisible();
  await expect(page.getByText("상호 AuditMind 주식회사")).toBeVisible();
  await expect(page.getByText("사업자등록번호 000-00-00000")).toBeVisible();
  await expect(page.getByText("통신판매업 신고번호 제2026-서울강남-00000호")).toBeVisible();
  await expect(page.getByRole("link", { name: "개인정보처리방침" })).toBeVisible();
});

test("AuditMind accountant console renders review queue layout", async ({ page, isMobile }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "자료 검토 콘솔" })).toBeVisible();
  if (!isMobile) {
    await expect(page.locator("[data-console-logo] img")).toHaveAttribute("src", "/brand/auditmind-logo.png");
  }
  await expect(page.getByRole("navigation", { name: "회계사 메뉴" })).toBeVisible();
  await expect(page.getByRole("link", { name: /대시보드/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "고객사 관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "자료제출 요청" })).toBeVisible();
  await expect(page.getByRole("link", { name: "제출자료 검토" })).toBeVisible();
  await expect(page.getByRole("link", { name: "서비스 관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "설정" })).toBeVisible();
  await expect(page.getByRole("link", { name: /자료 요청/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /반려\/재요청/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Evidence Trace/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /리포트/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "검토 대기자료" })).toBeVisible();
  await expect(page.getByRole("button", { name: "자료 요청 만들기" })).toHaveCount(0);
  await page.getByRole("button", { name: "알림 열기" }).click();
  await expect(page.getByLabel("알림 목록")).toBeVisible();
  await expect(page.getByText("신규 검토 대기자료와 고객사 요청사항을 표시합니다.")).toHaveCount(0);
  await expect(page.getByLabel("알림 목록")).toContainText("샘플테크 주식회사");
  await expect(page.getByLabel("알림 목록")).toContainText("통장 입금 내역");
  await page.getByRole("heading", { name: "검토 대기자료" }).click();
  await expect(page.getByLabel("알림 목록")).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("auditmind:notification", {
        detail: {
          type: "자료 접수",
          title: "노스브릿지",
          detail: "매출 세금계산서 합계표",
          time: "방금 전",
        },
      }),
    );
  });
  await expect(page.getByLabel("실시간 알림")).toContainText("노스브릿지");
  await expect(page.getByLabel("실시간 알림")).toContainText("매출 세금계산서 합계표");
  await expect(page.getByLabel("알림 목록")).toHaveAttribute("aria-hidden", "true");
  await page.getByRole("button", { name: "알림 열기" }).click();
  await expect(page.getByLabel("알림 목록")).toContainText("노스브릿지");
  await page.getByRole("button", { name: "알림 열기" }).click();
  await page.getByRole("button", { name: "계정 메뉴 열기" }).click();
  await expect(page.getByRole("region", { name: "계정 메뉴" })).toContainText("로그아웃");
  await page.getByRole("heading", { name: "검토 대기자료" }).click();
  await expect(page.locator("[data-account-menu]")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByLabel("검토 요약")).toContainText("검토 대기 자료");
  await expect(page.getByLabel("검토 요약")).toContainText("자료 미제출 고객사");
  await expect(page.getByLabel("검토 요약")).toContainText("고객사 요청사항");
  await expect(page.getByLabel("검토 요약").getByRole("button", { name: /설정/ })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "알림 기준 설정" })).toHaveCount(0);
  if (!isMobile) {
    await page.getByRole("button", { name: "신규 4건" }).hover();
    await expect(page.getByLabel("검토 요약").getByText("신규 제출 고객사")).toBeVisible();
    await page.getByRole("button", { name: "5개사" }).hover();
    await expect(page.getByLabel("검토 요약").getByText("마감 5일 이내 미제출")).toBeVisible();
    await page.getByRole("button", { name: "신규 3건" }).hover();
    await expect(page.getByLabel("검토 요약").getByText("요청사항 입력 고객사")).toBeVisible();
    await page.getByRole("heading", { name: "검토 대기자료" }).hover();
    await expect(page.getByLabel("검토 요약").getByText("요청사항 입력 고객사")).toBeHidden();
  }
  await expect(page.getByRole("heading", { name: "검토 대기자료" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "고객사" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "서비스명" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "접수 일시" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "우선순위" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "요청명" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "담당자" })).toHaveCount(0);
  await expect(page.getByLabel("검토 대기자료 정렬")).toContainText("고객사별");
  await expect(page.getByLabel("검토 대기자료 정렬")).toContainText("접수순");
  await expect(page.getByLabel("검토 대기자료 정렬")).toContainText("마감임박순");
  await expect(page.getByRole("button", { name: "신뢰도 낮은순" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "신뢰도" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "확인 수준" })).toHaveCount(0);
  await expect(page.getByText("검토 주의").first()).toBeVisible();
  await expect(page.getByText("검토 대기").first()).toBeVisible();
  await expect(page.locator("[data-queue-body] tr").first()).toContainText("샘플테크 주식회사");
  await page.getByRole("button", { name: "접수순" }).click();
  await expect(page.locator("[data-queue-body] tr").first()).toContainText("오르빗헬스");
  await page.getByRole("button", { name: "고객사별" }).click();
  await expect(page.locator("[data-queue-body] tr").first()).toContainText("루멘커머스");
  await page.getByRole("button", { name: "고객사별" }).click();
  await expect(page.locator("[data-queue-body] tr").first()).toContainText("오르빗헬스");
  await page.getByRole("button", { name: "마감임박순" }).click();
  await expect(page.locator("[data-queue-body] tr").first()).toContainText("샘플테크 주식회사");
  await page.getByRole("button", { name: "마감임박순" }).click();
  await expect(page.locator("[data-queue-body] tr").first()).toContainText("오르빗헬스");
  await expect(page.getByRole("cell", { name: "부가세 신고서" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2026-05-19 14:20" })).toBeVisible();
  await expect(page.getByText("오류 후보")).toHaveCount(0);
  await expect(page.getByText("분석 중")).toHaveCount(0);
  await expect(page.getByText("최종 접수")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "선택 항목" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toHaveCount(0);
});

test("AuditMind accountant customer management page renders customer list", async ({ page }, testInfo) => {
  const newCustomerName = `테스트 신규 고객사 ${testInfo.project.name}`;
  await page.goto("/?page=customers");

  await expect(page.getByRole("heading", { name: "자료 검토 콘솔" })).toBeVisible();
  await expect(page.getByRole("link", { name: "고객사 관리" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "자료제출 요청" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "고객사 관리" })).toBeVisible();
  await page.getByRole("button", { name: "알림 열기" }).click();
  await expect(page.getByLabel("알림 목록")).toContainText("샘플테크 주식회사");
  await expect(page.getByLabel("알림 목록")).toContainText("통장 입금 내역");
  await page.getByRole("heading", { name: "고객사 관리" }).click();
  await expect(page.getByLabel("알림 목록")).toHaveAttribute("aria-hidden", "true");
  await page.getByRole("button", { name: "계정 메뉴 열기" }).click();
  await expect(page.getByRole("region", { name: "계정 메뉴" })).toContainText("로그아웃");
  await page.getByRole("heading", { name: "고객사 관리" }).click();
  await expect(page.locator("[data-account-menu]")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByLabel("고객사 요약")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "고객사 목록" })).toBeVisible();
  await expect(page.getByText("전체 4개사")).toBeVisible();
  await expect(page.getByText("기존 고객사 관리")).toHaveCount(0);
  await expect(page.getByText("고객사 기본정보")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "목록 접기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "목록 펼치기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "신규 고객사 추가" })).toBeVisible();
  await expect(page.getByRole("button", { name: "고객사 삭제" })).toBeVisible();
  await expect(page.getByText("고객사 정보를 추가할 수 있습니다.")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "고객사" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "대표 담당자" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "담당자 수" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "상태" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "샘플테크 주식회사" })).toBeVisible();
  await page.getByRole("cell", { name: "샘플테크 주식회사" }).click();
  await expect(page.getByText("선택됨")).toBeVisible();
  await expect(page.getByRole("heading", { name: "샘플테크 주식회사" })).toBeVisible();
  await expect(page.getByLabel("고객사명")).toHaveValue("샘플테크 주식회사");
  await expect(page.getByLabel("사업자등록번호")).toHaveValue("123-45-67890");
  await expect(page.getByLabel("대표자명")).toHaveValue("김샘플");
  await expect(page.getByLabel("업태")).toHaveValue("정보통신업");
  await expect(page.getByLabel("업종")).toHaveValue(/소프트웨어/);
  await expect(page.getByLabel("사업장 주소")).toHaveValue("서울특별시 강남구 테헤란로 123, 10층");
  await expect(page.getByLabel("상태")).toHaveCount(0);
  await expect(page.getByLabel("AI 고객사 분석")).toBeVisible();
  await expect(page.getByLabel("AI 고객사 분석")).toHaveAttribute("aria-readonly", "true");
  await expect(page.getByText("분석을 준비하고 있습니다.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "저장" })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  const currentBusinessItem = await page.getByLabel("업종").inputValue();
  const updatedBusinessItem = currentBusinessItem.includes("회계자료 자동화")
    ? "소프트웨어 개발 및 공급업"
    : "소프트웨어 개발 및 회계자료 자동화";
  await page.getByLabel("업종").fill(updatedBusinessItem);
  await expect(page.getByRole("button", { name: "저장" })).toBeEnabled();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장되었습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "담당자 목록" })).toBeVisible();
  await expect(page.getByText("고객사별로 여러 담당자를 등록할 수 있습니다.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "담당자 추가" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "최지훈 대표" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "한서윤" })).toBeVisible();
  await page.getByRole("cell", { name: "루멘커머스" }).click();
  await expect(page.getByRole("heading", { name: "루멘커머스" })).toBeVisible();
  await expect(page.getByLabel("사업자등록번호")).toHaveValue("234-56-78901");
  await expect(page.getByLabel("대표자명")).toHaveValue("최루멘");
  await expect(page.locator("[data-customer-row]").filter({ hasText: "루멘커머스" }).getByText("선택됨")).toBeVisible();
  await expect(page.locator("[data-customer-row]").filter({ hasText: "샘플테크 주식회사" }).getByText("선택됨")).toHaveCount(0);
  await page.getByRole("cell", { name: "샘플테크 주식회사" }).click();
  await expect(page.getByRole("heading", { name: "샘플테크 주식회사" })).toBeVisible();
  await expect(page.getByText("선택된 고객사")).toHaveCount(0);
  await expect(page.getByText("총 4개 고객사를 관리 중입니다.")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "고객사" })).toBeVisible();
  await expect(page.getByRole("button", { name: "신규 고객사 추가" })).toBeVisible();
  await expect(page.getByRole("button", { name: "고객사 삭제" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "샘플테크 주식회사" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 요청 설정" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "제출 필요자료 선별" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "제출 필요자료 발송" })).toHaveCount(0);
  await page.getByRole("button", { name: "담당자 추가" }).click();
  const contactDialog = page.getByRole("dialog", { name: "담당자 추가" });
  await expect(contactDialog).toBeVisible();
  await expect(contactDialog.getByLabel("이름")).toHaveAttribute("required", "");
  await expect(contactDialog.getByLabel("연락처")).toHaveAttribute("required", "");
  await expect(contactDialog.getByLabel("이메일")).toHaveAttribute("required", "");
  await contactDialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(contactDialog.getByText("이름, 연락처, 이메일을 입력해 주세요.")).toBeVisible();
  await contactDialog.getByLabel("이름").fill("김담당");
  await contactDialog.getByLabel("직급").fill("재무팀장");
  await contactDialog.getByLabel("연락처").fill("010-9999-0000");
  await contactDialog.getByLabel("이메일").fill("new@example.com");
  await contactDialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("cell", { name: "김담당" }).first()).toBeVisible();
  await page.getByRole("button", { name: "신규 고객사 추가" }).click();
  const addDialog = page.getByRole("dialog", { name: "고객사 정보를 입력해 주세요" });
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByLabel("서비스명")).toHaveCount(0);
  await expect(addDialog.getByLabel("마감일")).toHaveCount(0);
  await expect(addDialog.getByLabel("담당자 이름")).toHaveCount(0);
  await expect(addDialog.getByLabel("사업자등록번호")).toBeVisible();
  await expect(addDialog.getByLabel("대표자명")).toBeVisible();
  await expect(addDialog.getByLabel("업태")).toBeVisible();
  await expect(addDialog.getByLabel("업종")).toBeVisible();
  await expect(addDialog.getByLabel("사업장 주소")).toBeVisible();
  await addDialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(addDialog.getByText("고객사명을 입력해 주세요.")).toBeVisible();
  await addDialog.getByLabel("고객사명").fill(newCustomerName);
  await addDialog.getByLabel("사업자등록번호").fill("999-99-99999");
  await addDialog.getByLabel("대표자명").fill("박테스트");
  await addDialog.getByLabel("업태").fill("전문 서비스업");
  await addDialog.getByLabel("업종").fill("회계 및 세무 자문");
  await addDialog.getByLabel("사업장 주소").fill("서울특별시 중구 세종대로 1");
  await addDialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("heading", { name: newCustomerName })).toBeVisible();
  await expect(page.getByLabel("사업자등록번호")).toHaveValue("999-99-99999");
  await expect(page.getByLabel("대표자명")).toHaveValue("박테스트");
  await expect(page.getByLabel("업태")).toHaveValue("전문 서비스업");
  await expect(page.getByLabel("업종")).toHaveValue("회계 및 세무 자문");
  await expect(page.getByLabel("사업장 주소")).toHaveValue("서울특별시 중구 세종대로 1");
  await expect(page.getByText("등록된 담당자가 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "고객사 삭제" }).click();
  await expect(page.getByRole("columnheader", { name: "선택" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: `${newCustomerName} 삭제 선택` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "선택 삭제" })).toHaveCount(0);
  const deleteDialog = page.getByRole("dialog", { name: "고객사를 삭제할까요?" });
  await expect(deleteDialog).toBeVisible();
  await expect(page.getByRole("heading", { name: newCustomerName })).toBeVisible();
  await expect(deleteDialog).toContainText(newCustomerName);
  await deleteDialog.getByRole("button", { name: "계속" }).click();
  const finalDeleteDialog = page.getByRole("dialog", { name: "정말 삭제하시겠습니까?" });
  await expect(finalDeleteDialog).toBeVisible();
  await expect(finalDeleteDialog).toContainText("두 번 다시 되돌릴 수 없습니다");
  await finalDeleteDialog.getByRole("button", { name: "영구 삭제" }).click();
  await expect(page.getByRole("heading", { name: newCustomerName })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "샘플테크 주식회사" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toHaveCount(0);
});

test("AuditMind accountant submission request page renders request workspace", async ({ page }) => {
  await page.goto("/?page=submission-requests");

  await expect(page.getByRole("heading", { name: "자료 검토 콘솔" })).toBeVisible();
  await expect(page.getByRole("link", { name: "자료제출 요청" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "자료제출 요청" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "고객사 선택" })).toBeVisible();
  await expect(page.getByText("전체 3개사")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "새 요청" })).toHaveCount(0);
  await expect(page.getByLabel("고객사 검색")).toBeVisible();
  await expect(page.getByText(/\d+ \/ \d+개/).first()).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("columnheader", { name: "선택" })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("columnheader", { name: "고객사" })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("columnheader", { name: "대표 담당자" })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("columnheader", { name: "직급" })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("columnheader", { name: "전화번호" })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("columnheader", { name: "서비스명" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "서비스명" })).toHaveCount(1);
  await expect(page.getByLabel("고객사 선택").getByRole("columnheader", { name: "상태" })).toHaveCount(0);
  await expect(page.getByLabel("고객사 선택").getByRole("cell", { name: "최지훈" })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("cell", { name: "CFO", exact: true })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("cell", { name: /010-/ }).first()).toBeVisible();
  await page.getByLabel("고객사 검색").click();
  await page.getByLabel("고객사 검색").pressSequentially("루멘");
  await expect(page.getByLabel("고객사 검색")).toHaveValue("루멘");
  await expect(page.getByLabel("고객사 선택").getByRole("cell", { name: "루멘커머스", exact: true })).toBeVisible();
  await expect(page.getByLabel("고객사 선택").getByRole("cell", { name: "샘플테크 주식회사", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("고객사 선택").getByText(/1 \/ \d+개/)).toBeVisible();
  await page.getByLabel("고객사 검색").fill("");
  await expect(page.getByRole("heading", { name: "서비스", exact: true })).toBeVisible();
  await expect(page.getByText("선택 1개사")).toBeVisible();
  await expect(page.getByText("선택 0개", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("요청 자료", { exact: true }).getByText("선택 0개", { exact: true })).toBeVisible();
  await expect(page.getByText("111 / 111개")).toBeVisible();
  await expect(page.getByLabel("서비스").getByText("선택된 고객사")).toBeVisible();
  await expect(page.getByRole("button", { name: "발송" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "서비스 선택" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "요청 자료" })).toBeVisible();
  await expect(page.getByLabel("서비스 검색")).toBeVisible();
  await expect(page.getByLabel("요청 자료 검색")).toBeVisible();
  await expect(page.getByRole("button", { name: "선택 추가" })).toHaveCount(0);
  await expect(page.getByLabel("서비스 선택").getByRole("columnheader", { name: "서비스명" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "업무 영역" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "내용" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "자료 수" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "자료명" })).toBeVisible();
  await expect(page.getByRole("button", { name: "요청자료 추가" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "미리보기" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "서비스", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "코드" })).toHaveCount(0);
  await expect(page.getByLabel("서비스 선택").getByRole("cell", { name: "부가가치세 신고", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "세무신고·세무대리", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "부가가치세 신고를 위한 자료 요청 서비스", exact: true })).toBeVisible();
  await expect(page.getByLabel("서비스 선택").getByRole("cell", { name: "회사 기본자료", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("서비스 선택").getByRole("cell", { name: "회계장부 및 결산자료", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("서비스 선택").getByRole("cell", { name: "매출자료", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("서비스 선택").getByRole("cell", { name: "부가가치세자료", exact: true })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "사업자등록증", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "법인등기사항전부증명서", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "부가가치세 신고서", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "business_registration_certificate", exact: true })).toHaveCount(0);

  await page.getByLabel("서비스 검색").click();
  await page.getByLabel("서비스 검색").pressSequentially("부가가치세");
  await expect(page.getByLabel("서비스 검색")).toHaveValue("부가가치세");
  await expect(page.getByLabel("서비스 선택").getByRole("cell", { name: "부가가치세 신고", exact: true })).toBeVisible();
  await expect(page.getByLabel("서비스 선택").getByRole("cell", { name: "재무실사", exact: true })).toHaveCount(0);
  await page.getByLabel("서비스 검색").fill("");
  await page.getByLabel("요청 자료 검색").click();
  await page.getByLabel("요청 자료 검색").pressSequentially("세금계산서");
  await expect(page.getByLabel("요청 자료 검색")).toHaveValue("세금계산서");
  await expect(page.getByRole("cell", { name: "매출 세금계산서", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "사업자등록증", exact: true })).toHaveCount(0);
  await page.getByLabel("요청 자료 검색").fill("");

  await expect(page.locator("[data-template-document='vat_return']")).not.toBeChecked();
  await page.locator("[data-request-template='vat_filing']").check();
  await expect(page.getByText("선택 1개", { exact: true })).toBeVisible();
  await expect(page.locator("[data-request-template='vat_filing']")).toBeChecked();
  await expect(page.getByText(/선택 \d+개/).last()).toBeVisible();
  await expect(page.locator("[data-template-document='vat_return']")).toBeChecked();
  await expect(page.locator("[data-template-document='sales_tax_invoice_summary_by_customer']")).toBeChecked();
  await expect(page.locator("[data-template-document='pg_settlement_data']")).toBeChecked();
  await page.locator("[data-template-document='vat_return']").uncheck();
  await expect(page.getByText(/선택 \d+개/).last()).toBeVisible();
  await expect(page.locator("[data-request-template='vat_filing']")).toBeChecked();
  await expect(page.locator("[data-template-document='vat_return']")).not.toBeChecked();

  await page.getByLabel("샘플테크 주식회사 선택").check();
  await expect(page.getByText("선택 2개사")).toBeVisible();
  await expect(page.getByLabel("서비스").getByText(/샘플테크 주식회사/)).toBeVisible();
  await expect(page.getByText("선택됨")).toHaveCount(0);

  await page.getByRole("button", { name: "발송" }).click();
  const sendDialog = page.getByRole("dialog", { name: "자료제출 요청을 발송할까요?" });
  await expect(sendDialog).toBeVisible();
  await expect(sendDialog.getByText("선택한 고객사 담당자에게 자료제출 포털 링크를 보냅니다.")).toBeVisible();
  await expect(sendDialog.getByText("2개사")).toBeVisible();
  await expect(sendDialog.getByText("카카오톡", { exact: true })).toBeVisible();
  await expect(sendDialog.getByText("이메일", { exact: true })).toBeVisible();
  await expect(sendDialog.getByText("문자", { exact: true })).toBeVisible();
  await expect(sendDialog.getByLabel(/샘플테크 주식회사 .* 발송 대상/).first()).toBeChecked();
  await expect(sendDialog.getByLabel(/루멘커머스 .* 발송 대상/).first()).toBeChecked();
  await expect(sendDialog.getByText(/@sampletech\.kr|@sampletech\.co\.kr/).first()).toBeVisible();
  await expect(sendDialog.getByText(/@lumencommerce\.kr|@lumencommerce\.co\.kr/).first()).toBeVisible();
  await expect(sendDialog.getByRole("button", { name: "발송 확정" })).toBeEnabled();
  await sendDialog.getByRole("button", { name: "발송 확정" }).click();
  const confirmDialog = page.getByRole("dialog", { name: "고객에게 발송하시겠습니까?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "확인" }).click();
  await expect(sendDialog.getByRole("heading", { name: "생성된 자료제출 링크" })).toBeVisible();
  await expect(sendDialog.getByRole("link", { name: "자료제출 포털 미리보기" }).first()).toHaveAttribute("href", /\/submit\/.+/);
  await expect(sendDialog.getByRole("button", { name: "발송 완료" })).toBeDisabled();
  await sendDialog.getByRole("button", { name: "취소" }).click();
  await expect(sendDialog).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toHaveCount(0);
});

test("AuditMind accountant review page shows visual file workspace", async ({ page }) => {
  await page.goto("/?page=review");

  await expect(page.getByRole("heading", { name: "자료 검토 콘솔" })).toBeVisible();
  await expect(page.getByRole("link", { name: "제출자료 검토" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "고객사" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "제출요청일" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "제출마감일" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "제출", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "자료" })).toBeVisible();
  await expect(page.getByRole("region", { name: "고객 요청사항" })).toContainText("안녕하세요?");
  await page.getByRole("button", { name: "거래처 정산계좌 확인 0%" }).click();
  await page.getByRole("button", { name: "통장 사본" }).click();
  await expect(page.locator("#file-viewer-title")).toHaveText("선택 자료");
  await expect(page.getByText("보기용 PDF 변환본")).toHaveCount(0);
  await expect(page.getByText("원본 파일을 사람이 열었을 때 보이는 형태를 기준으로 표시합니다.")).toHaveCount(0);
  await expect(page.getByText("보기용 PDF · .png")).toHaveCount(0);
  await expect(page.getByLabel("문서 스크롤 뷰어")).toBeVisible();
  await expect(page.getByRole("button", { name: "이전" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다음" })).toHaveCount(0);
  await expect(page.getByLabel("이미지 1페이지")).toBeVisible();
  await expect(page.getByText("PDF 변환 결과 기준 페이지입니다.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "통장 사본", exact: true })).toBeVisible();
  await expect(page.getByText("필수 항목")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "계좌번호", exact: true })).toBeVisible();
  await expect(page.locator("[data-recognition-region]")).toHaveCount(7);
  await page.locator('[data-field-row="계좌번호"]').hover();
  await expect(page.locator("[data-recognition-connector]")).toBeVisible();
  await expect(page.getByLabel("메모")).toBeVisible();
  await expect(page.getByLabel("고객에게 보낼 코멘트")).toBeVisible();
  await expect(page.getByRole("region", { name: "통장 사본" }).getByText("요청사항")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toHaveCount(0);
});

test("AuditMind accountant template management page edits template bundles", async ({ page }) => {
  await page.goto("/?page=templates");

  await expect(page.getByRole("heading", { name: "자료 검토 콘솔" })).toBeVisible();
  await expect(page.getByRole("link", { name: "서비스 관리" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "서비스 관리" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "서비스 목록" })).toBeVisible();
  await expect(page.getByText("전체 111개")).toBeVisible();
  await expect(page.getByRole("button", { name: "신규 서비스 등록" })).toBeVisible();
  await expect(page.getByLabel("서비스 검색")).toBeVisible();
  await expect(page.getByText("111 / 111개")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "서비스명" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "업무 영역" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "자료 수" })).toBeVisible();
  await page.getByRole("cell", { name: "부가가치세 신고", exact: true }).click();
  await expect(page.getByRole("heading", { name: "서비스 설정" })).toBeVisible();
  await expect(page.getByText("부가가치세 신고").first()).toBeVisible();
  await expect(page.getByLabel("서비스명")).toHaveValue("부가가치세 신고");
  await expect(page.getByLabel("업무 영역")).toHaveValue("세무신고·세무대리");
  await expect(page.getByRole("textbox", { name: "내용" })).toHaveValue("부가가치세 신고를 위한 자료 요청 서비스");
  await expect(page.getByRole("heading", { name: "요청 자료" })).toBeVisible();
  await expect(page.getByLabel("요청 자료 검색")).toBeVisible();
  await expect(page.getByText(/선택 \d+개/).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "필수 항목" })).toBeVisible();
  await expect(page.locator("[data-template-document='vat_return']")).toBeChecked();
  await expect(page.locator("[data-template-document-row]").first()).toContainText("감가상각자산 취득명세서");
  await expect(page.locator("[data-template-document-row]").nth(1)).toContainText("대손세액공제 신고서");
  await page.locator("[data-template-document-row]").first().dispatchEvent("contextmenu");
  const requiredItemDialog = page.getByRole("dialog", { name: "필수 항목 수정" });
  await expect(requiredItemDialog).toBeVisible();
  await expect(requiredItemDialog.getByLabel("필수 항목")).toHaveValue(/문서명/);
  await requiredItemDialog.getByLabel("필수 항목").fill("문서명, 취득금액, 감가상각 누계액");
  await requiredItemDialog.getByRole("button", { name: "저장" }).click();
  await expect(requiredItemDialog).toHaveCount(0);
  await expect(page.locator("[data-template-document-row]").first()).toContainText("감가상각 누계액");

  await page.getByLabel("서비스 검색").fill("재무실사");
  await expect(page.getByLabel("서비스 검색")).toHaveValue("재무실사");
  await expect(page.getByRole("cell", { name: "재무실사", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "부가가치세 신고", exact: true })).toHaveCount(0);
  await page.getByLabel("서비스 검색").fill("");

  await page.getByLabel("요청 자료 검색").fill("세금계산서");
  await expect(page.getByLabel("요청 자료 검색")).toHaveValue("세금계산서");
  await expect(page.getByRole("cell", { name: "매출 세금계산서", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "사업자등록증", exact: true })).toHaveCount(0);
  await page.getByLabel("요청 자료 검색").fill("");

  await page.locator("[data-template-document='vat_return']").uncheck();
  await expect(page.getByText(/선택 \d+개/).first()).toBeVisible();
  await expect(page.locator("[data-template-document-row]").first()).toContainText("감가상각자산 취득명세서");
  await expect(page.getByRole("button", { name: "저장" })).toBeEnabled();
  await page.locator("[data-template-document='vat_return']").check();
  await expect(page.getByText(/선택 \d+개/).first()).toBeVisible();

  await page.getByRole("button", { name: "신규 서비스 등록" }).click();
  const addDialog = page.getByRole("dialog", { name: "서비스 설정" });
  await expect(addDialog).toBeVisible();
  await expect(page.getByText("전체 111개")).toBeVisible();
  await addDialog.getByRole("button", { name: "생성" }).click();
  await expect(addDialog.getByText("서비스명을 입력해 주세요.")).toBeVisible();
  await addDialog.getByLabel("서비스명").fill("신규 부가세 검토 서비스");
  await addDialog.getByLabel("업무 영역").fill("세무신고·세무대리");
  await addDialog.locator("[data-new-template-field='description']").fill("신규 서비스 등록 테스트");
  await expect(addDialog.getByRole("heading", { name: "요청자료" })).toBeVisible();
  await addDialog.getByLabel("요청자료 검색").fill("사업자등록증");
  await addDialog.locator("[data-new-template-document='business_registration_certificate']").check();
  await expect(addDialog.getByText("선택 1개")).toBeVisible();
  await addDialog.getByRole("button", { name: "생성" }).click();
  await expect(page.getByRole("dialog", { name: "서비스 설정" })).toHaveCount(0);
  await expect(page.getByText("신규 부가세 검토 서비스").first()).toBeVisible();
  await expect(page.getByText("전체 112개")).toBeVisible();
  await expect(page.getByLabel("서비스명")).toHaveValue("신규 부가세 검토 서비스");
  await expect(page.getByText("선택 1개")).toBeVisible();
  await expect(page.locator("[data-template-document='business_registration_certificate']")).toBeChecked();
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  await page.getByRole("button", { name: "서비스 삭제" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "서비스를 삭제할까요?" });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText("신규 부가세 검토 서비스");
  await deleteDialog.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByLabel("서비스명")).not.toHaveValue("신규 부가세 검토 서비스");
  await expect(page.getByText("전체 111개")).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toHaveCount(0);
});

test("AuditMind customer checklist shows submission states", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  await expect(page.getByRole("heading", { name: "부가세 신고서" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "카드매출 내역" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "통장 입금 내역" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "주요 매출계약서" })).toBeVisible();
  await expect(page.getByText("검수완료").first()).toBeVisible();
  await expect(page.getByText("오류").first()).toBeVisible();
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

test("AuditMind shows dedicated access notices between header and footer", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1&access=expired");

  await expect(page.getByRole("heading", { name: "자료 제출 포털" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이 링크는 더 이상 사용할 수 없습니다." })).toBeVisible();
  await expect(page.getByText("담당자에게 새 링크를 요청해 주세요.")).toBeVisible();
  await expect(page.getByLabel("사업자 및 약관 정보")).toBeVisible();
  await expect(page.getByRole("heading", { name: "자료 제출", exact: true })).toHaveCount(0);

  await page.goto("/submit/demo-token?mock=1&access=invalid");
  await expect(page.getByRole("heading", { name: "접근할 수 없는 제출 페이지입니다." })).toBeVisible();
  await expect(page.getByText("링크가 올바른지 확인해 주세요.")).toBeVisible();
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

  await page.goto("/submit/demo-token?mock=1");

  const requestSection = page.locator('section[aria-labelledby="request-title"]');
  const checklistSection = page.locator('section[aria-labelledby="checklist-title"]');

  await expect(requestSection.getByLabel("안내 메시지")).toBeVisible();
  await expect(checklistSection.getByLabel("안내 메시지")).toHaveCount(0);
  await expect(page.getByText("AI가 검토 중입니다.")).toBeVisible();
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
  await page.goto("/submit/demo-token?mock=1");

  const rejectedBox = await page.locator('[data-status-bubble="danger"]').first().boundingBox();
  const processingBox = await page.locator('[data-status-bubble="processing"]').first().boundingBox();
  const missingBox = await page.locator('[data-status-bubble="neutral"]').first().boundingBox();
  const approvedBox = await page.locator('[data-status-bubble="success"]').first().boundingBox();

  expect(rejectedBox.width).toBe(processingBox.width);
  expect(missingBox.width).toBe(processingBox.width);
  expect(approvedBox.width).toBe(processingBox.width);
  expect(rejectedBox.x).toBe(processingBox.x);
  expect(approvedBox.x).toBe(processingBox.x);
  expect(processingBox.height).toBeLessThanOrEqual(26);
});

test("AuditMind final submit changes a row into received state", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  const vatRow = page.locator('section[aria-labelledby="checklist-title"] ol > li').filter({
    has: page.getByRole("heading", { name: "부가세 신고서" }),
  });

  await expect(vatRow.locator("[data-status-bubble]")).toHaveText("검수완료");
  await vatRow.getByRole("button", { name: "최종 접수" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "이 자료를 최종 접수할까요?" })).toBeVisible();
  await expect(page.getByText("최종 접수하면 더 이상 수정할 수 없습니다.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "최종 접수" }).click();

  await expect(vatRow.locator("[data-status-bubble]")).toHaveText("접수완료");
  await expect(vatRow.getByRole("button", { name: "파일 업로드" })).toBeDisabled();
  await expect(vatRow.getByRole("button", { name: "최종 접수" })).toBeDisabled();
  await expect(vatRow.getByText("최종 접수가 완료되었습니다.", { exact: true })).toBeVisible();
  await expect(vatRow.getByText("회계사에게 안전하게 전달되었습니다.")).toHaveCount(0);
  await expect(vatRow.getByRole("link", { name: "부가세_신고서_2025_1기.pdf" })).toBeVisible();
});

test("AuditMind checklist rows use AI review lines and downloadable approved files", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  const checklistRows = page.locator('section[aria-labelledby="checklist-title"] ol > li');
  const vatRow = checklistRows.filter({ has: page.getByRole("heading", { name: "부가세 신고서" }) });
  const cardSalesRow = checklistRows.filter({ has: page.getByRole("heading", { name: "카드매출 내역" }) });
  const taxInvoiceRow = checklistRows.filter({ has: page.getByRole("heading", { name: "매출 세금계산서 합계표" }) });
  const bankRow = checklistRows.filter({ has: page.getByRole("heading", { name: "통장 입금 내역" }) });

  await expect(vatRow.getByText("AI 검수 완료율 100%입니다. 제출 기준에 맞게 첨부되었습니다.")).toBeVisible();
  await expect(vatRow.getByRole("link", { name: "부가세_신고서_2025_1기.pdf" })).toHaveAttribute("download", "부가세_신고서_2025_1기.pdf");
  await expect(vatRow.getByRole("link", { name: "부가세_신고서_2025_1기.pdf" })).toHaveAttribute("href", /(data:text\/plain|\/api\/submission-files)/);
  await expect(cardSalesRow.getByText("오류 사유: 3월 자료가 빠진 것으로 보입니다. 1월, 2월 파일만 자동 매칭되었습니다.")).toBeVisible();
  await expect(cardSalesRow.getByText("요청사항")).toBeVisible();
  await expect(cardSalesRow.getByText("3월 카드매출 내역도 추가로 업로드해 주세요.")).toBeVisible();
  await expect(taxInvoiceRow.getByText("AI가 문서를 분석 중입니다.")).toBeVisible();
  await expect(bankRow.getByText("아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.")).toBeVisible();
  await expect(bankRow.getByRole("link")).toHaveCount(0);
});

test("AuditMind status and action labels are paired by item state", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  const pairs = await page.locator('section[aria-labelledby="checklist-title"] ol > li').evaluateAll((rows) =>
    rows.map((row) => {
      const status = row.querySelector("[data-status-bubble]")?.textContent.trim();
      const action = row.querySelector("button")?.textContent.trim();
      return [status, action];
    }),
  );

  expect(pairs).toEqual([
    ["분석 중", "파일 업로드"],
    ["오류", "파일 업로드"],
    ["미접수", "파일 업로드"],
    ["미접수", "파일 업로드"],
    ["검수완료", "파일 업로드"],
    ["검수완료", "파일 업로드"],
  ]);
});

test("AuditMind upload refresh is disabled while a row is being analyzed", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  const actionStates = await page.locator('section[aria-labelledby="checklist-title"] ol > li').evaluateAll((rows) =>
    rows.map((row) => {
      const status = row.querySelector("[data-status-bubble]")?.textContent.trim();
      const uploadButton = row.querySelector("button");
      return [status, uploadButton?.disabled ?? null];
    }),
  );

  expect(actionStates).toEqual([
    ["분석 중", true],
    ["오류", false],
    ["미접수", false],
    ["미접수", false],
    ["검수완료", false],
    ["검수완료", false],
  ]);
});

test("AuditMind final submit is enabled only for approved files", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

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
    ["오류", true],
    ["미접수", true],
    ["미접수", true],
    ["검수완료", false],
    ["검수완료", false],
  ]);
});

test("AuditMind shows upload progress overlay after file selection", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

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
  await page.goto("/submit/demo-token?mock=1");

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
  await page.goto("/submit/demo-token?mock=1");

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

test("AuditMind applies routing results without filename overfitting", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

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
  await expect(cardSalesRow.locator("[data-status-bubble]")).toHaveText("오류");
  await expect(cardSalesRow.getByText("오류 사유: 3월 자료가 빠진 것으로 보입니다. 1월, 2월 파일만 자동 매칭되었습니다.")).toBeVisible();
  await expect(bankRow.locator("[data-status-bubble]")).toHaveText("미접수");
  await expect(bankRow.getByRole("link")).toHaveCount(0);
  await expect(contractRow.locator("[data-status-bubble]")).toHaveText("미접수");
});

test("AuditMind checklist filters show all or not-final rows", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

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
  await page.goto("/submit/demo-token?mock=1");

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
  await page.goto("/submit/demo-token?mock=1");

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
  await expect(page.locator("[data-upload-input]")).toHaveAttribute(
    "accept",
    ".pdf,.xls,.xlsx,.xlsm,.csv,.tsv,.doc,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.heic,.heif,.webp,.tiff,.tif,.zip",
  );
  await expect(page.getByRole("heading", { name: "제출 상태" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "접근 안내" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "참고 사항" })).toHaveCount(0);
  await expect(page.getByText("자료의 품질이 낮거나 누락 사항이 많은 경우 오류로 표시되거나 다시 제출요청을 받으실 수 있습니다.")).toBeVisible();
  await expect(page.getByText("고객님의 개인 정보는 외부로 유출되지 않고 AuditMind 내부에서만 사용됩니다.")).toBeVisible();
  await expect(page.getByText("최종 접수하기 전까지 언제든지 자료를 다시 업로드하실 수 있습니다.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "이용약관" })).toBeVisible();
  await expect(page.getByRole("link", { name: "보안 및 자료보호 안내" })).toBeVisible();
  await expect(page.getByRole("link", { name: "사업자정보 확인" })).toBeVisible();
  await expect(page.getByText("#####")).toHaveCount(0);
});

test("AuditMind document judgment approves only when identity and required fields are strong", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  const results = await page.evaluate(async () => {
    const { evaluateDocumentJudgment } = await import("/src/documentRouting.js");
    const checklistItem = {
      id: "vat_return",
      title: "부가세 신고서",
    };
    const requiredFields = [
      { key: "document_title", label: "문서명" },
      { key: "subject_company_name", label: "대상 회사명" },
      { key: "tax_period", label: "과세기간" },
      { key: "business_registration_number", label: "사업자등록번호" },
      { key: "supply_amount_total", label: "공급가액 합계" },
      { key: "vat_amount_total", label: "세액 합계" },
    ];

    return {
      correctVatReturn: evaluateDocumentJudgment({
        checklistItem,
        requiredFields,
        ocrResult: {
          textQuality: 0.95,
          layoutQuality: 0.9,
          fields: {
            document_title: { value: "부가가치세 신고서", confidence: 0.96, evidence: "1페이지 제목" },
            subject_company_name: { value: "샘플테크 주식회사", confidence: 0.94, evidence: "신고인 상호" },
            tax_period: { value: "2025년 제1기", confidence: 0.93, evidence: "과세기간" },
            business_registration_number: { value: "123-45-67890", confidence: 0.92, evidence: "사업자등록번호" },
            supply_amount_total: { value: "102000000", confidence: 0.9, evidence: "매출 공급가액 합계" },
            vat_amount_total: { value: "10200000", confidence: 0.9, evidence: "납부세액" },
          },
        },
        qwenJudgment: {
          isExpectedDocument: true,
          confidence: "high",
          coverage: 96,
          status: "approved",
          reason: "부가가치세 신고서 제목과 신고인, 과세기간, 세액 항목이 확인되었습니다.",
          evidence: [{ file: "부가세_신고서.pdf", basis: "홈택스 신고서 서식 확인" }],
        },
      }),
      wrongDocument: evaluateDocumentJudgment({
        checklistItem,
        requiredFields,
        ocrResult: {
          textQuality: 0.92,
          layoutQuality: 0.88,
          fields: {
            document_title: { value: "카드매출 내역", confidence: 0.96, evidence: "상단 제목" },
            subject_company_name: { value: "샘플테크 주식회사", confidence: 0.88, evidence: "가맹점명" },
          },
        },
        qwenJudgment: {
          isExpectedDocument: false,
          confidence: "high",
          coverage: 18,
          status: "rejected",
          reason: "요청한 자료는 부가세 신고서이나 업로드된 파일은 카드매출 내역으로 보입니다.",
          evidence: [{ file: "부가세라고_쓴_카드매출.xlsx", basis: "카드사 승인금액 컬럼 확인" }],
        },
      }),
      ambiguousButClaimedCorrect: evaluateDocumentJudgment({
        checklistItem,
        requiredFields,
        ocrResult: {
          textQuality: 0.58,
          layoutQuality: 0.52,
          fields: {
            document_title: { value: "부가세 신고 관련 자료", confidence: 0.62, evidence: "파일 첫 줄" },
            subject_company_name: { value: "샘플테크", confidence: 0.5, evidence: "흐린 스캔 영역" },
            tax_period: { value: "", confidence: 0.2 },
          },
        },
        qwenJudgment: {
          isExpectedDocument: true,
          confidence: "medium",
          coverage: 42,
          status: "approved",
          reason: "부가세 신고서일 가능성이 있으나 필수 항목 근거가 부족합니다.",
          evidence: [{ file: "흐린_부가세자료.jpg", basis: "일부 제목만 확인" }],
        },
      }),
    };
  });

  expect(results.correctVatReturn.status).toBe("approved");
  expect(results.correctVatReturn.customerStatus).toBe("approved");
  expect(results.correctVatReturn.reviewCompletionRate).toBeGreaterThanOrEqual(90);
  expect(results.correctVatReturn.missingRequiredFields).toEqual([]);

  expect(results.wrongDocument.status).toBe("rejected");
  expect(results.wrongDocument.customerStatus).toBe("rejected");
  expect(results.wrongDocument.reviewMessage).toContain("오류 사유");
  expect(results.wrongDocument.reason).toContain("카드매출 내역");

  expect(results.ambiguousButClaimedCorrect.status).not.toBe("approved");
  expect(results.ambiguousButClaimedCorrect.customerStatus).toBe("rejected");
  expect(results.ambiguousButClaimedCorrect.reviewCompletionRate).toBeLessThan(55);
  expect(results.ambiguousButClaimedCorrect.missingRequiredFields.map((field) => field.key)).toEqual([
    "tax_period",
    "business_registration_number",
    "supply_amount_total",
    "vat_amount_total",
  ]);
});

test("AuditMind reacts conservatively to official Korean tax form samples", async ({ page }) => {
  await page.goto("/submit/demo-token?mock=1");

  const results = await page.evaluate(async () => {
    const { evaluateDocumentJudgment } = await import("/src/documentRouting.js");
    const vatChecklistItem = {
      id: "vat_return",
      title: "부가세 신고서",
    };
    const vatRequiredFields = [
      { key: "document_title", label: "문서명" },
      { key: "subject_company_name", label: "대상 회사명" },
      { key: "tax_period", label: "과세기간" },
      { key: "business_registration_number", label: "사업자등록번호" },
      { key: "output_vat", label: "매출세액" },
      { key: "input_vat", label: "매입세액" },
      { key: "payable_or_refundable_vat", label: "납부세액 또는 환급세액" },
    ];

    const officialVatFormLikeText = [
      "일반과세자 부가가치세 예정 확정 신고서",
      "신고기간 2025년 제1기 2025년 1월 1일 ~ 2025년 6월 30일",
      "사업자 상호 법인명 샘플테크 주식회사 사업자등록번호 123-45-67890",
      "신고내용 과세표준 및 매출세액 합계",
      "매입세액 합계",
      "납부 환급 세액",
    ].join("\n");

    const officialDepreciableAssetScheduleText = [
      "건물 등 감가상각자산 취득명세서",
      "제출자 인적사항 성명 법인명 샘플테크 주식회사 사업자등록번호 123-45-67890",
      "감가상각자산 취득명세 합계",
      "감가상각자산 종류 건수 공급가액 세액 비고",
      "건물 구축물 기계장치 차량운반구",
    ].join("\n");

    return {
      officialVatReturn: evaluateDocumentJudgment({
        checklistItem: vatChecklistItem,
        requiredFields: vatRequiredFields,
        ocrResult: {
          text: officialVatFormLikeText,
          textQuality: 0.88,
          layoutQuality: 0.84,
          fields: {
            document_title: { value: "일반과세자 부가가치세 신고서", confidence: 0.92, evidence: "공식 서식 상단 제목" },
            subject_company_name: { value: "샘플테크 주식회사", confidence: 0.9, evidence: "사업자 상호 법인명" },
            tax_period: { value: "2025년 제1기", confidence: 0.86, evidence: "신고기간" },
            business_registration_number: { value: "123-45-67890", confidence: 0.9, evidence: "사업자등록번호" },
            output_vat: { value: "10,200,000", confidence: 0.82, evidence: "매출세액 합계" },
            input_vat: { value: "4,800,000", confidence: 0.82, evidence: "매입세액 합계" },
            payable_or_refundable_vat: { value: "5,400,000", confidence: 0.8, evidence: "납부 환급 세액" },
          },
        },
        qwenJudgment: {
          isExpectedDocument: true,
          confidence: "high",
          coverage: 91,
          status: "approved",
          reason: "공식 부가가치세 신고서 서식의 제목, 신고기간, 사업자등록번호, 매출세액과 매입세액 항목이 확인되었습니다.",
          evidence: [{ source: "국세청 부가가치세 신고서 서식", basis: "상단 제목 및 신고내용 표" }],
        },
      }),
      officialButWrongTaxSchedule: evaluateDocumentJudgment({
        checklistItem: vatChecklistItem,
        requiredFields: vatRequiredFields,
        ocrResult: {
          text: officialDepreciableAssetScheduleText,
          textQuality: 0.9,
          layoutQuality: 0.86,
          fields: {
            document_title: { value: "건물 등 감가상각자산 취득명세서", confidence: 0.94, evidence: "공식 서식 상단 제목" },
            subject_company_name: { value: "샘플테크 주식회사", confidence: 0.9, evidence: "제출자 인적사항" },
            business_registration_number: { value: "123-45-67890", confidence: 0.9, evidence: "제출자 인적사항" },
            output_vat: { value: "", confidence: 0.1 },
            input_vat: { value: "", confidence: 0.1 },
            payable_or_refundable_vat: { value: "", confidence: 0.1 },
          },
        },
        qwenJudgment: {
          isExpectedDocument: false,
          confidence: "high",
          coverage: 26,
          status: "rejected",
          reason: "공식 세무 서식이지만 요청한 부가세 신고서가 아니라 감가상각자산 취득명세서로 보입니다.",
          evidence: [{ source: "국세청 감가상각자산 취득명세서 서식", basis: "서식 제목 및 취득명세 표" }],
        },
      }),
    };
  });

  expect(results.officialVatReturn.status).toBe("approved");
  expect(results.officialVatReturn.reviewCompletionRate).toBeGreaterThanOrEqual(80);
  expect(results.officialVatReturn.foundRequiredFields.map((field) => field.key)).toEqual([
    "document_title",
    "subject_company_name",
    "tax_period",
    "business_registration_number",
    "output_vat",
    "input_vat",
    "payable_or_refundable_vat",
  ]);

  expect(results.officialButWrongTaxSchedule.status).toBe("rejected");
  expect(results.officialButWrongTaxSchedule.reason).toContain("감가상각자산 취득명세서");
  expect(results.officialButWrongTaxSchedule.reviewMessage).toContain("오류 사유");
  expect(results.officialButWrongTaxSchedule.missingRequiredFields.map((field) => field.key)).toEqual([
    "tax_period",
    "output_vat",
    "input_vat",
    "payable_or_refundable_vat",
  ]);
});
