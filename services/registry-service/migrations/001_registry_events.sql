CREATE TABLE IF NOT EXISTS registry_events (
  id text PRIMARY KEY,
  pubkey text NOT NULL,
  created_at bigint NOT NULL,
  kind integer NOT NULL,
  tags jsonb NOT NULL,
  content text NOT NULL,
  sig text NOT NULL,
  source text NOT NULL CHECK (source IN ('api', 'legacy-import', 'relay-community', 'relay-official')),
  received_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS registry_events_kind_created_at_idx
  ON registry_events (kind, created_at DESC);

CREATE TABLE IF NOT EXISTS registry_auth_challenges (
  token text PRIMARY KEY,
  action_url text NOT NULL,
  method text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS registry_auth_challenges_expiry_idx
  ON registry_auth_challenges (expires_at)
  WHERE consumed_at IS NULL;

