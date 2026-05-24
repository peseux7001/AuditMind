-- AuditMind document type master schema.
-- Target database: PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES document_categories(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  review_purpose text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_type_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_kind text NOT NULL DEFAULT 'common',
  locale text NOT NULL DEFAULT 'ko-KR',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type_id, alias)
);

CREATE TABLE IF NOT EXISTS document_type_required_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  value_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT true,
  extraction_hint text NOT NULL DEFAULT '',
  validation_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type_id, field_key),
  CHECK (value_type IN ('text', 'number', 'date', 'amount', 'period', 'boolean', 'enum', 'json'))
);

CREATE TABLE IF NOT EXISTS document_type_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  example_name text NOT NULL,
  example_note text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_submission_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  request_title text NOT NULL,
  request_period text NOT NULL DEFAULT '',
  due_date date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('draft', 'open', 'closed', 'expired', 'revoked'))
);

CREATE TABLE IF NOT EXISTS customer_submission_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES customer_submission_requests(id) ON DELETE CASCADE,
  recipient_name text NOT NULL DEFAULT '',
  recipient_email text NOT NULL DEFAULT '',
  recipient_phone text NOT NULL DEFAULT '',
  token_hash text NOT NULL UNIQUE,
  token_label text NOT NULL DEFAULT '',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (access_count >= 0)
);

CREATE TABLE IF NOT EXISTS customer_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES customer_submission_requests(id) ON DELETE CASCADE,
  document_type_id uuid REFERENCES document_types(id),
  requested_name text NOT NULL,
  status text NOT NULL DEFAULT 'not_received',
  review_message text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('not_received', 'processing', 'approved', 'rejected', 'submitted'))
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES customer_submission_requests(id) ON DELETE CASCADE,
  submission_item_id uuid REFERENCES customer_submission_items(id) ON DELETE SET NULL,
  original_filename text NOT NULL,
  storage_key text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  file_extension text NOT NULL DEFAULT '',
  byte_size bigint NOT NULL DEFAULT 0,
  sha256 text NOT NULL DEFAULT '',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'queued',
  processing_error text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (processing_status IN ('queued', 'extracting', 'classifying', 'approved', 'rejected', 'failed'))
);

CREATE TABLE IF NOT EXISTS document_classification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_file_id uuid NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  document_type_id uuid REFERENCES document_types(id),
  matched_submission_item_id uuid REFERENCES customer_submission_items(id) ON DELETE SET NULL,
  model_name text NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  decision text NOT NULL DEFAULT 'undecided',
  reason text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1),
  CHECK (decision IN ('match', 'possible_match', 'reject', 'undecided'))
);

CREATE INDEX IF NOT EXISTS idx_document_types_category_id ON document_types(category_id);
CREATE INDEX IF NOT EXISTS idx_document_types_name_trgm ON document_types USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_type_aliases_alias_trgm ON document_type_aliases USING gin (alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_submission_access_tokens_request_id ON customer_submission_access_tokens(request_id);
CREATE INDEX IF NOT EXISTS idx_submission_access_tokens_active ON customer_submission_access_tokens(request_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submission_items_request_id ON customer_submission_items(request_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_request_id ON uploaded_files(request_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_submission_item_id ON uploaded_files(submission_item_id);
CREATE INDEX IF NOT EXISTS idx_classification_uploaded_file_id ON document_classification_results(uploaded_file_id);
