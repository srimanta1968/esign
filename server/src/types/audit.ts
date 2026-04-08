export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface AuditLogResponse {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface AuditLogSearchParams {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogSearchResponse {
  items: AuditLogResponse[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ComplianceReport {
  totalActions: number;
  distinctUsers: number;
  actionBreakdown: Record<string, number>;
  topUsers: { user_id: string; action_count: number }[];
  complianceScore: number;
}

export interface ComplianceAlertRule {
  id: string;
  rule_type: string;
  threshold: number;
  enabled: boolean;
  created_at: Date;
}

export interface ComplianceAlertRuleCreateRequest {
  rule_type: string;
  threshold: number;
  enabled?: boolean;
}

export interface ComplianceAlert {
  id: string;
  rule_id: string;
  triggered_at: Date;
  details: Record<string, any>;
  acknowledged: boolean;
  acknowledged_by: string | null;
}
