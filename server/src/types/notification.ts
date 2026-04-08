export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at: Date;
}

export interface NotificationResponse {
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

// Notification delivery types
export type DeliveryChannel = 'email' | 'sms' | 'in_app';
export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export interface NotificationDeliveryLog {
  id: string;
  notification_id: string;
  channel: DeliveryChannel;
  recipient: string;
  status: DeliveryStatus;
  sent_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  message: string;
  channels: DeliveryChannel[];
  actionUrl?: string;
}

// Notification preference types
export type NotificationType = 'signature_requested' | 'signature_completed' | 'document_shared' | 'reminder' | 'system';

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'signature_requested',
  'signature_completed',
  'document_shared',
  'reminder',
  'system',
];

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationPreferenceResponse {
  notification_type: NotificationType;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
}

export interface UpdatePreferencesRequest {
  preferences: NotificationPreferenceResponse[];
}

// SSE connection tracking
export interface SSEConnection {
  userId: string;
  response: import('express').Response;
  connectedAt: Date;
}
