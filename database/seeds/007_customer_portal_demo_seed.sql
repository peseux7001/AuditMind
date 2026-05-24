-- AuditMind customer portal MVP demo seed.
-- This does not create customer master data. It only attaches a stable demo
-- submission link to an existing customer so the MVP can be opened directly.
-- Raw demo URL token: mvp-demo

WITH demo_customer AS (
  SELECT id, name
  FROM customers
  WHERE business_registration_number = '812-86-20431'
  ORDER BY created_at ASC
  LIMIT 1
),
demo_template AS (
  SELECT id
  FROM request_templates
  WHERE code = 'vat_filing'
  LIMIT 1
),
upsert_request AS (
  INSERT INTO customer_submission_requests (
    id,
    customer_id,
    customer_name,
    request_title,
    request_period,
    due_date,
    status,
    request_template_id,
    customer_request_message,
    customer_request_status
  )
  SELECT
    '77777777-7777-4777-8777-777777777777'::uuid,
    dc.id,
    dc.name,
    '부가가치세 신고 자료 제출 요청',
    '2026년 1기',
    (CURRENT_DATE + INTERVAL '7 days')::date,
    'open',
    dt.id,
    '',
    'draft'
  FROM demo_customer dc
  CROSS JOIN demo_template dt
  ON CONFLICT (id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    customer_name = EXCLUDED.customer_name,
    request_title = EXCLUDED.request_title,
    request_period = EXCLUDED.request_period,
    due_date = EXCLUDED.due_date,
    status = EXCLUDED.status,
    request_template_id = EXCLUDED.request_template_id,
    updated_at = now()
  RETURNING id, customer_id
)
INSERT INTO customer_submission_access_tokens (
  request_id,
  recipient_name,
  recipient_email,
  recipient_phone,
  token_hash,
  token_label,
  expires_at,
  metadata
)
SELECT
  ur.id,
  COALESCE(cc.name, '담당자'),
  COALESCE(cc.email, ''),
  COALESCE(cc.phone, ''),
  '29f879d93133d1f449bd29a1609a08988a82fc6eb69d4e8605d02137a40b96ed',
  'mvp-demo',
  NULL,
  jsonb_build_object(
    'demo', true,
    'customerId', ur.customer_id,
    'templateCodes', ARRAY['vat_filing'],
    'serviceNames', ARRAY['부가가치세 신고'],
    'sendMethods', ARRAY['demo']
  )
FROM upsert_request ur
LEFT JOIN LATERAL (
  SELECT name, email, phone
  FROM customer_contacts
  WHERE customer_id = ur.customer_id
  ORDER BY is_primary DESC, name ASC
  LIMIT 1
) cc ON true
ON CONFLICT (token_hash) DO UPDATE SET
  request_id = EXCLUDED.request_id,
  recipient_name = EXCLUDED.recipient_name,
  recipient_email = EXCLUDED.recipient_email,
  recipient_phone = EXCLUDED.recipient_phone,
  token_label = EXCLUDED.token_label,
  expires_at = EXCLUDED.expires_at,
  metadata = EXCLUDED.metadata,
  revoked_at = NULL,
  updated_at = now();

WITH demo_request AS (
  SELECT id
  FROM customer_submission_requests
  WHERE id = '77777777-7777-4777-8777-777777777777'::uuid
),
demo_documents AS (
  SELECT
    rtd.document_type_id,
    dt.name,
    row_number() OVER (ORDER BY rtd.sort_order ASC, dt.name ASC) * 10 AS sort_order
  FROM request_templates rt
  JOIN request_template_documents rtd ON rtd.request_template_id = rt.id
  JOIN document_types dt ON dt.id = rtd.document_type_id
  WHERE rt.code = 'vat_filing'
)
INSERT INTO customer_submission_items (
  request_id,
  document_type_id,
  requested_name,
  status,
  review_message,
  customer_comment,
  sort_order
)
SELECT
  dr.id,
  dd.document_type_id,
  dd.name,
  'not_received',
  '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.',
  '',
  dd.sort_order
FROM demo_request dr
CROSS JOIN demo_documents dd
WHERE NOT EXISTS (
  SELECT 1
  FROM customer_submission_items csi
  WHERE csi.request_id = dr.id
    AND csi.document_type_id = dd.document_type_id
);
