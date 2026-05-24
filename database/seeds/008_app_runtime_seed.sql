-- AuditMind app runtime seed.
-- Keeps console shell/runtime configuration in the database.

INSERT INTO app_settings (key, value, description, updated_by_user_id)
VALUES
  (
    'shell.brand',
    '{
      "eyebrow": "AuditMind",
      "title": "자료 검토 콘솔",
      "firmName": "AuditMind 파트너스",
      "userName": "데모 계정",
      "logoImage": "/brand/auditmind-logo.png",
      "logoAlt": "AuditMind"
    }'::jsonb,
    '회계사용 콘솔 브랜드 표시값',
    'system'
  ),
  (
    'dashboard.due_alert',
    '{"alertDays": 5}'::jsonb,
    '자료 미제출 고객사 카드의 마감 임박 기준일',
    'system'
  ),
  (
    'ai.endpoints',
    '{
      "paddleOcrChatUrl": "http://100.126.53.70:8118/v1/chat/completions",
      "paddleOcrModel": "PaddleOCR-VL-1.5-0.9B",
      "qwenChatUrl": "http://100.120.165.93:8090/v1/chat/completions",
      "qwenModel": "Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf"
    }'::jsonb,
    '로컬/Tailscale OCR 및 Qwen 엔드포인트 기록',
    'system'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now(),
  updated_by_user_id = EXCLUDED.updated_by_user_id;
