-- Public landing page visit/click log for MVP traffic checks.
-- This is anonymous pre-login telemetry; it does not identify a person by itself.

CREATE TABLE IF NOT EXISTS landing_visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  session_id text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '',
  referrer text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  client_ip text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type IN ('landing_view', 'console_demo_click'))
);

CREATE INDEX IF NOT EXISTS idx_landing_visit_events_created_at
  ON landing_visit_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_visit_events_event_type
  ON landing_visit_events(event_type, created_at DESC);
