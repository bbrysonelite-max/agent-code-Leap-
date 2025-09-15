import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { salesforceDB } from "./db";
import { prospectDB } from "../prospect/db";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import { SalesforceClient } from "./client";
import type { 
  SalesforceConnection, 
  SalesforceSyncLog,
  SalesforceSyncMapping,
  SalesforceFieldMapping,
  SyncType,
  SyncDirection
} from "./types";
import type { Prospect } from "../agent/types";

export interface SyncRequest {
  connection_id: number;
  sync_type?: SyncType;
  direction?: SyncDirection;
  object_types?: string[];
  force_sync?: boolean;
}

export interface SyncStatus {
  sync_log: SalesforceSyncLog;
  progress?: {
    current: number;
    total: number;
    status: string;
  };
}

// Start synchronization between local data and Salesforce
export const startSync = api(
  { expose: true, method: "POST", path: "/salesforce/sync" },
  wrapAsync(async (req: SyncRequest): Promise<SyncStatus> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    
    const syncType = req.sync_type || 'incremental';
    const direction = req.direction || 'bidirectional';
    const objectTypes = req.object_types || ['Lead', 'Contact'];

    // Get connection
    const connection = await getActiveConnection(req.connection_id);
    const client = new SalesforceClient(connection);

    // Create sync log
    const syncLog = await createSyncLog(req.connection_id, syncType, direction, objectTypes.join(','));

    // Start sync process asynchronously
    processSyncAsync(connection, client, syncLog, objectTypes, direction, syncType, req.force_sync || false);

    return {
      sync_log: syncLog,
      progress: {
        current: 0,
        total: 0,
        status: 'initializing'
      }
    };
  })
);

export interface GetSyncStatusRequest {
  sync_id: number;
}

// Get sync status
export const getSyncStatus = api<GetSyncStatusRequest, SyncStatus>(
  { expose: true, method: "GET", path: "/salesforce/sync/:sync_id/status" },
  wrapAsync(async (req: GetSyncStatusRequest): Promise<SyncStatus> => {
    validateField(req.sync_id, "sync_id", [Rules.positive(), Rules.integer()]);

    const syncLog = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceSyncLog>(
        `SELECT * FROM salesforce_sync_logs WHERE id = $1`,
        req.sync_id
      ),
      "get sync log"
    );

    if (!syncLog) {
      throw new Error("Sync log not found");
    }

    return { sync_log: syncLog };
  })
);

