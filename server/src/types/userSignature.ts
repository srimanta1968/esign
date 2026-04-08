export interface UserSignature {
  id: string;
  user_id: string;
  signature_type: string;
  signature_data: string | null;
  signature_image_path: string | null;
  font_family: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserSignatureResponse {
  id: string;
  user_id: string;
  signature_type: string;
  signature_data?: string | null;
  signature_image_path?: string | null;
  font_family?: string | null;
}

export interface CreateUserSignatureRequest {
  signature_type: 'drawn' | 'typed' | 'uploaded';
  signature_data?: string;
  font_family?: string;
}

export interface CreateDrawnSignatureRequest {
  signature_type: 'drawn';
  signature_data: string;
  input_method?: 'mouse' | 'touch' | 'stylus';
}

export interface CreateTypedSignatureRequest {
  signature_type: 'typed';
  signature_data: string;
  font_family: string;
}

export interface CreateUploadedSignatureRequest {
  signature_type: 'uploaded';
}
