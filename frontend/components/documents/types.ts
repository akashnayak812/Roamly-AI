export interface UserDocument {
  id: string;
  title: string;
  description?: string | null;
  original_filename: string;
  file_type: string;
  category?: string | null;
  country?: string | null;
  city?: string | null;
  language?: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  total_chunks: number;
  created_at: string;
}

export interface DocumentCitation {
  source_name: string;
  source_type: string;
  document_scope?: string;
  document_id?: string;
  source_url?: string | null;
  snippet?: string;
  index?: number;
}
