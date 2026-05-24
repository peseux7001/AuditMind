-- Canonicalize document type master rows by Korean document name.
-- A document with the same Korean name is the same requested document.
-- This migration keeps the earlier/general canonical code and rewires old
-- category-specific duplicate codes before enforcing uniqueness by name.

WITH canonical_map(old_code, canonical_code) AS (
  VALUES
    ('vat_sales_tax_invoice_summary_by_customer', 'sales_tax_invoice_summary_by_customer'),
    ('vat_purchase_tax_invoice_summary_by_vendor', 'purchase_tax_invoice_summary_by_vendor'),
    ('vat_sales_invoice_summary_by_customer', 'sales_invoice_summary_by_customer'),
    ('vat_purchase_invoice_summary_by_vendor', 'purchase_invoice_summary_by_vendor'),
    ('vat_credit_card_sales_slip_issue_summary', 'credit_card_sales_slip_issue_summary'),
    ('vat_credit_card_sales_slip_receipt_statement', 'credit_card_sales_slip_receipt_statement'),
    ('vat_cash_receipt_sales_statement', 'cash_receipt_sales_statement'),
    ('vat_cash_sales_statement', 'cash_sales_statement'),
    ('corporate_tax_statement_of_financial_position', 'statement_of_financial_position'),
    ('corporate_tax_income_statement', 'income_statement'),
    ('corporate_tax_retained_earnings_appropriation_statement', 'retained_earnings_appropriation_statement'),
    ('corporate_tax_deficit_disposition_statement', 'deficit_disposition_statement'),
    ('corporate_tax_adjustment_statement', 'tax_adjustment_statement'),
    ('legal_major_sales_contract', 'major_sales_contract'),
    ('legal_outsourcing_service_contract', 'outsourcing_service_contract'),
    ('legal_lease_agreement', 'lease_agreement'),
    ('industry_manufacturing_cost_statement', 'manufacturing_cost_statement'),
    ('industry_construction_cost_statement', 'construction_cost_statement'),
    ('advance_payment_schedule', 'advance_payments_schedule'),
    ('industry_pg_settlement_data', 'pg_settlement_data')
),
resolved AS (
  SELECT
    old_dt.id AS old_id,
    canonical_dt.id AS canonical_id
  FROM canonical_map cm
  JOIN document_types old_dt ON old_dt.code = cm.old_code
  JOIN document_types canonical_dt ON canonical_dt.code = cm.canonical_code
),
delete_conflicting_template_documents AS (
  DELETE FROM request_template_documents rtd
  USING resolved r
  WHERE rtd.document_type_id = r.old_id
    AND EXISTS (
      SELECT 1
      FROM request_template_documents existing
      WHERE existing.request_template_id = rtd.request_template_id
        AND existing.document_type_id = r.canonical_id
    )
  RETURNING rtd.id
),
update_template_documents AS (
  UPDATE request_template_documents rtd
  SET document_type_id = r.canonical_id,
      updated_at = now()
  FROM resolved r
  WHERE rtd.document_type_id = r.old_id
    AND NOT EXISTS (
      SELECT 1
      FROM request_template_documents existing
      WHERE existing.request_template_id = rtd.request_template_id
        AND existing.document_type_id = r.canonical_id
    )
  RETURNING rtd.id
),
delete_old_required_fields AS (
  DELETE FROM document_type_required_fields rf
  USING resolved r
  WHERE rf.document_type_id = r.old_id
  RETURNING rf.id
),
delete_conflicting_aliases AS (
  DELETE FROM document_type_aliases a
  USING resolved r
  WHERE a.document_type_id = r.old_id
    AND EXISTS (
      SELECT 1
      FROM document_type_aliases existing
      WHERE existing.document_type_id = r.canonical_id
        AND existing.alias = a.alias
    )
  RETURNING a.id
),
update_aliases AS (
  UPDATE document_type_aliases a
  SET document_type_id = r.canonical_id
  FROM resolved r
  WHERE a.document_type_id = r.old_id
    AND NOT EXISTS (
      SELECT 1
      FROM document_type_aliases existing
      WHERE existing.document_type_id = r.canonical_id
        AND existing.alias = a.alias
    )
  RETURNING a.id
),
update_examples AS (
  UPDATE document_type_examples e
  SET document_type_id = r.canonical_id
  FROM resolved r
  WHERE e.document_type_id = r.old_id
  RETURNING e.id
),
update_submission_items AS (
  UPDATE customer_submission_items item
  SET document_type_id = r.canonical_id,
      updated_at = now()
  FROM resolved r
  WHERE item.document_type_id = r.old_id
  RETURNING item.id
),
update_classification_results AS (
  UPDATE document_classification_results result
  SET document_type_id = r.canonical_id
  FROM resolved r
  WHERE result.document_type_id = r.old_id
  RETURNING result.id
)
DELETE FROM document_types dt
USING resolved r
WHERE dt.id = r.old_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_types_unique_name ON document_types(name);
