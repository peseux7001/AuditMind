-- Link submission requests to the customer master table.
-- customer_name remains as a display fallback for legacy rows, but runtime joins
-- must use customer_id so customer management, submission requests, and review
-- screens share the same customer lifecycle.

ALTER TABLE customer_submission_requests
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE CASCADE;

UPDATE customer_submission_requests csr
SET customer_id = c.id
FROM customers c
WHERE csr.customer_id IS NULL
  AND csr.customer_name = c.name;

CREATE INDEX IF NOT EXISTS idx_submission_requests_customer_id
  ON customer_submission_requests(customer_id);
