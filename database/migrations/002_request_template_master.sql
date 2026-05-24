-- AuditMind request template master schema.
-- Request templates represent accounting-firm work packages, such as VAT filing
-- or financial due diligence. They are presets that preselect document_types.

CREATE TABLE IF NOT EXISTS request_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  service_area text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_template_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_template_id uuid NOT NULL REFERENCES request_templates(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT true,
  is_required_default boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_template_id, document_type_id)
);

ALTER TABLE customer_submission_requests
  ADD COLUMN IF NOT EXISTS request_template_id uuid REFERENCES request_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_request_templates_service_area ON request_templates(service_area);
CREATE INDEX IF NOT EXISTS idx_request_templates_name_trgm ON request_templates USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_request_template_documents_template_id ON request_template_documents(request_template_id);
CREATE INDEX IF NOT EXISTS idx_request_template_documents_document_type_id ON request_template_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_submission_requests_template_id ON customer_submission_requests(request_template_id);
