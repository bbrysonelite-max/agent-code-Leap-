export interface CreateGDPRRequest {
  user_id: string;
  request_type: 'export' | 'delete' | 'rectification' | 'portability';
  data_categories?: string[];
  export_format?: 'json' | 'csv' | 'xml';
  verification_method?: string;
  metadata?: Record<string, any>;
}

export interface GDPRRequestResponse {
  request_id: string;
  status: string;
  message: string;
  estimated_completion?: Date;
}

export interface DataExportResponse {
  request_id: string;
  download_url?: string;
  expires_at?: Date;
  data?: Record<string, any>;
  format: string;
}

export interface DataDeletionResponse {
  request_id: string;
  deleted_records: Array<{
    service: string;
    table: string;
    count: number;
  }>;
  anonymized_records: Array<{
    service: string;
    table: string;
    count: number;
    method: string;
  }>;
  completed_at: Date;
}

export interface UserDataSummary {
  user_id: string;
  data_categories: Array<{
    category: string;
    services: string[];
    record_count: number;
    last_updated?: Date;
  }>;
  retention_policies: Array<{
    service: string;
    policy: string;
    expires_at?: Date;
  }>;
  active_gdpr_requests: Array<{
    request_id: string;
    type: string;
    status: string;
    created_at: Date;
  }>;
}