// Sync prospects to Salesforce leads
async function syncProspectsToSalesforce(
  client: SalesforceClient,
  connection: SalesforceConnection,
  syncLog: SalesforceSyncLog,
  forceSync: boolean = false
): Promise<void> {
  try {
    // Get field mappings for leads
    const fieldMappings = await getFieldMappings(connection.id, 'Lead');
    
    // Get prospects to sync
    let prospectsQuery = `
      SELECT p.* FROM prospects p
      LEFT JOIN salesforce_sync_mappings sm ON sm.local_record_id = p.id 
        AND sm.local_table = 'prospects' 
        AND sm.salesforce_object = 'Lead'
        AND sm.connection_id = $1
    `;
    
    if (!forceSync) {
      prospectsQuery += ` WHERE sm.id IS NULL OR p.updated_at > sm.last_synced_at`;
    }
    
    const prospects = await executeQuery(
      () => prospectDB.rawQueryAll<Prospect>(prospectsQuery, connection.id),
      "get prospects for sync"
    );

    await updateSyncLog(syncLog.id, { records_processed: prospects.length });

    let successCount = 0;
    let failureCount = 0;

    for (const prospect of prospects) {
      try {
        // Transform prospect data to Salesforce Lead format
        const leadData = transformProspectToLead(prospect, fieldMappings);
        
        // Check if mapping exists
        const existingMapping = await getExistingSyncMapping(
          connection.id, 'prospects', prospect.id, 'Lead'
        );

        if (existingMapping) {
          // Update existing lead
          await client.update('Lead', existingMapping.salesforce_record_id, leadData);
          await updateSyncMapping(existingMapping.id, prospect.updated_at);
        } else {
          // Create new lead
          const result = await client.create('Lead', leadData);
          await createSyncMapping(
            connection.id,
            'prospects',
            prospect.id,
            'Lead',
            result.id,
            prospect.updated_at
          );
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to sync prospect ${prospect.id}:`, error);
        failureCount++;
      }
    }

    await updateSyncLog(syncLog.id, {
      records_success: successCount,
      records_failed: failureCount,
      status: 'completed',
      completed_at: new Date()
    });

  } catch (error) {
    await updateSyncLog(syncLog.id, {
      status: 'failed',
      error_details: { error: error instanceof Error ? error.message : 'Unknown error' },
      completed_at: new Date()
    });
    throw error;
  }
}

// Sync Salesforce leads to prospects
async function syncSalesforceToProspects(
  client: SalesforceClient,
  connection: SalesforceConnection,
  syncLog: SalesforceSyncLog,
  forceSync: boolean = false
): Promise<void> {
  try {
    // Get field mappings for leads
    const fieldMappings = await getFieldMappings(connection.id, 'Lead');
    
    // Build SOQL query
    const salesforceFields = fieldMappings.map(fm => fm.salesforce_field);
    const baseFields = ['Id', 'Name', 'Email', 'Company', 'Title', 'Phone', 'Status', 'LastModifiedDate'];
    const allFields = [...new Set([...baseFields, ...salesforceFields])];
    
    let soql = `SELECT ${allFields.join(', ')} FROM Lead`;
    
    if (!forceSync && connection.last_sync_at) {
      const lastSyncDate = connection.last_sync_at.toISOString();
      soql += ` WHERE LastModifiedDate > ${lastSyncDate}`;
    }
    
    soql += ` ORDER BY LastModifiedDate DESC`;

    const leads = await client.queryAll(soql);
    
    await updateSyncLog(syncLog.id, { records_processed: leads.length });

    let successCount = 0;
    let failureCount = 0;

    for (const lead of leads) {
      try {
        // Transform Salesforce Lead to prospect format
        const prospectData = transformLeadToProspect(lead, fieldMappings);
        
        // Check if mapping exists
        const existingMapping = await getExistingSyncMapping(
          connection.id, 'prospects', null, 'Lead', lead.Id
        );

        if (existingMapping) {
          // Update existing prospect
          await executeQuery(
            () => prospectDB.rawQueryRow(
              `UPDATE prospects SET 
               name = $1, email = $2, company = $3, position = $4, 
               status = $5, updated_at = NOW()
               WHERE id = $6`,
              prospectData.name, prospectData.email, prospectData.company,
              prospectData.position, prospectData.status, existingMapping.local_record_id
            ),
            "update prospect from salesforce"
          );
          
          await updateSyncMapping(existingMapping.id, null, new Date(lead.LastModifiedDate));
        } else {
          // Create new prospect
          const newProspect = await executeQuery(
            () => prospectDB.rawQueryRow<Prospect>(
              `INSERT INTO prospects 
               (agent_id, name, email, company, position, classification, status, notes)
               VALUES (1, $1, $2, $3, $4, 'unqualified', $5, 'Imported from Salesforce')
               RETURNING *`,
              prospectData.name, prospectData.email, prospectData.company,
              prospectData.position, prospectData.status
            ),
            "create prospect from salesforce"
          );

          if (newProspect) {
            await createSyncMapping(
              connection.id,
              'prospects',
              newProspect.id,
              'Lead',
              lead.Id,
              null,
              new Date(lead.LastModifiedDate)
            );
          }
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to sync lead ${lead.Id}:`, error);
        failureCount++;
      }
    }

    // Update connection last sync time
    await executeQuery(
      () => salesforceDB.rawQueryRow(
        `UPDATE salesforce_connections SET last_sync_at = NOW() WHERE id = $1`,
        connection.id
      ),
      "update connection last sync time"
    );

    await updateSyncLog(syncLog.id, {
      records_success: successCount,
      records_failed: failureCount,
      status: 'completed',
      completed_at: new Date()
    });

  } catch (error) {
    await updateSyncLog(syncLog.id, {
      status: 'failed',
      error_details: { error: error instanceof Error ? error.message : 'Unknown error' },
      completed_at: new Date()
    });
    throw error;
  }
}

