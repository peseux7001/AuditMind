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
    ('샘플테크 주식회사', '최지훈', 'CFO', '010-1234-5678', 'finance@sampletech.kr', true),
    ('샘플테크 주식회사', '한서윤', '재무팀 매니저', '010-2222-7788', 'accounting@sampletech.kr', false),
    ('루멘커머스', '이서연', '재무팀장', '010-2345-6789', 'accounting@lumencommerce.co.kr', true),
    ('브릿지AI', '박민수', '대표', '010-3456-7890', 'ceo@bridgeai.kr', true),
    ('브릿지AI', '오유진', '운영 리드', '010-3333-5577', 'ops@bridgeai.kr', false),
    ('오르빗헬스', '정다은', '운영매니저', '010-4567-8901', 'ops@orbithealth.kr', true)
) AS v(customer_name, name, title, phone, email, is_primary)
JOIN customers c ON c.name = v.customer_name
WHERE NOT EXISTS (
  SELECT 1
  FROM customer_contacts cc
  WHERE cc.customer_id = c.id
    AND cc.email = v.email
);
