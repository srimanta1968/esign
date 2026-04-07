export interface Document {
  id: string;
  user_id: string;
  file_path: string;
  uploaded_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentResponse {
  id: string;
  user_id: string;
  file_path: string;
  uploaded_at: string;
}

export interface UploadDocumentRequest {
  file_path: string;
  original_name: string;
}