// Process sync asynchronously
async function processSyncAsync(
  connection: SalesforceConnection,
  client: SalesforceClient,
  syncLog: SalesforceSyncLog,
  objectTypes: string[],
  direction: SyncDirection,
  syncType: SyncType,
  forceSync: boolean
): Promise<void> {
  try {
    await updateSyncLog(syncLog.id, { status: 'running' });

    for (const objectType of objectTypes) {
      if (objectType === 'Lead') {
        if (direction === 'to_salesforce' || direction === 'bidirectional') {
          await syncProspectsToSalesforce(client, connection, syncLog, forceSync);
        }
        
        if (direction === 'from_salesforce' || direction === 'bidirectional') {
          await syncSalesforceToProspects(client, connection, syncLog, forceSync);
        }
      }
      // Add support for other object types (Contact, Account, etc.) here
    }

  } catch (error) {
    console.error('Sync process failed:', error);
    await updateSyncLog(syncLog.id, {
      status: 'failed',
      error_details: { error: error instanceof Error ? error.message : 'Unknown error' },
      completed_at: new Date()
    });
  }
}

// Helper functions
async function getActiveConnection(connectionId: number): Promise<SalesforceConnection> {
  const connection = await executeQuery(
    () => salesforceDB.rawQueryRow<SalesforceConnection>(
      `SELECT * FROM salesforce_connections WHERE id = $1 AND is_active = true`,
      connectionId
    ),
    "get salesforce connection"
  );

  if (!connection) {
    throw new Error("Active connection not found");
  }

  return connection;
}

async function createSyncLog(
  connectionId: number,
  syncType: SyncType,
  direction: SyncDirection,
  objectType: string
): Promise<SalesforceSyncLog> {
  const syncLog = await executeQuery(
    () => salesforceDB.rawQueryRow<SalesforceSyncLog>(
      `INSERT INTO salesforce_sync_logs 
       (connection_id, sync_type, direction, object_type, status)
       VALUES ($1, $2, $3, $4, 'running')
       RETURNING *`,
      connectionId, syncType, direction, objectType
    ),
    "create sync log"
  );

  if (!syncLog) {
    throw new Error("Failed to create sync log");
  }

  return syncLog;
}

async function updateSyncLog(syncId: number, updates: Partial<SalesforceSyncLog>): Promise<void> {
  const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
  const values = [syncId, ...Object.values(updates)];

  await executeQuery(
    () => salesforceDB.rawQueryRow(
      `UPDATE salesforce_sync_logs SET ${setClause} WHERE id = $1`,
      ...values
    ),
    "update sync log"
  );
}

async function getFieldMappings(connectionId: number, objectType: string): Promise<SalesforceFieldMapping[]> {
  return executeQuery(
    () => salesforceDB.rawQueryAll<SalesforceFieldMapping>(
      `SELECT * FROM salesforce_field_mappings 
       WHERE connection_id = $1 AND object_type = $2 AND is_active = true`,
      connectionId, objectType
    ),
    "get field mappings"
  );
}

async function getExistingSyncMapping(
  connectionId: number,
  localTable: string,
  localRecordId?: number | null,
  salesforceObject?: string,
  salesforceRecordId?: string
): Promise<SalesforceSyncMapping | null> {
  let query = `SELECT * FROM salesforce_sync_mappings WHERE connection_id = $1`;
  const params: any[] = [connectionId];
  let paramIndex = 2;

  if (localRecordId && salesforceObject) {
    query += ` AND local_table = $${paramIndex} AND local_record_id = $${paramIndex + 1} AND salesforce_object = $${paramIndex + 2}`;
    params.push(localTable, localRecordId, salesforceObject);
  } else if (salesforceRecordId) {
    query += ` AND salesforce_record_id = $${paramIndex}`;
    params.push(salesforceRecordId);
  } else {
    return null;
  }

  return executeQuery(
    () => salesforceDB.rawQueryRow<SalesforceSyncMapping>(query, ...params),
    "get existing sync mapping"
  );
}

