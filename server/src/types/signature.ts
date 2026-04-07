export interface Signature {
  id: string;
  document_id: string;
  signer_email: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface SignatureResponse {
  id: string;
  document_id: string;
  signer_email: string;
  status: string;
}

export interface CreateSignatureRequest {
  document_id: string;
  signer_email: string;
}
