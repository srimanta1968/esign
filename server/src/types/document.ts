export interface Document {
  id: string;
  user_id: string;
  file_path: string;
  original_name: string;
  mime_type: string;
  file_type: string;
  file_size: number;
  uploaded_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentResponse {
  id: string;
  user_id: string;
  file_path: string;
  original_name: string;
  mime_type?: string;
  file_type?: string;
  file_size?: number;
  uploaded_at: string;
}

export interface UploadDocumentRequest {
  file_path: string;
  original_name: string;
}

// Document Versions
export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_path: string;
  file_size: number;
  created_by: string;
  created_at: Date;
}

export interface DocumentVersionResponse {
  id: string;
  document_id: string;
  version_number: number;
  file_path: string;
  file_size: number;
  created_by: string;
  created_at: string;
}

// Document Templates
export interface DocumentTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string;
  file_path: string;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentTemplateResponse {
  id: string;
  user_id: string;
  name: string;
  description: string;
  file_path: string;
  created_at: string;
  updated_at: string;
}

// Document Tags
export interface DocumentTag {
  id: string;
  document_id: string;
  tag: string;
  created_at: Date;
}

export interface DocumentTagResponse {
  id: string;
  document_id: string;
  tag: string;
  created_at: string;
}
