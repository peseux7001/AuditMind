-- AuditMind document required-field seed.
-- Purpose: give PaddleOCR/Qwen enough anchors to decide whether a file is the requested document,
-- whether key values are present, and how reliable the match is.
-- Scope: minimum sufficient fields, not exhaustive accounting/tax extraction.

WITH common_fields(field_key, field_label, value_type, is_required, extraction_hint, sort_order) AS (
  VALUES
    ('document_title', '문서명', 'text', true, '문서 표지, 상단 제목, 서식명, 파일 내 가장 큰 제목에서 확인한다.', 10),
    ('subject_company_name', '대상 회사명', 'text', false, '상호, 법인명, 회사명, 사업자명, 고객명, 거래처명으로 표시된 대상 회사를 확인한다.', 20),
    ('document_period_or_date', '문서 기준기간 또는 작성일', 'period', false, '과세기간, 사업연도, 귀속연월, 거래기간, 작성일, 발급일, 계약일 중 문서 성격에 맞는 기준일자를 확인한다.', 30),
    ('issuer_or_source', '발급기관 또는 작성주체', 'text', false, '국세청, 홈택스, 은행, 카드사, 거래처, 내부 작성부서, 계약 당사자 등 문서 출처를 확인한다.', 40)
),
category_fields(category_code, field_key, field_label, value_type, is_required, extraction_hint, sort_order) AS (
  VALUES
    ('company_basic', 'registration_identifier', '등록번호 또는 식별번호', 'text', false, '사업자등록번호, 법인등록번호, 등기번호, 고유번호가 있으면 추출한다.', 100),
    ('company_basic', 'registered_address', '등록 주소', 'text', false, '본점, 사업장 소재지, 주소 항목이 있으면 추출한다.', 110),
    ('company_basic', 'representative_name', '대표자명', 'text', false, '대표자, 사내이사, 대표이사, 성명 항목을 확인한다.', 120),

    ('accounting_closing', 'reporting_period', '보고기간', 'period', true, '사업연도, 회계기간, 결산기간, 기준일을 확인한다.', 100),
    ('accounting_closing', 'account_or_line_item_name', '계정명 또는 항목명', 'text', true, '재무제표 항목명, 계정과목, 원장 계정명, 시산표 계정명을 확인한다.', 110),
    ('accounting_closing', 'amount_or_balance', '금액 또는 잔액', 'amount', true, '잔액, 차변, 대변, 당기 금액, 전기 금액, 합계 금액을 확인한다.', 120),

    ('revenue', 'revenue_period', '매출 기준기간', 'period', true, '매출월, 과세기간, 정산기간, 거래기간, 신고기간을 확인한다.', 100),
    ('revenue', 'counterparty_name', '거래처명', 'text', false, '매출처, 공급받는 자, 고객사, 플랫폼, 카드사, PG사를 확인한다.', 110),
    ('revenue', 'supply_or_sales_amount', '공급가액 또는 매출액', 'amount', true, '공급가액, 매출액, 결제금액, 정산금액, 청구금액을 확인한다.', 120),
    ('revenue', 'vat_or_fee_amount', '세액 또는 수수료', 'amount', false, '부가가치세, 카드수수료, PG수수료, 플랫폼수수료가 있으면 추출한다.', 130),

    ('purchase_expense', 'expense_period', '비용 기준기간', 'period', true, '사용일, 지출일, 매입기간, 정산기간, 청구기간을 확인한다.', 100),
    ('purchase_expense', 'vendor_name', '공급자 또는 지급처', 'text', false, '공급자, 가맹점, 거래처, 외주업체, 임직원명을 확인한다.', 110),
    ('purchase_expense', 'expense_amount', '지출금액', 'amount', true, '공급가액, 지출금액, 카드사용액, 청구금액, 지급금액을 확인한다.', 120),
    ('purchase_expense', 'approval_or_evidence_number', '승인번호 또는 증빙번호', 'text', false, '카드 승인번호, 전표번호, 세금계산서 승인번호, 지출결의번호가 있으면 추출한다.', 130),

    ('finance_cash', 'financial_institution_name', '금융기관명', 'text', true, '은행명, 카드사명, 금융기관명을 확인한다.', 100),
    ('finance_cash', 'account_or_contract_number', '계좌번호 또는 약정번호', 'text', false, '계좌번호, 카드번호 일부, 대출번호, 약정번호를 확인한다.', 110),
    ('finance_cash', 'financial_period_or_base_date', '거래기간 또는 기준일', 'period', true, '거래기간, 조회기간, 기준일, 잔액기준일을 확인한다.', 120),
    ('finance_cash', 'balance_or_transaction_amount', '잔액 또는 거래금액', 'amount', true, '예금잔액, 입금액, 출금액, 차입금 잔액, 이자금액을 확인한다.', 130),

    ('receivable_payable', 'balance_base_date', '잔액 기준일', 'date', true, '잔액명세서 기준일, 결산일, 조회 기준일을 확인한다.', 100),
    ('receivable_payable', 'counterparty_name', '거래처명', 'text', true, '채권자, 채무자, 매출처, 매입처, 거래처명을 확인한다.', 110),
    ('receivable_payable', 'balance_amount', '잔액', 'amount', true, '매출채권, 매입채무, 미수금, 미지급금, 선급금, 선수금 잔액을 확인한다.', 120),

    ('inventory', 'inventory_base_date', '재고 기준일', 'date', true, '실사일, 결산일, 재고 기준일을 확인한다.', 100),
    ('inventory', 'item_name', '품목명', 'text', true, '품목명, 제품명, 원재료명, SKU를 확인한다.', 110),
    ('inventory', 'quantity', '수량', 'number', true, '기말수량, 실사수량, 입고수량, 출고수량을 확인한다.', 120),
    ('inventory', 'unit_cost_or_amount', '단가 또는 금액', 'amount', false, '단가, 평가액, 장부금액, 저가법 평가금액이 있으면 추출한다.', 130),

    ('fixed_intangible_assets', 'asset_name', '자산명', 'text', true, '자산명, 차량번호, 부동산 소재지, 소프트웨어명, 특허명, 상표명을 확인한다.', 100),
    ('fixed_intangible_assets', 'acquisition_or_contract_date', '취득일 또는 계약일', 'date', false, '취득일, 처분일, 계약일, 등록일을 확인한다.', 110),
    ('fixed_intangible_assets', 'acquisition_or_book_amount', '취득가액 또는 장부금액', 'amount', true, '취득가액, 처분가액, 감가상각누계액, 장부금액을 확인한다.', 120),

    ('payroll_withholding', 'payroll_period', '급여 또는 신고 기준기간', 'period', true, '지급월, 귀속연월, 급여기간, 신고기간을 확인한다.', 100),
    ('payroll_withholding', 'employee_or_payee_name', '임직원 또는 지급대상자', 'text', false, '성명, 사번, 임직원명, 소득자를 확인한다.', 110),
    ('payroll_withholding', 'gross_payment_amount', '총지급액', 'amount', true, '급여, 상여, 사업소득, 퇴직소득, 지급총액을 확인한다.', 120),
    ('payroll_withholding', 'withholding_tax_amount', '원천징수세액', 'amount', false, '소득세, 지방소득세, 원천징수세액이 있으면 추출한다.', 130),

    ('vat', 'business_registration_number', '사업자등록번호', 'text', true, '신고자 또는 사업자의 사업자등록번호를 확인한다.', 100),
    ('vat', 'tax_period', '과세기간', 'period', true, '부가가치세 과세기간, 예정/확정 신고기간을 확인한다.', 110),
    ('vat', 'supply_amount_total', '공급가액 합계', 'amount', true, '매출 또는 매입 공급가액 합계를 확인한다.', 120),
    ('vat', 'vat_amount_total', '세액 합계', 'amount', true, '매출세액, 매입세액, 부가가치세 합계를 확인한다.', 130),

    ('corporate_tax', 'business_registration_number', '사업자등록번호', 'text', true, '법인 또는 신고자의 사업자등록번호를 확인한다.', 100),
    ('corporate_tax', 'fiscal_year', '사업연도', 'period', true, '법인세 신고 사업연도 또는 회계기간을 확인한다.', 110),
    ('corporate_tax', 'tax_base_or_adjusted_amount', '과세표준 또는 조정금액', 'amount', true, '과세표준, 산출세액, 조정금액, 세액공제 금액을 확인한다.', 120),

    ('legal_contract', 'contract_parties', '계약 당사자', 'text', true, '갑, 을, 매도인, 매수인, 임대인, 임차인, 투자자, 발행회사를 확인한다.', 100),
    ('legal_contract', 'contract_date', '계약일', 'date', true, '계약 체결일, 약정일, 효력발생일을 확인한다.', 110),
    ('legal_contract', 'contract_amount', '계약금액', 'amount', false, '계약금액, 투자금액, 차입금액, 보증금, 월 임대료가 있으면 추출한다.', 120),
    ('legal_contract', 'contract_period', '계약기간', 'period', false, '계약기간, 만기, 임대기간, 용역기간이 있으면 추출한다.', 130),

    ('industry_specific', 'industry_period_or_base_date', '업종자료 기준기간 또는 기준일', 'period', true, '생산일, 공사기간, 정산기간, 지급기간, 협약기간, 과제기간을 확인한다.', 100),
    ('industry_specific', 'industry_item_or_project_name', '품목명 또는 프로젝트명', 'text', true, '품목, 공사명, 플랫폼명, 과제명, 의료장비명, 투자증권명을 확인한다.', 110),
    ('industry_specific', 'industry_amount_or_quantity', '금액 또는 수량', 'amount', true, '생산수량, 공사원가, 정산금액, 지급액, 투자금액, 과제비를 확인한다.', 120)
),
type_fields(document_code, field_key, field_label, value_type, is_required, extraction_hint, sort_order) AS (
  VALUES
    ('business_registration_certificate', 'business_registration_number', '사업자등록번호', 'text', true, '사업자등록증의 등록번호를 확인한다.', 200),
    ('business_registration_certificate', 'business_type', '업태', 'text', true, '사업자등록증의 업태를 확인한다.', 210),
    ('business_registration_certificate', 'business_item', '종목', 'text', true, '사업자등록증의 종목을 확인한다.', 220),

    ('corporate_registry_certificate', 'corporate_registration_number', '법인등록번호', 'text', true, '등기사항전부증명서의 법인등록번호를 확인한다.', 200),
    ('corporate_registry_certificate', 'head_office_address', '본점 소재지', 'text', true, '등기사항전부증명서의 본점 주소를 확인한다.', 210),
    ('corporate_registry_certificate', 'capital_amount', '자본금', 'amount', false, '등기사항전부증명서의 자본금 총액을 확인한다.', 220),

    ('statement_of_financial_position', 'total_assets', '자산총계', 'amount', true, '재무상태표의 자산총계를 확인한다.', 200),
    ('statement_of_financial_position', 'total_liabilities', '부채총계', 'amount', true, '재무상태표의 부채총계를 확인한다.', 210),
    ('statement_of_financial_position', 'total_equity', '자본총계', 'amount', true, '재무상태표의 자본총계를 확인한다.', 220),
    ('income_statement', 'revenue_amount', '매출액', 'amount', true, '손익계산서의 매출액을 확인한다.', 200),
    ('income_statement', 'operating_income', '영업이익', 'amount', false, '손익계산서의 영업이익을 확인한다.', 210),
    ('income_statement', 'net_income', '당기순이익', 'amount', true, '손익계산서의 당기순이익을 확인한다.', 220),

    ('sales_tax_invoice', 'supplier_registration_number', '공급자 사업자등록번호', 'text', true, '세금계산서의 공급자 등록번호를 확인한다.', 200),
    ('sales_tax_invoice', 'customer_registration_number', '공급받는 자 사업자등록번호', 'text', true, '세금계산서의 공급받는 자 등록번호를 확인한다.', 210),
    ('sales_tax_invoice', 'issue_date', '작성일자', 'date', true, '세금계산서의 작성일자를 확인한다.', 220),
    ('sales_tax_invoice', 'total_amount', '합계금액', 'amount', true, '세금계산서의 합계금액을 확인한다.', 230),
    ('purchase_tax_invoice', 'supplier_registration_number', '공급자 사업자등록번호', 'text', true, '세금계산서의 공급자 등록번호를 확인한다.', 200),
    ('purchase_tax_invoice', 'customer_registration_number', '공급받는 자 사업자등록번호', 'text', true, '세금계산서의 공급받는 자 등록번호를 확인한다.', 210),
    ('purchase_tax_invoice', 'issue_date', '작성일자', 'date', true, '세금계산서의 작성일자를 확인한다.', 220),
    ('purchase_tax_invoice', 'total_amount', '합계금액', 'amount', true, '세금계산서의 합계금액을 확인한다.', 230),

    ('vat_return', 'output_vat', '매출세액', 'amount', true, '부가가치세 신고서의 매출세액 합계를 확인한다.', 200),
    ('vat_return', 'input_vat', '매입세액', 'amount', true, '부가가치세 신고서의 매입세액 합계를 확인한다.', 210),
    ('vat_return', 'payable_or_refundable_vat', '납부세액 또는 환급세액', 'amount', true, '부가가치세 신고서의 납부할 세액 또는 환급받을 세액을 확인한다.', 220),

    ('bank_transaction_statement', 'bank_name', '은행명', 'text', true, '계좌거래내역의 은행명을 확인한다.', 200),
    ('bank_transaction_statement', 'account_number', '계좌번호', 'text', true, '계좌거래내역의 계좌번호를 확인한다.', 210),
    ('bank_transaction_statement', 'deposit_amount', '입금액', 'amount', false, '거래내역의 입금액을 확인한다.', 220),
    ('bank_transaction_statement', 'withdrawal_amount', '출금액', 'amount', false, '거래내역의 출금액을 확인한다.', 230),

    ('payroll_register', 'employee_count', '인원수', 'number', false, '급여대장의 지급 대상 인원수를 확인한다.', 200),
    ('payroll_register', 'net_payment_amount', '실지급액', 'amount', true, '급여대장의 실지급액 또는 차인지급액을 확인한다.', 210),
    ('withholding_tax_payment_statement', 'income_type', '소득구분', 'text', true, '원천징수이행상황신고서의 근로소득, 사업소득 등 소득구분을 확인한다.', 200),
    ('withholding_tax_payment_statement', 'payee_count', '인원', 'number', true, '원천징수이행상황신고서의 인원을 확인한다.', 210),

    ('major_sales_contract', 'customer_name', '매출처명', 'text', true, '주요 매출계약서의 고객사 또는 매출처를 확인한다.', 200),
    ('major_sales_contract', 'service_or_goods', '계약 대상 재화 또는 용역', 'text', true, '계약 대상 제품, 서비스, 용역 범위를 확인한다.', 210),
    ('investment_agreement', 'investment_amount', '투자금액', 'amount', true, '투자계약서의 투자금액을 확인한다.', 200),
    ('investment_agreement', 'security_type', '증권 종류', 'text', false, '보통주, 우선주, 전환사채, SAFE 등 투자 증권 종류를 확인한다.', 210),
    ('loan_agreement', 'principal_amount', '차입원금', 'amount', true, '대출약정서의 차입원금을 확인한다.', 200),
    ('loan_agreement', 'interest_rate', '이자율', 'number', false, '대출약정서의 이자율을 확인한다.', 210),
    ('loan_agreement', 'maturity_date', '만기일', 'date', false, '대출약정서의 만기일을 확인한다.', 220)
),
all_fields AS (
  SELECT
    dt.id AS document_type_id,
    cf.field_key,
    cf.field_label,
    cf.value_type,
    cf.is_required,
    cf.extraction_hint,
    cf.sort_order
  FROM document_types dt
  CROSS JOIN common_fields cf

  UNION ALL

  SELECT
    dt.id AS document_type_id,
    cat.field_key,
    cat.field_label,
    cat.value_type,
    cat.is_required,
    cat.extraction_hint,
    cat.sort_order
  FROM document_types dt
  JOIN document_categories dc ON dc.id = dt.category_id
  JOIN category_fields cat ON cat.category_code = dc.code

  UNION ALL

  SELECT
    dt.id AS document_type_id,
    tf.field_key,
    tf.field_label,
    tf.value_type,
    tf.is_required,
    tf.extraction_hint,
    tf.sort_order
  FROM document_types dt
  JOIN type_fields tf ON tf.document_code = dt.code
)
INSERT INTO document_type_required_fields (
  document_type_id,
  field_key,
  field_label,
  value_type,
  is_required,
  extraction_hint,
  sort_order
)
SELECT
  document_type_id,
  field_key,
  field_label,
  value_type,
  is_required,
  extraction_hint,
  sort_order
FROM all_fields
ON CONFLICT (document_type_id, field_key) DO UPDATE SET
  field_label = EXCLUDED.field_label,
  value_type = EXCLUDED.value_type,
  is_required = EXCLUDED.is_required,
  extraction_hint = EXCLUDED.extraction_hint,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
