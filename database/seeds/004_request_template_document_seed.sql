-- AuditMind request template to document type default mappings.
-- These mappings are practical starting presets, not final professional judgments.
-- Accountants must be able to add/remove documents before sending a customer request.

WITH profile_seed(profile_code, required_document_codes, optional_document_codes) AS (
  VALUES
    ('audit_base',
      ARRAY[
        'business_registration_certificate',
        'corporate_registry_certificate',
        'articles_of_incorporation',
        'shareholder_register',
        'organization_chart',
        'general_ledger',
        'account_ledger',
        'trial_balance',
        'statement_of_financial_position',
        'income_statement',
        'cash_flow_statement',
        'statement_of_changes_in_equity',
        'tax_adjustment_statement',
        'bank_account_list',
        'bank_balance_certificate',
        'bank_transaction_statement',
        'accounts_receivable_balance_by_customer',
        'accounts_payable_balance_by_vendor',
        'fixed_asset_register',
        'depreciation_expense_schedule',
        'employee_roster',
        'payroll_register'
      ],
      ARRAY[
        'board_meeting_minutes',
        'shareholder_meeting_minutes',
        'accounting_policy',
        'approval_authority_policy',
        'related_party_status',
        'inventory_schedule_by_item',
        'inventory_count_sheet',
        'major_sales_contract',
        'major_purchase_contract',
        'loan_agreement',
        'litigation_status_schedule',
        'attorney_inquiry_letter'
      ]),

    ('financial_statement_review',
      ARRAY[
        'trial_balance',
        'statement_of_financial_position',
        'income_statement',
        'cash_flow_statement',
        'statement_of_changes_in_equity',
        'retained_earnings_appropriation_statement',
        'tax_adjustment_statement',
        'general_ledger',
        'account_ledger'
      ],
      ARRAY[
        'closing_adjustment_statement',
        'bank_balance_certificate',
        'accounts_receivable_balance_schedule',
        'borrowings_schedule',
        'fixed_asset_register',
        'depreciation_expense_schedule'
      ]),

    ('internal_control',
      ARRAY[
        'organization_chart',
        'accounting_policy',
        'approval_authority_policy',
        'hr_policy',
        'expense_approval_evidence',
        'payment_request_form',
        'voucher',
        'journal',
        'bank_account_list',
        'corporate_card_usage_statement'
      ],
      ARRAY[
        'board_meeting_minutes',
        'employee_roster',
        'business_partner_address_book',
        'outsourcing_service_contract'
      ]),

    ('vat_filing',
      ARRAY[
        'vat_return',
        'sales_tax_invoice_summary_by_customer',
        'purchase_tax_invoice_summary_by_vendor',
        'credit_card_sales_slip_issue_summary',
        'credit_card_sales_slip_receipt_statement',
        'cash_receipt_sales_statement'
      ],
      ARRAY[
        'sales_invoice_summary_by_customer',
        'purchase_invoice_summary_by_vendor',
        'zero_rated_vat_attachment',
        'deemed_input_vat_credit_report',
        'bad_debt_vat_credit_report',
        'real_estate_rental_supply_value_statement',
        'cash_sales_statement',
        'building_depreciable_asset_acquisition_statement',
        'card_sales_statement',
        'pg_settlement_data',
        'platform_sales_settlement_data',
        'purchase_tax_invoice',
        'purchase_invoice'
      ]),

    ('corporate_tax',
      ARRAY[
        'corporate_tax_return',
        'statement_of_financial_position',
        'income_statement',
        'tax_adjustment_statement',
        'general_ledger',
        'trial_balance'
      ],
      ARRAY[
        'retained_earnings_appropriation_statement',
        'deficit_disposition_statement',
        'depreciation_adjustment_schedule',
        'entertainment_expense_adjustment_schedule',
        'donation_adjustment_schedule',
        'retirement_benefit_allowance_adjustment_schedule',
        'bad_debt_allowance_adjustment_schedule',
        'inventory_valuation_adjustment_schedule',
        'research_hr_development_tax_credit_application',
        'integrated_investment_tax_credit_application',
        'tax_loss_carryforward_schedule',
        'related_party_transaction_statement',
        'cash_flow_statement'
      ]),

    ('bookkeeping',
      ARRAY[
        'business_registration_certificate',
        'bank_transaction_statement',
        'sales_tax_invoice',
        'purchase_tax_invoice',
        'card_sales_statement',
        'credit_card_usage_statement',
        'corporate_card_usage_statement',
        'cash_receipt',
        'payroll_register'
      ],
      ARRAY[
        'sales_invoice',
        'purchase_invoice',
        'cash_receipt_sales_statement',
        'pg_settlement_data',
        'platform_sales_settlement_data',
        'payment_request_form',
        'employee_expense_report',
        'bankbook_copy',
        'monthly_sales_summary',
        'monthly_purchase_summary'
      ]),

    ('monthly_closing',
      ARRAY[
        'general_ledger',
        'account_ledger',
        'trial_balance',
        'bank_transaction_statement',
        'monthly_sales_summary',
        'monthly_purchase_summary',
        'closing_adjustment_statement'
      ],
      ARRAY[
        'statement_of_financial_position',
        'income_statement',
        'cash_flow_statement',
        'accounts_receivable_balance_by_customer',
        'accounts_payable_balance_by_vendor',
        'inventory_schedule_by_item',
        'fixed_asset_register',
        'payroll_register'
      ]),

    ('withholding_payroll',
      ARRAY[
        'employee_roster',
        'payroll_register',
        'withholding_tax_payment_statement'
      ],
      ARRAY[
        'employment_contract',
        'bonus_payment_statement',
        'severance_pay_calculation_document',
        'earned_income_payment_statement',
        'business_income_payment_statement',
        'daily_worker_income_payment_statement',
        'retirement_income_payment_statement',
        'simplified_payment_statement',
        'four_major_insurance_billing_statement',
        'four_major_insurance_payment_statement',
        'year_end_tax_settlement_document'
      ]),

    ('year_end_tax_settlement',
      ARRAY[
        'employee_roster',
        'payroll_register',
        'year_end_tax_settlement_document',
        'earned_income_payment_statement'
      ],
      ARRAY[
        'withholding_tax_payment_statement',
        'simplified_payment_statement',
        'four_major_insurance_billing_statement',
        'four_major_insurance_payment_statement'
      ]),

    ('four_major_insurance',
      ARRAY[
        'employee_roster',
        'employment_contract',
        'payroll_register',
        'four_major_insurance_billing_statement',
        'four_major_insurance_payment_statement'
      ],
      ARRAY[
        'bonus_payment_statement',
        'severance_pay_calculation_document',
        'retirement_pension_enrollment_statement'
      ]),

    ('tax_dispute',
      ARRAY[
        'business_registration_certificate',
        'tax_adjustment_statement',
        'general_ledger',
        'account_ledger',
        'trial_balance',
        'sales_tax_invoice',
        'purchase_tax_invoice',
        'bank_transaction_statement'
      ],
      ARRAY[
        'vat_return',
        'corporate_tax_return',
        'withholding_tax_payment_statement',
        'major_sales_contract',
        'major_purchase_contract',
        'expense_approval_evidence',
        'payment_request_form',
        'certified_content_mail',
        'dispute_related_document'
      ]),

    ('international_tax',
      ARRAY[
        'business_registration_certificate',
        'related_party_status',
        'related_party_transaction_statement',
        'general_ledger',
        'trial_balance',
        'major_sales_contract',
        'major_purchase_contract',
        'commercial_invoice',
        'foreign_exchange_earning_statement'
      ],
      ARRAY[
        'export_declaration_certificate',
        'packing_list',
        'bill_of_lading',
        'loan_agreement',
        'investment_agreement',
        'license_agreement',
        'foreign_currency_deposit_schedule',
        'foreign_currency_borrowings_schedule'
      ]),

    ('financial_due_diligence',
      ARRAY[
        'business_registration_certificate',
        'corporate_registry_certificate',
        'shareholder_register',
        'company_profile',
        'business_plan',
        'general_ledger',
        'trial_balance',
        'statement_of_financial_position',
        'income_statement',
        'cash_flow_statement',
        'monthly_sales_summary',
        'bank_transaction_statement',
        'borrowings_schedule'
      ],
      ARRAY[
        'accounts_receivable_aging_report',
        'accounts_payable_balance_by_vendor',
        'inventory_schedule_by_item',
        'fixed_asset_register',
        'payroll_register',
        'major_sales_contract',
        'major_purchase_contract',
        'investment_agreement',
        'shareholders_agreement',
        'litigation_status_schedule',
        'tax_adjustment_statement'
      ]),

    ('tax_due_diligence',
      ARRAY[
        'business_registration_certificate',
        'tax_adjustment_statement',
        'corporate_tax_return',
        'vat_return',
        'withholding_tax_payment_statement',
        'related_party_transaction_statement'
      ],
      ARRAY[
        'sales_tax_invoice_summary_by_customer',
        'purchase_tax_invoice_summary_by_vendor',
        'research_hr_development_tax_credit_application',
        'integrated_investment_tax_credit_application',
        'entertainment_expense_adjustment_schedule',
        'donation_adjustment_schedule'
      ]),

    ('valuation',
      ARRAY[
        'business_registration_certificate',
        'corporate_registry_certificate',
        'shareholder_register',
        'company_profile',
        'business_plan',
        'statement_of_financial_position',
        'income_statement',
        'cash_flow_statement',
        'monthly_sales_summary'
      ],
      ARRAY[
        'product_service_list',
        'major_sales_contract',
        'investment_agreement',
        'shareholders_agreement',
        'stock_option_grant_agreement',
        'convertible_bond_subscription_agreement',
        'redeemable_convertible_preferred_share_investment_agreement',
        'intangible_asset_impairment_review'
      ]),

    ('accounting_advisory',
      ARRAY[
        'business_registration_certificate',
        'general_ledger',
        'trial_balance',
        'statement_of_financial_position',
        'income_statement',
        'accounting_policy',
        'closing_adjustment_statement'
      ],
      ARRAY[
        'major_sales_contract',
        'lease_agreement',
        'loan_agreement',
        'investment_agreement',
        'stock_option_grant_agreement',
        'share_based_compensation_valuation_document',
        'fixed_asset_register',
        'intangible_asset_impairment_review'
      ]),

    ('startup_finance_readiness',
      ARRAY[
        'business_registration_certificate',
        'corporate_registry_certificate',
        'shareholder_register',
        'company_profile',
        'business_plan',
        'statement_of_financial_position',
        'income_statement',
        'monthly_sales_summary',
        'bank_transaction_statement'
      ],
      ARRAY[
        'investment_agreement',
        'shareholders_agreement',
        'stock_option_grant_agreement',
        'safe_agreement',
        'convertible_bond_subscription_agreement',
        'redeemable_convertible_preferred_share_investment_agreement',
        'government_grant_agreement',
        'rd_expense_usage_statement',
        'project_expense_supporting_document'
      ]),

    ('government_grant',
      ARRAY[
        'business_registration_certificate',
        'government_grant_agreement',
        'rd_expense_usage_statement',
        'project_expense_supporting_document',
        'bank_transaction_statement',
        'payroll_register'
      ],
      ARRAY[
        'research_hr_development_tax_credit_application',
        'employee_roster',
        'employment_contract',
        'corporate_card_usage_statement',
        'payment_request_form',
        'expense_approval_evidence'
      ]),

    ('ecommerce_settlement',
      ARRAY[
        'platform_sales_settlement_data',
        'pg_settlement_data',
        'card_sales_statement',
        'cash_receipt_sales_statement',
        'bank_transaction_statement'
      ],
      ARRAY[
        'industry_platform_settlement_data',
        'shipping_fee_settlement_data',
        'return_statement',
        'refund_statement',
        'coupon_settlement_data',
        'point_settlement_data',
        'sales_tax_invoice',
        'purchase_tax_invoice'
      ]),

    ('manufacturing_cost',
      ARRAY[
        'inventory_schedule_by_item',
        'inventory_movement_ledger',
        'bill_of_materials',
        'daily_production_report',
        'raw_material_movement_ledger',
        'manufacturing_cost_statement',
        'cost_calculation_document'
      ],
      ARRAY[
        'outsourcing_processing_fee_schedule',
        'inventory_count_sheet',
        'ending_inventory_valuation_document',
        'lower_of_cost_or_market_valuation_document',
        'scrapped_inventory_statement',
        'defective_inventory_statement'
      ]),

    ('construction_progress',
      ARRAY[
        'construction_contract',
        'construction_cost_statement',
        'percentage_of_completion_calculation',
        'subcontract_agreement',
        'advance_payments_schedule',
        'unbilled_construction_schedule'
      ],
      ARRAY[
        'bank_transaction_statement',
        'major_sales_contract',
        'major_purchase_contract',
        'purchase_tax_invoice',
        'payment_request_form'
      ]),

    ('medical_revenue',
      ARRAY[
        'nhis_payment_statement',
        'non_insured_medical_sales_data',
        'card_sales_statement',
        'cash_receipt_sales_statement',
        'bank_transaction_statement'
      ],
      ARRAY[
        'medical_equipment_lease_agreement',
        'medical_equipment_purchase_document',
        'fixed_asset_register',
        'lease_agreement'
      ])
),
template_profile(template_code, profile_code) AS (
  VALUES
    ('external_audit', 'audit_base'),
    ('voluntary_audit', 'audit_base'),
    ('financial_statement_review', 'financial_statement_review'),
    ('internal_control_audit', 'internal_control'),
    ('internal_control_review', 'internal_control'),
    ('agreed_upon_procedures', 'audit_base'),
    ('grant_settlement_verification', 'government_grant'),
    ('public_interest_entity_audit', 'audit_base'),
    ('nonprofit_audit', 'audit_base'),
    ('special_purpose_financial_statement_audit', 'financial_statement_review'),
    ('consolidated_financial_statement_audit', 'audit_base'),
    ('audit_response_package_preparation', 'audit_base'),
    ('pre_audit_finance_readiness', 'audit_base'),

    ('bookkeeping_outsourcing', 'bookkeeping'),
    ('vat_filing', 'vat_filing'),
    ('corporate_income_tax_filing', 'corporate_tax'),
    ('corporate_tax_adjustment', 'corporate_tax'),
    ('individual_income_tax_filing', 'bookkeeping'),
    ('withholding_tax_filing', 'withholding_payroll'),
    ('year_end_tax_settlement', 'year_end_tax_settlement'),
    ('payment_statement_submission', 'withholding_payroll'),
    ('social_insurance_filing_support', 'four_major_insurance'),
    ('local_tax_filing', 'corporate_tax'),
    ('capital_gains_tax_filing', 'tax_dispute'),
    ('securities_transaction_tax_filing', 'tax_dispute'),
    ('inheritance_tax_filing', 'valuation'),
    ('gift_tax_filing', 'valuation'),
    ('tax_audit_response', 'tax_dispute'),
    ('pre_tax_assessment_review_claim', 'tax_dispute'),
    ('tax_objection', 'tax_dispute'),
    ('tax_review_claim', 'tax_dispute'),
    ('tax_tribunal_appeal', 'tax_dispute'),
    ('tax_correction_claim', 'tax_dispute'),
    ('tax_ruling_request', 'tax_dispute'),
    ('tax_incentive_review', 'corporate_tax'),
    ('research_development_tax_credit_review', 'government_grant'),
    ('investment_tax_credit_review', 'corporate_tax'),

    ('transfer_pricing_documentation', 'international_tax'),
    ('arm_length_pricing_method_review', 'international_tax'),
    ('cross_border_tax_review', 'international_tax'),
    ('foreign_related_party_transaction_review', 'international_tax'),
    ('withholding_tax_review', 'international_tax'),
    ('tax_treaty_application_review', 'international_tax'),
    ('overseas_subsidiary_tax_package_review', 'international_tax'),
    ('global_minimum_tax_response', 'international_tax'),
    ('customs_and_trade_tax_review', 'international_tax'),

    ('monthly_bookkeeping', 'bookkeeping'),
    ('monthly_closing', 'monthly_closing'),
    ('financial_statement_preparation_support', 'financial_statement_review'),
    ('consolidation_closing_support', 'audit_base'),
    ('sales_settlement_management', 'ecommerce_settlement'),
    ('platform_sales_settlement_review', 'ecommerce_settlement'),
    ('pg_settlement_review', 'ecommerce_settlement'),
    ('inventory_movement_management', 'manufacturing_cost'),
    ('cost_closing', 'manufacturing_cost'),
    ('payroll_outsourcing', 'withholding_payroll'),
    ('daily_cash_report_preparation', 'monthly_closing'),
    ('cash_flow_plan_preparation', 'monthly_closing'),
    ('receivable_payable_balance_cleanup', 'monthly_closing'),
    ('accrual_balance_cleanup', 'monthly_closing'),
    ('accounting_book_cleanup', 'monthly_closing'),
    ('accounting_system_migration_support', 'monthly_closing'),

    ('financial_due_diligence', 'financial_due_diligence'),
    ('tax_due_diligence', 'tax_due_diligence'),
    ('vendor_due_diligence', 'financial_due_diligence'),
    ('post_acquisition_finance_cleanup', 'financial_due_diligence'),
    ('enterprise_valuation', 'valuation'),
    ('equity_valuation', 'valuation'),
    ('business_valuation', 'valuation'),
    ('fundraising_material_review', 'startup_finance_readiness'),
    ('ma_transaction_advisory', 'financial_due_diligence'),
    ('financial_model_review', 'valuation'),
    ('business_plan_review', 'valuation'),
    ('impairment_test_review', 'accounting_advisory'),
    ('purchase_price_allocation', 'valuation'),
    ('goodwill_valuation', 'valuation'),
    ('stock_option_valuation', 'valuation'),
    ('convertible_bond_valuation', 'valuation'),
    ('redeemable_convertible_preferred_share_valuation', 'valuation'),

    ('k_ifrs_conversion_advisory', 'accounting_advisory'),
    ('k_gaap_accounting_treatment_review', 'accounting_advisory'),
    ('revenue_recognition_accounting_review', 'accounting_advisory'),
    ('lease_accounting_review', 'accounting_advisory'),
    ('financial_instrument_accounting_review', 'accounting_advisory'),
    ('share_based_payment_accounting_review', 'accounting_advisory'),
    ('consolidation_scope_review', 'audit_base'),
    ('accounting_policy_setup', 'accounting_advisory'),
    ('closing_process_improvement', 'monthly_closing'),
    ('disclosure_material_preparation_support', 'financial_statement_review'),
    ('ipo_financial_reporting_preparation', 'startup_finance_readiness'),
    ('management_accounting_setup', 'monthly_closing'),

    ('fundraising_financial_package_preparation', 'startup_finance_readiness'),
    ('investor_reporting_material_review', 'startup_finance_readiness'),
    ('stock_option_grant_material_review', 'startup_finance_readiness'),
    ('government_grant_settlement', 'government_grant'),
    ('rd_project_cost_settlement', 'government_grant'),
    ('safe_agreement_accounting_review', 'startup_finance_readiness'),
    ('convertible_bond_accounting_review', 'startup_finance_readiness'),
    ('redeemable_convertible_preferred_share_accounting_review', 'startup_finance_readiness'),
    ('venture_company_certification_preparation', 'startup_finance_readiness'),
    ('startup_incorporation_accounting_tax_setup', 'startup_finance_readiness'),
    ('virtual_cfo_support', 'startup_finance_readiness'),
    ('management_report_preparation_support', 'startup_finance_readiness'),

    ('ecommerce_settlement_review', 'ecommerce_settlement'),
    ('manufacturing_cost_closing', 'manufacturing_cost'),
    ('construction_progress_rate_review', 'construction_progress'),
    ('medical_clinic_revenue_data_review', 'medical_revenue'),
    ('franchise_store_settlement_review', 'ecommerce_settlement'),
    ('platform_operator_settlement_review', 'ecommerce_settlement'),
    ('import_export_transaction_tax_review', 'international_tax'),
    ('public_interest_entity_closing_tax_review', 'audit_base')
),
required_expanded AS (
  SELECT
    tp.template_code,
    doc_code.document_code,
    true AS is_required_default,
    (doc_code.sort_order * 10) AS sort_order
  FROM template_profile tp
  JOIN profile_seed ps ON ps.profile_code = tp.profile_code
  CROSS JOIN LATERAL unnest(ps.required_document_codes) WITH ORDINALITY AS doc_code(document_code, sort_order)
),
optional_expanded AS (
  SELECT
    tp.template_code,
    doc_code.document_code,
    false AS is_required_default,
    1000 + (doc_code.sort_order * 10) AS sort_order
  FROM template_profile tp
  JOIN profile_seed ps ON ps.profile_code = tp.profile_code
  CROSS JOIN LATERAL unnest(ps.optional_document_codes) WITH ORDINALITY AS doc_code(document_code, sort_order)
),
mapping AS (
  SELECT DISTINCT ON (template_code, document_code)
    template_code,
    document_code,
    is_required_default,
    sort_order
  FROM (
    SELECT * FROM required_expanded
    UNION ALL
    SELECT * FROM optional_expanded
  ) expanded
  ORDER BY template_code, document_code, is_required_default DESC, sort_order
)
INSERT INTO request_template_documents (
  request_template_id,
  document_type_id,
  is_default,
  is_required_default,
  note,
  sort_order
)
SELECT
  rt.id,
  dt.id,
  true,
  m.is_required_default,
  CASE
    WHEN m.is_required_default THEN '기본 필수 요청 자료'
    ELSE '상황에 따라 추가 검토할 기본 자료'
  END,
  m.sort_order
FROM mapping m
JOIN request_templates rt ON rt.code = m.template_code
JOIN document_types dt ON dt.code = m.document_code
ON CONFLICT (request_template_id, document_type_id) DO UPDATE SET
  is_default = EXCLUDED.is_default,
  is_required_default = EXCLUDED.is_required_default,
  note = EXCLUDED.note,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
