-- HSENations Mail — schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  source TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'subscribed',
  metadata JSONB DEFAULT '{}'::jsonb,
  unsubscribed BOOLEAN NOT NULL DEFAULT false,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (lower(email));
CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts (status);

CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_list_members (
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);
CREATE INDEX IF NOT EXISTS clm_contact_idx ON contact_list_members (contact_id);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  list_id UUID REFERENCES contact_lists(id) ON DELETE SET NULL,
  -- snapshot of subject/body at send time, so template edits don't change history
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, queued, sending, sent, failed, cancelled
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

-- Multi-list campaigns: a campaign can target multiple lists. The legacy
-- list_id column is preserved as a "primary" pointer for backward compat
-- and is kept in sync with list_ids[0] by the API layer.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS list_ids UUID[] NOT NULL DEFAULT '{}';
UPDATE campaigns SET list_ids = ARRAY[list_id] WHERE list_id IS NOT NULL AND cardinality(list_ids) = 0;
CREATE INDEX IF NOT EXISTS campaigns_list_ids_idx ON campaigns USING GIN (list_ids);

-- Per-campaign email provider override. NULL = use the workspace default
-- (app_settings.email_provider → EMAIL_PROVIDER env → 'ses'). Existing
-- campaigns stay on AWS SES because they remain NULL.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS provider TEXT;

-- Lightweight per-recipient row. NO html body here; we reference campaign_id.
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sending, sent, failed, bounced, complained, opened, clicked
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  ses_message_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS queue_campaign_idx ON email_queue (campaign_id);
CREATE INDEX IF NOT EXISTS queue_status_idx ON email_queue (status);
CREATE INDEX IF NOT EXISTS queue_ses_msg_idx ON email_queue (ses_message_id);

