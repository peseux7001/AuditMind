-- AuditMind customer master seed.

INSERT INTO customers (
  name,
  business_registration_number,
  ceo_name,
  business_type,
  business_item,
  business_address,
  created_by_user_id,
  updated_by_user_id
) VALUES
  ('샘플테크 주식회사', '123-45-67890', '김샘플', '정보통신업', '소프트웨어 개발 및 공급업', '서울특별시 강남구 테헤란로 123, 10층', 'system', 'system'),
  ('루멘커머스', '234-56-78901', '최루멘', '도소매업', '전자상거래 소매업', '서울특별시 마포구 월드컵북로 45', 'system', 'system'),
  ('브릿지AI', '345-67-89012', '박민수', '전문서비스업', 'AI 솔루션 개발 및 자문', '경기도 성남시 분당구 판교역로 235', 'system', 'system'),
  ('오르빗헬스', '456-78-90123', '윤오르빗', '보건업', '디지털 헬스케어 서비스', '서울특별시 송파구 올림픽로 300', 'system', 'system')
ON CONFLICT DO NOTHING;

INSERT INTO customer_contacts (
  customer_id,
  name,
  title,
  phone,
  email,
  is_primary,
  created_by_user_id,
  updated_by_user_id
)
SELECT c.id, v.name, v.title, v.phone, v.email, v.is_primary, 'system', 'system'
FROM (
  VALUES
    ('샘플테크 주식회사', '김담당', '재무팀장', '010-0000-0000', 'finance@sampletech.kr', true),
    ('루멘커머스', '김담당', '재무팀장', '010-0000-0000', 'finance@lumencommerce.co.kr', true),
    ('브릿지AI', '김담당', '재무팀장', '010-0000-0000', 'finance@bridgeai.kr', true),
    ('오르빗헬스', '김담당', '재무팀장', '010-0000-0000', 'finance@orbithealth.kr', true)
) AS v(customer_name, name, title, phone, email, is_primary)
JOIN customers c ON c.name = v.customer_name
WHERE NOT EXISTS (SELECT 1 FROM customer_contacts);

UPDATE customer_submission_requests csr
SET customer_id = c.id
FROM customers c
WHERE csr.customer_id IS NULL
  AND csr.customer_name = c.name;
