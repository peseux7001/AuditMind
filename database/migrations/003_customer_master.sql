-- AuditMind customer master schema.
-- Target database: PostgreSQL 15+

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_registration_number text NOT NULL DEFAULT '',
  ceo_name text NOT NULL DEFAULT '',
  business_type text NOT NULL DEFAULT '',
  business_item text NOT NULL DEFAULT '',
  business_address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id text NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text NOT NULL DEFAULT '',
  phone text NOT NULL,
  email text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id text NOT NULL DEFAULT 'system'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_registration_number_unique
  ON customers (business_registration_number)
  WHERE business_registration_number <> '';

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email ON customer_contacts(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contacts_one_primary
  ON customer_contacts (customer_id)
  WHERE is_primary;