async function createSyncMapping(
  connectionId: number,
  localTable: string,
  localRecordId: number,
  salesforceObject: string,
  salesforceRecordId: string,
  localUpdatedAt?: Date | null,
  salesforceUpdatedAt?: Date | null
): Promise<void> {
  await executeQuery(
    () => salesforceDB.rawQueryRow(
      `INSERT INTO salesforce_sync_mappings 
       (connection_id, local_table, local_record_id, salesforce_object, salesforce_record_id, 
        local_updated_at, salesforce_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      connectionId, localTable, localRecordId, salesforceObject, salesforceRecordId,
      localUpdatedAt, salesforceUpdatedAt
    ),
    "create sync mapping"
  );
}

async function updateSyncMapping(
  mappingId: number,
  localUpdatedAt?: Date | null,
  salesforceUpdatedAt?: Date | null
): Promise<void> {
  await executeQuery(
    () => salesforceDB.rawQueryRow(
      `UPDATE salesforce_sync_mappings 
       SET last_synced_at = NOW(), local_updated_at = $2, salesforce_updated_at = $3, sync_status = 'synced'
       WHERE id = $1`,
      mappingId, localUpdatedAt, salesforceUpdatedAt
    ),
    "update sync mapping"
  );
}

function transformProspectToLead(prospect: Prospect, fieldMappings: SalesforceFieldMapping[]): any {
  const leadData: any = {
    LastName: prospect.name,
    Email: prospect.email,
    Company: prospect.company || 'Unknown',
    Title: prospect.position,
    Phone: null, // Add phone mapping if available
    Status: mapProspectStatusToLeadStatus(prospect.status)
  };

  // Apply custom field mappings
  for (const mapping of fieldMappings) {
    const localValue = (prospect as any)[mapping.local_field];
    if (localValue !== undefined && localValue !== null) {
      leadData[mapping.salesforce_field] = applyTransformation(localValue, mapping.transformation_rule);
    }
  }

  return leadData;
}

function transformLeadToProspect(lead: any, fieldMappings: SalesforceFieldMapping[]): any {
  const prospectData: any = {
    name: lead.Name || `${lead.FirstName || ''} ${lead.LastName || ''}`.trim(),
    email: lead.Email,
    company: lead.Company,
    position: lead.Title,
    status: mapLeadStatusToProspectStatus(lead.Status)
  };

  // Apply custom field mappings in reverse
  for (const mapping of fieldMappings) {
    const salesforceValue = lead[mapping.salesforce_field];
    if (salesforceValue !== undefined && salesforceValue !== null) {
      prospectData[mapping.local_field] = applyReverseTransformation(salesforceValue, mapping.transformation_rule);
    }
  }

  return prospectData;
}

function mapProspectStatusToLeadStatus(prospectStatus: string): string {
  const statusMap: Record<string, string> = {
    'new': 'Open - Not Contacted',
    'contacted': 'Working - Contacted',
    'responded': 'Working - Contacted',
    'qualified': 'Qualified',
    'converted': 'Closed - Converted'
  };
  
  return statusMap[prospectStatus] || 'Open - Not Contacted';
}

function mapLeadStatusToProspectStatus(leadStatus: string): string {
  const statusMap: Record<string, string> = {
    'Open - Not Contacted': 'new',
    'Working - Contacted': 'contacted',
    'Qualified': 'qualified',
    'Closed - Converted': 'converted',
    'Closed - Not Converted': 'unqualified'
  };
  
  return statusMap[leadStatus] || 'new';
}

function applyTransformation(value: any, rule: any): any {
  if (!rule) return value;
  
  switch (rule.type) {
    case 'date_parse':
      return new Date(value).toISOString().split('T')[0];
    case 'numeric_parse':
      return parseFloat(value) || 0;
    default:
      return value;
  }
}

function applyReverseTransformation(value: any, rule: any): any {
  if (!rule) return value;
  
  switch (rule.type) {
    case 'date_parse':
      return new Date(value);
    case 'numeric_parse':
      return value.toString();
    default:
      return value;
  }
}