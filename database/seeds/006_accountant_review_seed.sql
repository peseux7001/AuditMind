-- Seed review work items for the accountant submission-review screen.
-- These are realistic persisted processing results, not browser-time OCR execution.

INSERT INTO customer_submission_requests (id, customer_name, request_title, request_period, due_date, status)
VALUES
  ('11111111-1111-4111-8111-111111111111', '샘플테크 주식회사', '거래처 정산계좌 확인', '2026년 5월', '2026-05-22', 'open'),
  ('22222222-2222-4222-8222-222222222222', '루멘커머스', '월간 매출 정산자료 검토', '2026년 5월', '2026-05-23', 'open'),
  ('33333333-3333-4333-8333-333333333333', '브릿지AI', '투자 실사 자료 준비', '2026년 5월', '2026-05-23', 'open'),
  ('44444444-4444-4444-8444-444444444444', '오르빗헬스', '법인세 기초자료 수집', '2026년 5월', '2026-05-30', 'open')
ON CONFLICT (id) DO UPDATE SET
  customer_name = EXCLUDED.customer_name,
  request_title = EXCLUDED.request_title,
  request_period = EXCLUDED.request_period,
  due_date = EXCLUDED.due_date,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO customer_submission_items (
  id,
  request_id,
  document_type_id,
  requested_name,
  status,
  review_message,
  internal_memo,
  customer_comment,
  sort_order
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    (SELECT id FROM document_types WHERE code = 'bankbook_copy'),
    '통장 사본',
    'processing',
    '통장 사본 양식은 확인되지만, 계좌번호 영역이 훼손되어 필수값 일부를 원본에서 안정적으로 읽기 어렵습니다.',
    '계좌번호 영역이 훼손되어 자동 판독값을 그대로 쓰면 안 됩니다. 고객에게 선명한 통장 사본을 재요청하거나 원본으로 계좌번호를 직접 확인하세요.',
    '계좌번호 일부가 선명하게 확인되지 않습니다. 가능한 경우 계좌번호가 또렷하게 보이는 통장 사본을 다시 업로드해 주세요.',
    10
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    (SELECT id FROM document_types WHERE code = 'pg_settlement_data'),
    'PG 정산자료',
    'processing',
    '정산 기간은 맞지만 수수료 항목 인식률이 낮습니다.',
    '',
    '수수료 항목이 흐리게 인식되어 원본 확인이 필요합니다. 가능하면 정산 합계가 보이는 원본 PDF를 다시 업로드해 주세요.',
    20
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '33333333-3333-4333-8333-333333333333',
    (SELECT id FROM document_types WHERE code = 'major_sales_contract'),
    '주요 매출계약서',
    'approved',
    '계약 당사자, 계약일, 계약금액, 계약기간이 확인되었습니다.',
    '금액 조항과 매출 인식 기간만 원문 재확인.',
    '',
    30
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '44444444-4444-4444-8444-444444444444',
    (SELECT id FROM document_types WHERE code = 'business_registration_certificate'),
    '사업자등록증',
    'submitted',
    '사업자등록번호, 대표자명, 사업장 주소가 모두 확인되었습니다.',
    '',
    '',
    40
  )
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  review_message = EXCLUDED.review_message,
  internal_memo = EXCLUDED.internal_memo,
  customer_comment = EXCLUDED.customer_comment,
  updated_at = now();

