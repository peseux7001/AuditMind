-- AuditMind customer runtime seed.
-- Customer/company/contact data is runtime data and must not be recreated by seeds.
-- Service and document master data live in other seed files and are intentionally untouched.

UPDATE customer_submission_requests csr
SET customer_id = c.id
FROM customers c
WHERE csr.customer_id IS NULL
  AND csr.customer_name = c.name;
