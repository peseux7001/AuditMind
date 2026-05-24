-- AuditMind customer portal runtime state.
-- Stores customer-authored request notes separately from accountant review notes.

ALTER TABLE customer_submission_requests
  ADD COLUMN IF NOT EXISTS customer_request_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_request_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS customer_request_submitted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_submission_requests_customer_request_status_check'
  ) THEN
    ALTER TABLE customer_submission_requests
      ADD CONSTRAINT customer_submission_requests_customer_request_status_check
      CHECK (customer_request_status IN ('draft', 'submitted')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submission_requests_customer_request_status
  ON customer_submission_requests(customer_request_status);
