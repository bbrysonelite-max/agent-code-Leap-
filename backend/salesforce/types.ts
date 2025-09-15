export interface SalesforceConnection {
  id: number;
  org_name: string;
  instance_url: string;
  access_token: string;
  refresh_token: string;
  client_id: string;
  client_secret: string;
  is_sandbox: boolean;
  is_active: boolean;
  last_sync_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SalesforceFieldMapping {
  id: number;
  connection_id: number;
  object_type: SalesforceObjectType;
  local_field: string;
  salesforce_field: string;
  field_type: FieldType;
  transformation_rule: any;
  is_ai_mapped: boolean;
  confidence_score: number | null;
  is_active: boolean;
  created_at: Date;
}

export interface SalesforceSyncLog {
  id: number;
  connection_id: number;
  sync_type: SyncType;
  direction: SyncDirection;
  object_type: string;
  records_processed: number;
  records_success: number;
  records_failed: number;
  status: SyncStatus;
  error_details: any;
  started_at: Date;
  completed_at: Date | null;
}

export interface SalesforceSyncMapping {
  id: number;
  connection_id: number;
  local_table: LocalTable;
  local_record_id: number;
  salesforce_object: string;
  salesforce_record_id: string;
  last_synced_at: Date;
  local_updated_at: Date | null;
  salesforce_updated_at: Date | null;
  sync_status: SyncMappingStatus;
  created_at: Date;
}

export type SalesforceObjectType = 'Lead' | 'Contact' | 'Account' | 'Opportunity';
export type FieldType = 'text' | 'email' | 'phone' | 'date' | 'boolean' | 'picklist' | 'number';
export type SyncType = 'full' | 'incremental' | 'realtime';
export type SyncDirection = 'to_salesforce' | 'from_salesforce' | 'bidirectional';
export type SyncStatus = 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
export type LocalTable = 'prospects' | 'agents' | 'email_campaigns';
export type SyncMappingStatus = 'synced' | 'pending' | 'conflict' | 'error';

// Salesforce API response types
export interface SalesforceRecord {
  Id: string;
  [key: string]: any;
}

export interface SalesforceQueryResponse {
  totalSize: number;
  done: boolean;
  records: SalesforceRecord[];
  nextRecordsUrl?: string;
}

export interface SalesforceDescribeResponse {
  name: string;
  label: string;
  fields: SalesforceField[];
}

export interface SalesforceField {
  name: string;
  label: string;
  type: string;
  length?: number;
  picklistValues?: { label: string; value: string }[];
  referenceTo?: string[];
  required: boolean;
  updateable: boolean;
}

// AI field mapping types
export interface AIFieldMappingSuggestion {
  local_field: string;
  salesforce_field: string;
  confidence_score: number;
  reasoning: string;
  transformation_rule?: any;
}

export interface AIFieldMappingRequest {
  local_schema: LocalFieldSchema[];
  salesforce_schema: SalesforceField[];
  object_type: SalesforceObjectType;
  sample_data?: any[];
}

export interface LocalFieldSchema {
  name: string;
  type: string;
  description?: string;
  sample_values?: any[];
}