INSERT INTO uploaded_files (
  id,
  request_id,
  submission_item_id,
  original_filename,
  storage_key,
  mime_type,
  file_extension,
  byte_size,
  sha256,
  processing_status,
  metadata
)
VALUES
  (
    'f1111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bankbook_sample_low_confidence.png',
    '/samples/bankbook-sample-low-confidence.png',
    'image/png',
    'png',
    0,
    '',
    'approved',
    '{"renderMode":"direct-image","fileUrl":"/samples/bankbook-sample-low-confidence.png","pageCount":1,"evidencePage":1,"pageTitle":"통장 사본","pageSubtitle":"원본 이미지"}'::jsonb
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'pg_settlement_may.pdf',
    'samples/pg_settlement_may.pdf',
    'application/pdf',
    'pdf',
    0,
    '',
    'approved',
    '{"renderMode":"direct-pdf","pageCount":3,"evidencePage":2,"pageTitle":"PG 정산자료","pageSubtitle":"원본 PDF 페이지"}'::jsonb
  ),
  (
    'f3333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'major_sales_contract.pdf',
    'samples/major_sales_contract.pdf',
    'application/pdf',
    'pdf',
    0,
    '',
    'approved',
    '{"renderMode":"direct-pdf","pageCount":6,"evidencePage":3,"pageTitle":"주요 매출계약서","pageSubtitle":"원본 PDF 페이지"}'::jsonb
  ),
  (
    'f4444444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444444',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'business_registration.jpg',
    'samples/business_registration.jpg',
    'image/jpeg',
    'jpg',
    0,
    '',
    'approved',
    '{"renderMode":"direct-image","pageCount":1,"evidencePage":1,"pageTitle":"사업자등록증","pageSubtitle":"원본 이미지"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  original_filename = EXCLUDED.original_filename,
  storage_key = EXCLUDED.storage_key,
  mime_type = EXCLUDED.mime_type,
  file_extension = EXCLUDED.file_extension,
  processing_status = EXCLUDED.processing_status,
  metadata = EXCLUDED.metadata;

INSERT INTO document_classification_results (
  id,
  uploaded_file_id,
  document_type_id,
  matched_submission_item_id,
  model_name,
  confidence,
  decision,
  reason,
  evidence,
  raw_output
)
VALUES
  (
    'c1111111-1111-4111-8111-111111111111',
    'f1111111-1111-4111-8111-111111111111',
    (SELECT id FROM document_types WHERE code = 'bankbook_copy'),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf',
    0.63,
    'possible_match',
    '계좌번호 영역이 훼손되어 자동 판독 신뢰도가 낮습니다.',
    '[{"page":1,"reason":"문서 상단 계좌번호 행 노이즈"}]'::jsonb,
    '{
      "fields":[
        {"label":"문서명/양식명","value":"통장 사본","confidence":"높음","sourceRegion":{"page":1,"x":3.8,"y":26.5,"width":22,"height":8}},
        {"label":"은행명","value":"우리은행","confidence":"높음","sourceRegion":{"page":1,"x":3.8,"y":26.5,"width":22,"height":8}},
        {"label":"예금주","value":"홍길동","confidence":"높음","sourceRegion":{"page":1,"x":78.3,"y":12.9,"width":12,"height":5.3}},
        {"label":"계좌번호","value":"인식 불안정","confidence":"낮음","sourceRegion":{"page":1,"x":16.7,"y":16.6,"width":27.3,"height":5.3}},
        {"label":"예금종류 또는 상품명","value":"기업자유예금(우리CUBE통장)","confidence":"높음","sourceRegion":{"page":1,"x":15.7,"y":20.9,"width":36.1,"height":3.1}},
        {"label":"발행일자 또는 개설일자","value":"2019-11-27","confidence":"높음","sourceRegion":{"page":1,"x":24.3,"y":23.5,"width":25.5,"height":3}},
        {"label":"지점명","value":"서초구청지점","confidence":"높음","sourceRegion":{"page":1,"x":14.6,"y":40.9,"width":20,"height":3.5}}
      ]
    }'::jsonb
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'f2222222-2222-4222-8222-222222222222',
    (SELECT id FROM document_types WHERE code = 'pg_settlement_data'),
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf',
    0.61,
    'possible_match',
    '정산 합계 영역의 수수료 컬럼 OCR 신뢰도가 낮아 원문 대조가 필요합니다.',
    '[{"page":2,"reason":"정산 합계 표 수수료 컬럼"}]'::jsonb,
    '{"fields":[{"label":"정산대상","value":"루멘커머스","confidence":"높음"},{"label":"정산기간","value":"2026년 5월","confidence":"높음"},{"label":"결제금액","value":"184,920,300원","confidence":"중간"},{"label":"수수료","value":"인식 불안정","confidence":"낮음"}]}'::jsonb
  ),
  (
    'c3333333-3333-4333-8333-333333333333',
    'f3333333-3333-4333-8333-333333333333',
    (SELECT id FROM document_types WHERE code = 'major_sales_contract'),
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf',
    0.94,
    'match',
    '요청한 주요 매출계약서로 판단됩니다.',
    '[{"page":1,"reason":"계약 당사자"},{"page":3,"reason":"계약금액 조항"}]'::jsonb,
    '{"fields":[{"label":"계약상대방","value":"넥스트리테일 주식회사","confidence":"높음"},{"label":"계약일","value":"2025년 12월 18일","confidence":"높음"},{"label":"계약금액","value":"320,000,000원","confidence":"높음"},{"label":"계약기간","value":"2026.01.01~2026.12.31","confidence":"높음"}]}'::jsonb
  ),
  (
    'c4444444-4444-4444-8444-444444444444',
    'f4444444-4444-4444-8444-444444444444',
    (SELECT id FROM document_types WHERE code = 'business_registration_certificate'),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf',
    0.99,
    'match',
    '요청 문서와 필수 식별값이 일치합니다.',
    '[{"page":1,"reason":"사업자등록증 본문"}]'::jsonb,
    '{"fields":[{"label":"상호","value":"오르빗헬스 주식회사","confidence":"높음"},{"label":"사업자등록번호","value":"345-67-89012","confidence":"높음"},{"label":"대표자","value":"장오르빗","confidence":"높음"},{"label":"사업장 소재지","value":"서울특별시 송파구 올림픽로 88","confidence":"높음"}]}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  confidence = EXCLUDED.confidence,
  decision = EXCLUDED.decision,
  reason = EXCLUDED.reason,
  evidence = EXCLUDED.evidence,
  raw_output = EXCLUDED.raw_output;
