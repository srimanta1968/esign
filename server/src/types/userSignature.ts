export interface UserSignature {
  id: string;
  user_id: string;
  signature_type: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserSignatureResponse {
  id: string;
  user_id: string;
  signature_type: string;
}

export interface CreateUserSignatureRequest {
  signature_type: string;
}
