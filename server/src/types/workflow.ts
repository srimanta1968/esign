export type WorkflowType = 'parallel' | 'sequential';
export type WorkflowStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type RecipientStatus = 'pending' | 'signed' | 'declined';
export type SignatureFieldType = 'signature' | 'initials' | 'date' | 'text';
export type WorkflowAction = 'created' | 'started' | 'signed' | 'declined' | 'completed' | 'cancelled' | 'reminder_sent' | 'updated' | 'token_generated' | 'opened' | 'engaged' | 'signing_link_revealed';

/**
 * How a signing request reached the recipient. Both routes hand over the same
 * token URL and are therefore indistinguishable to everything downstream — this
 * only records which one was used, so the UI can word it accurately.
 */
export type NotifyMethod = 'email' | 'manual_link';

export interface SigningWorkflow {
  id: string;
  document_id: string;
  document_name?: string | null;
  creator_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  signed_pdf_path?: string | null;
  certificate_pdf_path?: string | null;
  completed_at?: Date | null;
  completion_email_sent_at?: Date | null;
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
  /** When the signing request was handed over, by either delivery route. */
  notified_at?: Date | null;
  /** Which route delivered it — see NotifyMethod. */
  notified_via?: NotifyMethod | null;
  /** Why the last send attempt failed, if it did. */
  notify_error?: string | null;
  /** Any fetch of the signing page, including mail-security scanners. */
  opened_at?: Date | null;
  /** When someone actually operated the page (focused or filled a field).
   *  A page fetch alone never sets this — scanners fetch, they do not fill. */
  opened_confirmed_at?: Date | null;
  opened_user_agent?: string | null;
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
  label?: string | null;
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
    label?: string | null;
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
    label?: string | null;
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
  /**
   * Delivery state, distinct from signing state. "pending" on its own cannot
   * tell the creator whether the request was ever sent, so the UI reads these
   * to show "sent" / "opened" / a send failure instead of a bare "pending".
   */
  notified_at: string | null;
  notified_via: NotifyMethod | null;
  notify_error: string | null;
  /** Raw first touch — may well be a mail-security scanner, so do not present
   *  this as the recipient having read the document. */
  opened_at: string | null;
  /** First real interaction with the page; this is what the UI shows. */
  opened_confirmed_at: string | null;
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
