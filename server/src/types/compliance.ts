export interface ComplianceMetadata {
  id: string;
  signature_id: string;
  signer_ip: string;
  user_agent: string;
  consent_given: boolean;
  consent_timestamp: Date;
  esign_compliant: boolean;
  created_at: Date;
}

export interface ComplianceMetadataResponse {
  id: string;
  signature_id: string;
  signer_ip: string;
  user_agent: string;
  consent_given: boolean;
  consent_timestamp: string;
  esign_compliant: boolean;
}

export interface AnalyticsEvent {
  id: string;
  event_type: string;
  user_id: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface AnalyticsEventResponse {
  id: string;
  event_type: string;
  user_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateAnalyticsEventRequest {
  event_type: string;
  metadata?: Record<string, any>;
}

export interface SignatureConfirmation {
  id: string;
  confirmation_status: 'pending_confirmation' | 'confirmed' | 'rejected';
}