CREATE TABLE IF NOT EXISTS campaign_events (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- send, delivery, open, click, bounce, complaint, unsubscribe, failed
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_campaign_idx ON campaign_events (campaign_id, event_type);

CREATE TABLE IF NOT EXISTS suppressed_emails (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL, -- bounce, complaint, manual
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  token TEXT PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sns_event_log (
  id BIGSERIAL PRIMARY KEY,
  message_id TEXT,
  event_type TEXT,
  raw JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'ses', -- ses, smtp, etc.
  region TEXT,
  from_email TEXT,
  from_name TEXT,
  configuration_set TEXT,
  sns_topic_arn TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'unverified', -- unverified, healthy, error
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email builder additions
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS preview_text TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS from_name TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS builder_json JSONB;

-- Batch 2: SNS dedupe. Unique index on message_id (nullable rows allowed by
-- the WHERE clause). Duplicate SNS retries hit ON CONFLICT DO NOTHING in the
-- insert path, so no duplicate row in sns_event_log and no duplicate
-- downstream campaign_events processing.
CREATE UNIQUE INDEX IF NOT EXISTS sns_event_log_message_id_uniq
  ON sns_event_log (message_id)
  WHERE message_id IS NOT NULL;


-- Batch 3: Suppression hardening. Normalized lowercase emails, source/contact/campaign
-- attribution, and indexes on the lookup columns. CHECK enforces lowercase invariant.
ALTER TABLE suppressed_emails
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

WITH ranked AS (
  SELECT email, row_number() OVER (PARTITION BY lower(email) ORDER BY created_at ASC) AS rn
  FROM suppressed_emails
)
DELETE FROM suppressed_emails s USING ranked r WHERE s.email = r.email AND r.rn > 1;
UPDATE suppressed_emails SET email = lower(email) WHERE email <> lower(email);

ALTER TABLE suppressed_emails
  DROP CONSTRAINT IF EXISTS suppressed_emails_email_lower_chk;
ALTER TABLE suppressed_emails
  ADD CONSTRAINT suppressed_emails_email_lower_chk CHECK (email = lower(email));

CREATE INDEX IF NOT EXISTS suppressed_source_idx ON suppressed_emails (source);
CREATE INDEX IF NOT EXISTS suppressed_reason_idx ON suppressed_emails (reason);


-- =============================================================================
-- Batch 4: Performance indexes
-- All use CREATE INDEX IF NOT EXISTS so this migration is safe to re-run.
-- =============================================================================

-- campaign_events: composite for per-campaign event-type time-series queries
CREATE INDEX IF NOT EXISTS events_campaign_type_time_idx
  ON campaign_events (campaign_id, event_type, occurred_at DESC);

-- campaign_events: global recency feed (dashboard "recent events")
CREATE INDEX IF NOT EXISTS events_occurred_at_idx
  ON campaign_events (occurred_at DESC);

-- email_queue: worker claim path (status='pending' ordered by scheduled time)
-- Existing email_queue table has no scheduled_at column on rows; ordering uses
-- created_at. Index supports the worker's "WHERE status='pending' ORDER BY created_at" claim.
CREATE INDEX IF NOT EXISTS queue_status_created_idx
  ON email_queue (status, created_at);

-- email_queue: per-campaign status rollups (report, finalize step)
CREATE INDEX IF NOT EXISTS queue_campaign_status_idx
  ON email_queue (campaign_id, status);

-- contacts: list ordering by recency
CREATE INDEX IF NOT EXISTS contacts_created_at_idx
  ON contacts (created_at DESC);

-- contacts: case-insensitive email lookup (suppression / import dedupe / diagnostic)
CREATE INDEX IF NOT EXISTS contacts_lower_email_idx
  ON contacts (lower(email));

-- sns_event_log: dashboard SNS health "latest event" query
CREATE INDEX IF NOT EXISTS sns_event_log_received_at_idx
  ON sns_event_log (received_at DESC);

-- suppressed_emails: filtering by reason / source (admin lists)
-- suppressed_reason_idx and suppressed_source_idx already created above in Batch 3;
-- repeated here as IF NOT EXISTS for clarity / safe re-runs.
CREATE INDEX IF NOT EXISTS suppressed_reason_idx ON suppressed_emails (reason);
CREATE INDEX IF NOT EXISTS suppressed_source_idx ON suppressed_emails (source);


-- =============================================================================
-- Batch 6: Media library + audit log
-- =============================================================================

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BYTEA NOT NULL,
  uploaded_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  uploaded_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_assets_created_at_idx ON media_assets (created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Award category
-- Contacts that belong to an AfriSAFE award list carry the award name so
-- campaigns and exports can address nominees by category. Derived from the
-- list name; kept in sync by a trigger on list membership.
-- ---------------------------------------------------------------------------
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS award_category TEXT;
CREATE INDEX IF NOT EXISTS contacts_award_category_idx ON contacts (award_category);

-- A contact carries exactly one award category: the name of the award list
-- they belong to (most recent membership wins if they are in several).
CREATE OR REPLACE FUNCTION contacts_award_category_for(_contact_id UUID)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT l.name
  FROM contact_list_members m
  JOIN contact_lists l ON l.id = m.list_id
  WHERE m.contact_id = _contact_id AND l.name ILIKE '%Award'
  ORDER BY m.added_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION contacts_sync_award_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _cid UUID;
BEGIN
  _cid := COALESCE(NEW.contact_id, OLD.contact_id);
  UPDATE contacts
     SET award_category = contacts_award_category_for(_cid)
   WHERE id = _cid;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS contact_list_members_award_sync ON contact_list_members;
CREATE TRIGGER contact_list_members_award_sync
AFTER INSERT OR DELETE ON contact_list_members
FOR EACH ROW EXECUTE FUNCTION contacts_sync_award_category();

-- Backfill / normalise existing nominees to a single award list name.
UPDATE contacts c
   SET award_category = contacts_award_category_for(c.id)
 WHERE c.award_category IS DISTINCT FROM contacts_award_category_for(c.id);

