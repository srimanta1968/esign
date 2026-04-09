export type WorkflowType = 'parallel' | 'sequential';
export type WorkflowStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type RecipientStatus = 'pending' | 'signed' | 'declined';
export type SignatureFieldType = 'signature' | 'initials' | 'date' | 'text';
export type WorkflowAction = 'created' | 'started' | 'signed' | 'declined' | 'completed' | 'cancelled' | 'reminder_sent' | 'updated' | 'token_generated';

export interface SigningWorkflow {
  id: string;
  document_id: string;
  creator_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  signed_pdf_path?: string | null;
  certificate_pdf_path?: string | null;
  completed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowRecipient {
  id: string;
  workflow_id: string;
  signer_email: string;
  signer_name: string;
  signing_order: number;
  status: RecipientStatus;
  signed_at: Date | null;
}

export interface SignatureField {
  id: string;
  workflow_id: string;
  recipient_id: string;
  field_type: SignatureFieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signature_data?: string;
  signature_type?: string;
  signed_at?: Date | null;
}

export interface WorkflowReminder {
  id: string;
  workflow_id: string;
  recipient_id: string;
  reminder_interval_hours: number;
  last_sent_at: Date | null;
  next_send_at: Date | null;
}

export interface WorkflowHistory {
  id: string;
  workflow_id: string;
  action: WorkflowAction;
  actor_email: string;
  actor_ip: string;
  metadata: Record<string, any>;
  created_at: Date;
}

// Request types
export interface CreateWorkflowRequest {
  document_id: string;
  workflow_type: WorkflowType;
  recipients: {
    signer_email: string;
    signer_name: string;
    signing_order: number;
  }[];
  fields?: {
    recipient_index: number;
    field_type: SignatureFieldType;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required?: boolean;
  }[];
}

export interface UpdateWorkflowRequest {
  recipients?: {
    signer_email: string;
    signer_name: string;
    signing_order: number;
  }[];
  fields?: {
    recipient_index: number;
    field_type: SignatureFieldType;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required?: boolean;
  }[];
}

export interface ConfigureRemindersRequest {
  reminder_interval_hours: number;
  recipient_ids?: string[];
}

// Response types
export interface WorkflowResponse {
  id: string;
  document_id: string;
  document_name: string;
  creator_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  recipients: WorkflowRecipientResponse[];
  fields: SignatureFieldResponse[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowRecipientResponse {
  id: string;
  signer_email: string;
  signer_name: string;
  signing_order: number;
  status: RecipientStatus;
  signed_at: string | null;
}

export interface SignatureFieldResponse {
  id: string;
  recipient_id: string;
  field_type: SignatureFieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
}

export interface WorkflowHistoryResponse {
  id: string;
  workflow_id: string;
  action: WorkflowAction;
  actor_email: string;
  actor_ip: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface WorkflowStatusResponse {
  workflow_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  recipients: WorkflowRecipientResponse[];
  progress: {
    total: number;
    signed: number;
    pending: number;
    declined: number;
  };
}
