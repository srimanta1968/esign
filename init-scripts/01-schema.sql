-- ========================================
-- eSign Database Init Script
-- ========================================
-- This runs ONCE on first database setup.
-- The MigrationService in the Node.js app handles all subsequent
-- CREATE TABLE IF NOT EXISTS / ALTER TABLE IF NOT EXISTS on every boot,
-- so this script is just a safety net for fresh databases.
-- ========================================

-- Schema version tracking
CREATE TABLE IF NOT EXISTS _schema_version (
    id SERIAL PRIMARY KEY,
    schema_hash VARCHAR(64) NOT NULL,
    version INTEGER DEFAULT 1,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'init'
);

-- ════════════════════════════════════════
-- CORE TABLES (no FK dependencies)
-- ════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  name VARCHAR(255) DEFAULT '',
  role VARCHAR(20) DEFAULT 'user',
  organization_id UUID DEFAULT NULL,
  language_preference VARCHAR(10) DEFAULT 'en',
  plan VARCHAR(20) DEFAULT 'free',
  team_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_path VARCHAR(500),
  original_name VARCHAR(255) DEFAULT '',
  title VARCHAR(255) DEFAULT '',
  description TEXT DEFAULT '',
  status VARCHAR(50) DEFAULT 'draft',
  mime_type VARCHAR(255) DEFAULT '',
  file_type VARCHAR(50) DEFAULT '',
  file_size BIGINT DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  signer_email VARCHAR(255),
  status VARCHAR(255) DEFAULT 'pending',
  confirmation_status VARCHAR(30) DEFAULT 'pending_confirmation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  signature_type VARCHAR(255),
  signature_data TEXT DEFAULT NULL,
  signature_image_path VARCHAR(500) DEFAULT NULL,
  font_family VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) DEFAULT '',
  message TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  action_url TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signing_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  workflow_type VARCHAR(20) NOT NULL CHECK (workflow_type IN ('parallel', 'sequential')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  signed_pdf_path VARCHAR(500) DEFAULT NULL,
  certificate_pdf_path VARCHAR(500) DEFAULT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID DEFAULT NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT '',
  user_agent TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type VARCHAR(100) NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ════════════════════════════════════════
-- DEPENDENT TABLES (have FK references)
-- ════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  ip_address VARCHAR(45) DEFAULT '',
  user_agent TEXT DEFAULT '',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, tag)
);

CREATE TABLE IF NOT EXISTS compliance_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id UUID NOT NULL REFERENCES signatures(id) ON DELETE CASCADE,
  signer_ip VARCHAR(45) NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  esign_compliant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
  signer_email VARCHAR(255) NOT NULL,
  signer_name VARCHAR(255) NOT NULL DEFAULT '',
  signing_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'declined')),
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS signature_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES workflow_recipients(id) ON DELETE CASCADE,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('signature', 'initials', 'date', 'text')),
  page INTEGER NOT NULL DEFAULT 1,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  width REAL NOT NULL DEFAULT 150,
  height REAL NOT NULL DEFAULT 50,
  required BOOLEAN DEFAULT true,
  signature_data TEXT DEFAULT NULL,
  signature_type VARCHAR(20) DEFAULT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS workflow_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES workflow_recipients(id) ON DELETE CASCADE,
  reminder_interval_hours INTEGER NOT NULL DEFAULT 24,
  last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  next_send_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  UNIQUE(workflow_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_email VARCHAR(255) NOT NULL DEFAULT '',
  actor_ip VARCHAR(45) NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES workflow_recipients(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signing_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
  certificate_id UUID NOT NULL UNIQUE,
  document_hash VARCHAR(128) NOT NULL DEFAULT '',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  pdf_path VARCHAR(500) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES compliance_alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, notification_type)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'solo', 'team', 'scale')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  seats INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,
  documents_sent INTEGER DEFAULT 0,
  documents_limit INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  label VARCHAR(100) DEFAULT 'Default',
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(key_hash)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  plan VARCHAR(20) DEFAULT 'team' CHECK (plan IN ('team', 'scale')),
  stripe_subscription_id VARCHAR(255),
  document_limit INTEGER DEFAULT 200,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- ════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_metadata_signature_id ON compliance_metadata(signature_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_signing_workflows_creator_id ON signing_workflows(creator_id);
CREATE INDEX IF NOT EXISTS idx_signing_workflows_document_id ON signing_workflows(document_id);
CREATE INDEX IF NOT EXISTS idx_workflow_recipients_workflow_id ON workflow_recipients(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_workflow_id ON workflow_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_token ON signing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_workflow_id ON signing_tokens(workflow_id);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_recipient_id ON signing_tokens(recipient_id);
CREATE INDEX IF NOT EXISTS idx_signing_certificates_workflow_id ON signing_certificates(workflow_id);
CREATE INDEX IF NOT EXISTS idx_signing_certificates_certificate_id ON signing_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs(action, created_at);

-- ════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════

-- Default compliance alert rules
INSERT INTO compliance_alert_rules (rule_type, threshold, enabled)
SELECT * FROM (VALUES
  ('failed_login_attempts', 5, true),
  ('documents_per_hour', 100, true),
  ('unsigned_documents_age_days', 30, true),
  ('expired_signatures', 0, true)
) AS v(rule_type, threshold, enabled)
WHERE NOT EXISTS (SELECT 1 FROM compliance_alert_rules LIMIT 1);

-- Record schema version
INSERT INTO _schema_version (schema_hash, version, source) VALUES ('init_v2_full', 2, 'init');
