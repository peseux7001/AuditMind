-- Demo customer submission portal data.
-- Raw customer URL token: demo-token

INSERT INTO customer_submission_requests (
  id,
  customer_id,
  customer_name,
  request_title,
  request_period,
  due_date,
  status,
  customer_request_message,
  customer_request_status
)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  (SELECT id FROM customers WHERE name = '샘플테크 주식회사' LIMIT 1),
  '샘플테크 주식회사',
  '2025년 1기 부가가치세 신고 검토 자료 제출 요청',
  '2025년 1기',
  '2026-05-27',
  'open',
  '',
  'draft'
)
ON CONFLICT (id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  customer_name = EXCLUDED.customer_name,
  request_title = EXCLUDED.request_title,
  request_period = EXCLUDED.request_period,
  due_date = EXCLUDED.due_date,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO customer_submission_access_tokens (
  request_id,
  recipient_name,
  token_hash,
  token_label,
  expires_at
)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  '샘플테크 담당자',
  '7c43ef5ae21d43ce2743f770c68e24def1a43ee2f416d2438410c8af7af2ff2c',
  'demo-token',
  NULL
)
ON CONFLICT (token_hash) DO UPDATE SET
  request_id = EXCLUDED.request_id,
  recipient_name = EXCLUDED.recipient_name,
  token_label = EXCLUDED.token_label,
  expires_at = EXCLUDED.expires_at,
  revoked_at = NULL,
  updated_at = now();

DELETE FROM document_classification_results
WHERE uploaded_file_id IN (
  SELECT id
  FROM uploaded_files
  WHERE request_id = '77777777-7777-4777-8777-777777777777'
)
OR matched_submission_item_id IN (
  SELECT id
  FROM customer_submission_items
  WHERE request_id = '77777777-7777-4777-8777-777777777777'
);

DELETE FROM uploaded_files
WHERE request_id = '77777777-7777-4777-8777-777777777777';

INSERT INTO customer_submission_items (
  id,
  request_id,
  document_type_id,
  requested_name,
  status,
  review_message,
  customer_comment,
  sort_order
)
VALUES
  (
    '77777777-0001-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    (SELECT id FROM document_types WHERE code = 'vat_return'),
    '부가세 신고서',
    'not_received',
    '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.',
    '',
    10
  ),
  (
    '77777777-0002-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    (SELECT id FROM document_types WHERE code = 'card_sales_statement'),
    '카드매출 내역',
    'not_received',
    '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.',
    '',
    20
  ),
  (
    '77777777-0003-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    (SELECT id FROM document_types WHERE code = 'sales_tax_invoice_summary_by_customer'),
    '매출 세금계산서 합계표',
    'not_received',
    '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.',
    '',
    30
  ),
  (
    '77777777-0004-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    (SELECT id FROM document_types WHERE code = 'bank_transaction_statement'),
    '통장 입금 내역',
    'not_received',
    '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.',
    '',
    40
  ),
  (
    '77777777-0005-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    (SELECT id FROM document_types WHERE code = 'pg_settlement_data'),
    'PG 정산자료',
    'not_received',
    '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.',
    '',
    50
  ),
  (
    '77777777-0006-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    (SELECT id FROM document_types WHERE code = 'major_sales_contract'),
    '주요 매출계약서',
    'not_received',
    '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.',
    '',
    60
  )
ON CONFLICT (id) DO UPDATE SET
  document_type_id = EXCLUDED.document_type_id,
  requested_name = EXCLUDED.requested_name,
  status = EXCLUDED.status,
  review_message = EXCLUDED.review_message,
  customer_comment = EXCLUDED.customer_comment,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- The demo customer portal intentionally starts with every requested item unsubmitted.
-- Keep the requested document rows, but do not seed uploaded files or classification artifacts.
