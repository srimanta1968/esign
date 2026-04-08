export interface Session {
  id: string;
  user_id: string;
  token: string;
  ip_address: string;
  user_agent: string;
  expires_at: Date;
  created_at: Date;
}

export interface SessionResponse {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  expires_at: string;
  created_at: string;
}
