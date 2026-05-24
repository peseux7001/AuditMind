-- AuditMind submission review notes.
-- Keeps accountant-only notes separate from customer-facing comments.

ALTER TABLE customer_submission_items
  ADD COLUMN IF NOT EXISTS internal_memo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_comment text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_submission_items_status ON customer_submission_items(status);
