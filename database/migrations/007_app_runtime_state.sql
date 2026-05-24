-- AuditMind app runtime state.
-- Excludes user permission/auth policy and submission-request sending workflow.

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id text NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS accountant_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'review-ready',
  source_entity_type text NOT NULL DEFAULT '',
  source_entity_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_ai_analyses (
  customer_id uuid PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  analysis_text text NOT NULL DEFAULT '',
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_name text NOT NULL DEFAULT '',
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id text NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS uploaded_file_viewer_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_file_id uuid NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  storage_key text NOT NULL DEFAULT '',
  page_count integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (artifact_type IN ('direct-image', 'direct-pdf', 'display-pdf', 'thumbnail', 'ocr-overlay'))
);

CREATE INDEX IF NOT EXISTS idx_accountant_notifications_received_at
  ON accountant_notifications(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_accountant_notifications_unread
  ON accountant_notifications(received_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_uploaded_file_viewer_artifacts_file_id
  ON uploaded_file_viewer_artifacts(uploaded_file_id);
