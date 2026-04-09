import { DataService } from './DataService';

/**
 * MigrationService handles database schema migrations for EP-245 tasks.
 */
export class MigrationService {
  /**
   * Run all EP-245 migrations: alter users table, create new tables.
   */
  static async runMigrations(): Promise<void> {
    try {
      // Add name, role, organization_id columns to users table
      await DataService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '';
      `);
      await DataService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
      `);
      await DataService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT NULL;
      `);

      // Create password_reset_tokens table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create organizations table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create sessions table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL,
          ip_address VARCHAR(45) DEFAULT '',
          user_agent TEXT DEFAULT '',
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-246: Add file_type, file_size, mime_type columns to documents table
      await DataService.query(`
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type VARCHAR(50) DEFAULT '';
      `);
      await DataService.query(`
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
      `);
      await DataService.query(`
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255) DEFAULT '';
      `);

      // EP-246: Create document_versions table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS document_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size BIGINT DEFAULT 0,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-246: Create document_templates table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS document_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT DEFAULT '',
          file_path VARCHAR(500) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-246: Create document_tags table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS document_tags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          tag VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(document_id, tag)
        )
      `);

      // EP-246: Index for tag search performance
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
      `);

      // EP-248: Add signature_data, signature_image_path, font_family to user_signatures
      await DataService.query(`
        ALTER TABLE user_signatures ADD COLUMN IF NOT EXISTS signature_data TEXT DEFAULT NULL;
      `);
      await DataService.query(`
        ALTER TABLE user_signatures ADD COLUMN IF NOT EXISTS signature_image_path VARCHAR(500) DEFAULT NULL;
      `);
      await DataService.query(`
        ALTER TABLE user_signatures ADD COLUMN IF NOT EXISTS font_family VARCHAR(100) DEFAULT NULL;
      `);

      // EP-248: Add confirmation_status to signatures table
      await DataService.query(`
        ALTER TABLE signatures ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(30) DEFAULT 'pending_confirmation';
      `);

      // EP-248: Add language_preference to users table
      await DataService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'en';
      `);

      // EP-248: Create compliance_metadata table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS compliance_metadata (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          signature_id UUID NOT NULL REFERENCES signatures(id) ON DELETE CASCADE,
          signer_ip VARCHAR(45) NOT NULL DEFAULT '',
          user_agent TEXT NOT NULL DEFAULT '',
          consent_given BOOLEAN NOT NULL DEFAULT false,
          consent_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          esign_compliant BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-248: Create analytics_events table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(100) NOT NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-248: Indexes
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_compliance_metadata_signature_id ON compliance_metadata(signature_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
      `);

      // EP-247: Signature Workflow Engine tables
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS signing_workflows (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL,
          creator_id UUID NOT NULL,
          workflow_type VARCHAR(20) NOT NULL CHECK (workflow_type IN ('parallel', 'sequential')),
          status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await DataService.query(`
        CREATE TABLE IF NOT EXISTS workflow_recipients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
          signer_email VARCHAR(255) NOT NULL,
          signer_name VARCHAR(255) NOT NULL DEFAULT '',
          signing_order INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'declined')),
          signed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
        )
      `);

      await DataService.query(`
        CREATE TABLE IF NOT EXISTS signature_fields (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
          recipient_id UUID NOT NULL REFERENCES workflow_recipients(id) ON DELETE CASCADE,
          field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('signature', 'initials', 'date', 'text')),
          page INTEGER NOT NULL DEFAULT 1,
          x REAL NOT NULL DEFAULT 0,
          y REAL NOT NULL DEFAULT 0,
          width REAL NOT NULL DEFAULT 150,
          height REAL NOT NULL DEFAULT 50
        )
      `);

      await DataService.query(`
        CREATE TABLE IF NOT EXISTS workflow_reminders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
          recipient_id UUID NOT NULL REFERENCES workflow_recipients(id) ON DELETE CASCADE,
          reminder_interval_hours INTEGER NOT NULL DEFAULT 24,
          last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          next_send_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          UNIQUE(workflow_id, recipient_id)
        )
      `);

      await DataService.query(`
        CREATE TABLE IF NOT EXISTS workflow_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
          action VARCHAR(50) NOT NULL,
          actor_email VARCHAR(255) NOT NULL DEFAULT '',
          actor_ip VARCHAR(45) NOT NULL DEFAULT '',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-247: Indexes for workflow tables
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_signing_workflows_creator_id ON signing_workflows(creator_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_signing_workflows_document_id ON signing_workflows(document_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_workflow_recipients_workflow_id ON workflow_recipients(workflow_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_workflow_history_workflow_id ON workflow_history(workflow_id);
      `);

      // EP-249: Create audit_logs table
      await DataService.query(`
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
        )
      `);

      // EP-249: Indexes for audit_logs performance
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs(action, created_at);
      `);

      // EP-249: Create compliance_alert_rules table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS compliance_alert_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_type VARCHAR(100) NOT NULL,
          threshold INTEGER NOT NULL DEFAULT 0,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-249: Create compliance_alerts table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS compliance_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_id UUID NOT NULL REFERENCES compliance_alert_rules(id) ON DELETE CASCADE,
          triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          details JSONB DEFAULT '{}',
          acknowledged BOOLEAN DEFAULT false,
          acknowledged_by UUID DEFAULT NULL
        )
      `);

      // EP-250: Add action_url column to notifications table
      await DataService.query(`
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT DEFAULT NULL;
      `);

      // EP-250: Create notification_delivery_log table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS notification_delivery_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
          channel VARCHAR(20) NOT NULL,
          recipient VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          error_message TEXT DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EP-250: Create notification_preferences table
      await DataService.query(`
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
        )
      `);

      // EP-250: Indexes for notification tables
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_channel ON notification_delivery_log(channel);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      `);

      // ─── Signing Token System ─────────────────────────────────────────
      // signing_tokens table for email-based signing without login
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS signing_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
          recipient_id UUID NOT NULL REFERENCES workflow_recipients(id) ON DELETE CASCADE,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Indexes for signing_tokens
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_signing_tokens_token ON signing_tokens(token);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_signing_tokens_workflow_id ON signing_tokens(workflow_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_signing_tokens_recipient_id ON signing_tokens(recipient_id);
      `);

      // Add required column to signature_fields (defaults to true)
      await DataService.query(`
        ALTER TABLE signature_fields ADD COLUMN IF NOT EXISTS required BOOLEAN DEFAULT true;
      `);

      // Add signature_data, signature_type, signed_at columns to signature_fields
      await DataService.query(`
        ALTER TABLE signature_fields ADD COLUMN IF NOT EXISTS signature_data TEXT DEFAULT NULL;
      `);
      await DataService.query(`
        ALTER TABLE signature_fields ADD COLUMN IF NOT EXISTS signature_type VARCHAR(20) DEFAULT NULL;
      `);
      await DataService.query(`
        ALTER TABLE signature_fields ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
      `);

      // ─── EP-251: Signed PDF & Certificate columns on signing_workflows ────
      await DataService.query(`
        ALTER TABLE signing_workflows ADD COLUMN IF NOT EXISTS signed_pdf_path VARCHAR(500) DEFAULT NULL;
      `);
      await DataService.query(`
        ALTER TABLE signing_workflows ADD COLUMN IF NOT EXISTS certificate_pdf_path VARCHAR(500) DEFAULT NULL;
      `);
      await DataService.query(`
        ALTER TABLE signing_workflows ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
      `);

      // EP-251: Create signing_certificates table
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS signing_certificates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
          certificate_id UUID NOT NULL UNIQUE,
          document_hash VARCHAR(128) NOT NULL DEFAULT '',
          generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          pdf_path VARCHAR(500) DEFAULT NULL
        )
      `);

      // EP-251: Indexes for signing_certificates
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_signing_certificates_workflow_id ON signing_certificates(workflow_id);
      `);
      await DataService.query(`
        CREATE INDEX IF NOT EXISTS idx_signing_certificates_certificate_id ON signing_certificates(certificate_id);
      `);

      // ─── Billing: subscriptions & usage tracking ────────────────────
      await DataService.query(`
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
        )
      `);

      await DataService.query(`
        CREATE TABLE IF NOT EXISTS usage_tracking (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          month_year VARCHAR(7) NOT NULL,
          documents_sent INTEGER DEFAULT 0,
          documents_limit INTEGER DEFAULT 3,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, month_year)
        )
      `);

      await DataService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';
      `);

      // API Keys table
      await DataService.query(`
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
      `);

      // ─── Teams: teams, team_members, team_invites ─────────────────────
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          owner_id UUID NOT NULL REFERENCES users(id),
          plan VARCHAR(20) DEFAULT 'team' CHECK (plan IN ('team', 'scale')),
          stripe_subscription_id VARCHAR(255),
          document_limit INTEGER DEFAULT 200,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await DataService.query(`
        CREATE TABLE IF NOT EXISTS team_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(team_id, user_id)
        )
      `);

      await DataService.query(`
        CREATE TABLE IF NOT EXISTS team_invites (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          invited_by UUID NOT NULL REFERENCES users(id),
          token VARCHAR(255) NOT NULL UNIQUE,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
        )
      `);

      await DataService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
      `);

      console.log('EP-245, EP-246, EP-247, EP-248, EP-249, EP-250, EP-251, Signing Token, Billing & API Keys, Teams migrations completed successfully');
    } catch (error: unknown) {
      console.error('Migration error:', error instanceof Error ? error.message : 'Unknown error');
      // Don't throw - migrations should be idempotent and non-blocking
    }
  }
}

export default MigrationService;
