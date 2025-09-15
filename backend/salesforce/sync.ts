import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { salesforceDB } from "./db";
import { prospectDB } from "../prospect/db";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import { SalesforceClient } from "./client";
import { triggerProspectSync } from "./realtime_sync";
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

    // Check if a sync is already running for this connection
    const runningSyncs = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceSyncLog>(
        `SELECT * FROM salesforce_sync_logs 
         WHERE connection_id = $1 AND status = 'running'
         ORDER BY started_at DESC LIMIT 1`,
        req.connection_id
      ),
      "check running syncs"
    );

    if (runningSyncs.length > 0) {
      throw new Error("A sync is already running for this connection");
    }

    // Get connection
    const connection = await getActiveConnection(req.connection_id);
    const client = new SalesforceClient(connection);

    // Test connection before starting sync
    const isConnected = await client.testConnection();
    if (!isConnected) {
      throw new Error("Salesforce connection test failed");
    }

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

export interface SyncHistoryRequest {
  connection_id: number;
}

// Get sync history for a connection
export const getSyncHistory = api<SyncHistoryRequest, {
  sync_logs: SalesforceSyncLog[];
  total_count: number;
}>(
  { expose: true, method: "GET", path: "/salesforce/connections/:connection_id/sync-history" },
  wrapAsync(async (req: SyncHistoryRequest): Promise<{
    sync_logs: SalesforceSyncLog[];
    total_count: number;
  }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);

    const syncLogs = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceSyncLog>(
        `SELECT * FROM salesforce_sync_logs 
         WHERE connection_id = $1 
         ORDER BY started_at DESC 
         LIMIT 50`,
        req.connection_id
      ),
      "get sync history"
    );

    const totalCountResult = await executeQuery(
      () => salesforceDB.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM salesforce_sync_logs WHERE connection_id = $1`,
        req.connection_id
      ),
      "get sync history count"
    );

    return {
      sync_logs: syncLogs,
      total_count: totalCountResult?.count || 0
    };
  })
);

export interface CancelSyncRequest {
  sync_id: number;
}

// Cancel running sync
export const cancelSync = api<CancelSyncRequest, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/salesforce/sync/:sync_id/cancel" },
  wrapAsync(async (req: CancelSyncRequest): Promise<{ success: boolean; message: string }> => {
    validateField(req.sync_id, "sync_id", [Rules.positive(), Rules.integer()]);

    const syncLog = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceSyncLog>(
        `SELECT * FROM salesforce_sync_logs WHERE id = $1 AND status = 'running'`,
        req.sync_id
      ),
      "get running sync log"
    );

    if (!syncLog) {
      return {
        success: false,
        message: "No running sync found with the given ID"
      };
    }

    await updateSyncLog(req.sync_id, {
      status: 'cancelled',
      completed_at: new Date(),
      error_details: { message: 'Sync cancelled by user' }
    });

    return {
      success: true,
      message: "Sync cancelled successfully"
    };
  })
);

export interface SyncStatisticsRequest {
  connection_id: number;
}

// Get sync statistics
export const getSyncStatistics = api<SyncStatisticsRequest, {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  total_records_synced: number;
  active_mappings: number;
  pending_conflicts: number;
  last_sync_date: Date | null;
  sync_frequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}>(
  { expose: true, method: "GET", path: "/salesforce/connections/:connection_id/statistics" },
  wrapAsync(async (req: SyncStatisticsRequest): Promise<{
    total_syncs: number;
    successful_syncs: number;
    failed_syncs: number;
    total_records_synced: number;
    active_mappings: number;
    pending_conflicts: number;
    last_sync_date: Date | null;
    sync_frequency: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);

    // Get basic sync statistics
    const syncStats = await executeQuery(
      () => salesforceDB.rawQueryRow<{
        total_syncs: number;
        successful_syncs: number;
        failed_syncs: number;
        total_records: number;
        last_sync: Date | null;
      }>(
        `SELECT 
           COUNT(*) as total_syncs,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
           COALESCE(SUM(records_processed), 0) as total_records,
           MAX(completed_at) as last_sync
         FROM salesforce_sync_logs 
         WHERE connection_id = $1`,
        req.connection_id
      ),
      "get sync statistics"
    );

    // Get mapping statistics
    const mappingStats = await executeQuery(
      () => salesforceDB.rawQueryRow<{
        active_mappings: number;
        pending_conflicts: number;
      }>(
        `SELECT 
           COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as active_mappings,
           COUNT(CASE WHEN sync_status = 'conflict' THEN 1 END) as pending_conflicts
         FROM salesforce_sync_mappings 
         WHERE connection_id = $1`,
        req.connection_id
      ),
      "get mapping statistics"
    );

    // Get sync frequency statistics
    const frequencyStats = await executeQuery(
      () => salesforceDB.rawQueryRow<{
        daily: number;
        weekly: number;
        monthly: number;
      }>(
        `SELECT 
           COUNT(CASE WHEN started_at > NOW() - INTERVAL '1 day' THEN 1 END) as daily,
           COUNT(CASE WHEN started_at > NOW() - INTERVAL '7 days' THEN 1 END) as weekly,
           COUNT(CASE WHEN started_at > NOW() - INTERVAL '30 days' THEN 1 END) as monthly
         FROM salesforce_sync_logs 
         WHERE connection_id = $1`,
        req.connection_id
      ),
      "get sync frequency statistics"
    );

    return {
      total_syncs: syncStats?.total_syncs || 0,
      successful_syncs: syncStats?.successful_syncs || 0,
      failed_syncs: syncStats?.failed_syncs || 0,
      total_records_synced: syncStats?.total_records || 0,
      active_mappings: mappingStats?.active_mappings || 0,
      pending_conflicts: mappingStats?.pending_conflicts || 0,
      last_sync_date: syncStats?.last_sync || null,
      sync_frequency: {
        daily: frequencyStats?.daily || 0,
        weekly: frequencyStats?.weekly || 0,
        monthly: frequencyStats?.monthly || 0
      }
    };
  })
);

export interface ValidateSyncSetupRequest {
  connection_id: number;
}

// Validate sync setup
export const validateSyncSetup = api<ValidateSyncSetupRequest, {
  valid: boolean;
  issues: string[];
  recommendations: string[];
  field_mappings_count: number;
}>(
  { expose: true, method: "POST", path: "/salesforce/connections/:connection_id/validate-setup" },
  wrapAsync(async (req: ValidateSyncSetupRequest): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
    field_mappings_count: number;
  }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check connection
    const connection = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceConnection>(
        `SELECT * FROM salesforce_connections WHERE id = $1`,
        req.connection_id
      ),
      "get connection for validation"
    );

    if (!connection) {
      return {
        valid: false,
        issues: ['Connection not found'],
        recommendations: [],
        field_mappings_count: 0
      };
    }

    if (!connection.is_active) {
      issues.push('Connection is not active');
      recommendations.push('Activate the connection through OAuth flow');
    }

    // Test connection
    try {
      const client = new SalesforceClient(connection);
      const isConnected = await client.testConnection();
      if (!isConnected) {
        issues.push('Connection test failed');
        recommendations.push('Re-authenticate with Salesforce');
      }
    } catch (error) {
      issues.push(`Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      recommendations.push('Check credentials and re-authenticate');
    }

    // Check field mappings
    const mappingsCount = await executeQuery(
      () => salesforceDB.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM salesforce_field_mappings 
         WHERE connection_id = $1 AND is_active = true`,
        req.connection_id
      ),
      "count field mappings"
    );

    const mappingCount = mappingsCount?.count || 0;

    if (mappingCount === 0) {
      issues.push('No field mappings configured');
      recommendations.push('Configure field mappings for at least Lead and Contact objects');
    } else if (mappingCount < 5) {
      recommendations.push('Consider adding more field mappings for better data synchronization');
    }

    // Check for required field mappings
    const requiredMappings = ['Lead', 'Contact'];
    for (const objectType of requiredMappings) {
      const objectMappings = await executeQuery(
        () => salesforceDB.rawQueryRow<{ count: number }>(
          `SELECT COUNT(*) as count FROM salesforce_field_mappings 
           WHERE connection_id = $1 AND object_type = $2 AND is_active = true`,
          req.connection_id, objectType
        ),
        `count ${objectType} mappings`
      );

      if (!objectMappings || objectMappings.count === 0) {
        recommendations.push(`Configure field mappings for ${objectType} object`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
      field_mappings_count: mappingCount
    };
  })
);

export interface SetupWebhooksRequest {
  connection_id: number;
  webhook_url?: string;
  object_types?: string[];
}

// Setup webhooks for real-time sync
export const setupWebhooks = api<SetupWebhooksRequest, {
  success: boolean;
  message: string;
  webhook_url: string;
  configured_objects: string[];
}>(
  { expose: true, method: "POST", path: "/salesforce/connections/:connection_id/setup-webhooks" },
  wrapAsync(async (req: SetupWebhooksRequest): Promise<{
    success: boolean;
    message: string;
    webhook_url: string;
    configured_objects: string[];
  }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);

    const connection = await getActiveConnection(req.connection_id);
    const client = new SalesforceClient(connection);

    // Default webhook URL
    const webhookUrl = req.webhook_url || `${process.env.APP_URL || 'https://your-app.com'}/api/salesforce/webhooks/${req.connection_id}`;
    const objectTypes = req.object_types || ['Lead', 'Contact'];

    try {
      // In a real implementation, this would set up Salesforce Platform Events or Outbound Messages
      // For now, we'll just return the configuration
      
      return {
        success: true,
        message: 'Webhook configuration ready. Please configure Salesforce Platform Events or Outbound Messages manually.',
        webhook_url: webhookUrl,
        configured_objects: objectTypes
      };
    } catch (error) {
      return {
        success: false,
        message: `Webhook setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        webhook_url: webhookUrl,
        configured_objects: []
      };
    }
  })
);

export interface SyncProspectRequest {
  connection_id: number;
  prospect_id: number;
  direction?: 'to_salesforce' | 'from_salesforce' | 'bidirectional';
  object_type?: 'Lead' | 'Contact';
}

// Sync specific prospect manually
export const syncProspect = api<SyncProspectRequest, {
  success: boolean;
  message: string;
  sync_details?: any;
}>(
  { expose: true, method: "POST", path: "/salesforce/sync/prospect" },
  wrapAsync(async (req: SyncProspectRequest): Promise<{
    success: boolean;
    message: string;
    sync_details?: any;
  }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    validateField(req.prospect_id, "prospect_id", [Rules.positive(), Rules.integer()]);

    const direction = req.direction || 'bidirectional';
    const objectType = req.object_type || 'Lead';

    try {
      const connection = await getActiveConnection(req.connection_id);
      const client = new SalesforceClient(connection);

      // Get prospect
      const prospect = await executeQuery(
        () => prospectDB.rawQueryRow<Prospect>(
          `SELECT * FROM prospects WHERE id = $1`,
          req.prospect_id
        ),
        "get prospect for manual sync"
      );

      if (!prospect) {
        return {
          success: false,
          message: "Prospect not found"
        };
      }

      // Get field mappings
      const fieldMappings = await getFieldMappings(connection.id, objectType);

      // Check if mapping exists
      const existingMapping = await getExistingSyncMapping(
        connection.id, 'prospects', prospect.id, objectType
      );

      let syncDetails: any = {};

      if (direction === 'to_salesforce' || direction === 'bidirectional') {
        // Sync to Salesforce
        if (objectType === 'Lead') {
          const leadData = await transformProspectToLeadAdvanced(prospect, fieldMappings, connection.id);
          
          if (existingMapping) {
            await client.update(objectType, existingMapping.salesforce_record_id, leadData);
            await updateSyncMapping(existingMapping.id, prospect.updated_at);
            syncDetails.action = 'updated';
            syncDetails.salesforce_id = existingMapping.salesforce_record_id;
          } else {
            const result = await client.create(objectType, leadData);
            await createSyncMapping(
              connection.id,
              'prospects',
              prospect.id,
              objectType,
              result.id,
              prospect.updated_at
            );
            syncDetails.action = 'created';
            syncDetails.salesforce_id = result.id;
          }
        }
      }

      return {
        success: true,
        message: `Prospect ${prospect.id} synced successfully`,
        sync_details: syncDetails
      };

    } catch (error) {
      return {
        success: false,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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
      prospectsQuery += ` WHERE sm.id IS NULL OR (p.updated_at > sm.last_synced_at AND sm.sync_status != 'conflict')`;
    }
    
    const prospects = await executeQuery(
      () => prospectDB.rawQueryAll<Prospect>(prospectsQuery, connection.id),
      "get prospects for sync"
    );

    await updateSyncLog(syncLog.id, { records_processed: prospects.length });

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ prospectId: number; error: string }> = [];

    // Process in batches to avoid overwhelming Salesforce API
    const batchSize = 10;
    for (let i = 0; i < prospects.length; i += batchSize) {
      const batch = prospects.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (prospect) => {
          try {
            // Transform prospect data to Salesforce Lead format
            const leadData = await transformProspectToLeadAdvanced(prospect, fieldMappings, connection.id);
            
            // Validate required fields
            if (!leadData.LastName || !leadData.Company) {
              throw new Error('Missing required fields: LastName and Company are required for Salesforce Leads');
            }
            
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
            errors.push({
              prospectId: prospect.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            failureCount++;
          }
        })
      );

      // Update progress
      await updateSyncLog(syncLog.id, {
        records_success: successCount,
        records_failed: failureCount
      });

      // Add small delay between batches
      if (i + batchSize < prospects.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    await updateSyncLog(syncLog.id, {
      records_success: successCount,
      records_failed: failureCount,
      status: failureCount === 0 ? 'completed' : 'completed_with_errors',
      error_details: errors.length > 0 ? { errors } : null,
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
    const baseFields = ['Id', 'FirstName', 'LastName', 'Name', 'Email', 'Company', 'Title', 'Phone', 'Status', 'LastModifiedDate', 'CreatedDate'];
    const allFields = [...new Set([...baseFields, ...salesforceFields])];
    
    let soql = `SELECT ${allFields.join(', ')} FROM Lead WHERE IsDeleted = false`;
    
    if (!forceSync && connection.last_sync_at) {
      const lastSyncDate = connection.last_sync_at.toISOString();
      soql += ` AND LastModifiedDate > ${lastSyncDate}`;
    }
    
    soql += ` ORDER BY LastModifiedDate DESC LIMIT 2000`; // Limit to avoid timeouts

    const leads = await client.queryAll(soql);
    
    await updateSyncLog(syncLog.id, { records_processed: leads.length });

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ leadId: string; error: string }> = [];

    // Process in batches
    const batchSize = 20;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (lead) => {
          try {
            // Transform Salesforce Lead to prospect format
            const prospectData = await transformLeadToProspectAdvanced(lead, fieldMappings, connection.id);
            
            // Check if mapping exists
            const existingMapping = await getExistingSyncMapping(
              connection.id, 'prospects', null, 'Lead', lead.Id
            );

            if (existingMapping) {
              // Check for conflicts before updating
              const localProspect = await executeQuery(
                () => prospectDB.rawQueryRow<Prospect>(
                  `SELECT * FROM prospects WHERE id = $1`,
                  existingMapping.local_record_id
                ),
                "get local prospect for conflict check"
              );

              if (localProspect && localProspect.updated_at > existingMapping.last_synced_at) {
                // Potential conflict - mark for manual resolution
                await executeQuery(
                  () => salesforceDB.rawQueryRow(
                    `UPDATE salesforce_sync_mappings 
                     SET sync_status = 'conflict', salesforce_updated_at = $1
                     WHERE id = $2`,
                    new Date(lead.LastModifiedDate), existingMapping.id
                  ),
                  "mark mapping as conflict"
                );
              } else {
                // Safe to update
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
              }
            } else {
              // Create new prospect only if email doesn't already exist
              const existingProspectByEmail = await executeQuery(
                () => prospectDB.rawQueryRow<Prospect>(
                  `SELECT * FROM prospects WHERE email = $1 LIMIT 1`,
                  prospectData.email
                ),
                "check existing prospect by email"
              );

              if (existingProspectByEmail) {
                // Create mapping to existing prospect
                await createSyncMapping(
                  connection.id,
                  'prospects',
                  existingProspectByEmail.id,
                  'Lead',
                  lead.Id,
                  null,
                  new Date(lead.LastModifiedDate)
                );
              } else {
                // Create new prospect
                const newProspect = await executeQuery(
                  () => prospectDB.rawQueryRow<Prospect>(
                    `INSERT INTO prospects 
                     (agent_id, name, email, company, position, classification, status, notes)
                     VALUES (1, $1, $2, $3, $4, 'imported', $5, 'Imported from Salesforce')
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
            }
            
            successCount++;
          } catch (error) {
            console.error(`Failed to sync lead ${lead.Id}:`, error);
            errors.push({
              leadId: lead.Id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            failureCount++;
          }
        })
      );

      // Update progress
      await updateSyncLog(syncLog.id, {
        records_success: successCount,
        records_failed: failureCount
      });

      // Small delay between batches
      if (i + batchSize < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
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
      status: failureCount === 0 ? 'completed' : 'completed_with_errors',
      error_details: errors.length > 0 ? { errors } : null,
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

// Sync prospects to Salesforce contacts
async function syncProspectsToContacts(
  client: SalesforceClient,
  connection: SalesforceConnection,
  syncLog: SalesforceSyncLog,
  forceSync: boolean = false
): Promise<void> {
  try {
    // Get field mappings for contacts
    const fieldMappings = await getFieldMappings(connection.id, 'Contact');
    
    // Get prospects that should be synced as contacts (e.g., qualified prospects)
    let prospectsQuery = `
      SELECT p.* FROM prospects p
      LEFT JOIN salesforce_sync_mappings sm ON sm.local_record_id = p.id 
        AND sm.local_table = 'prospects' 
        AND sm.salesforce_object = 'Contact'
        AND sm.connection_id = $1
      WHERE p.classification IN ('qualified', 'customer')
    `;
    
    if (!forceSync) {
      prospectsQuery += ` AND (sm.id IS NULL OR (p.updated_at > sm.last_synced_at AND sm.sync_status != 'conflict'))`;
    }
    
    const prospects = await executeQuery(
      () => prospectDB.rawQueryAll<Prospect>(prospectsQuery, connection.id),
      "get prospects for contact sync"
    );

    let successCount = 0;
    let failureCount = 0;

    for (const prospect of prospects) {
      try {
        // Transform prospect data to Salesforce Contact format
        const contactData = await transformProspectToContactAdvanced(prospect, fieldMappings, connection.id);
        
        // Check if mapping exists
        const existingMapping = await getExistingSyncMapping(
          connection.id, 'prospects', prospect.id, 'Contact'
        );

        if (existingMapping) {
          // Update existing contact
          await client.update('Contact', existingMapping.salesforce_record_id, contactData);
          await updateSyncMapping(existingMapping.id, prospect.updated_at);
        } else {
          // Create new contact
          const result = await client.create('Contact', contactData);
          await createSyncMapping(
            connection.id,
            'prospects',
            prospect.id,
            'Contact',
            result.id,
            prospect.updated_at
          );
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to sync prospect ${prospect.id} as contact:`, error);
        failureCount++;
      }
    }

    await updateSyncLog(syncLog.id, {
      records_success: successCount,
      records_failed: failureCount
    });

  } catch (error) {
    console.error('Contact sync failed:', error);
    throw error;
  }
}

async function transformLeadToProspectAdvanced(lead: any, fieldMappings: SalesforceFieldMapping[], connectionId: number): Promise<any> {
  // Construct full name from FirstName and LastName
  const name = [lead.FirstName, lead.LastName].filter(Boolean).join(' ') || lead.Name || 'Unknown';
  
  const prospectData: any = {
    name: name.trim(),
    email: lead.Email,
    company: lead.Company,
    position: lead.Title,
    status: mapLeadStatusToProspectStatus(lead.Status)
  };

  // Apply custom field mappings in reverse
  for (const mapping of fieldMappings) {
    const salesforceValue = lead[mapping.salesforce_field];
    if (salesforceValue !== undefined && salesforceValue !== null) {
      try {
        prospectData[mapping.local_field] = applyReverseTransformation(salesforceValue, mapping.transformation_rule);
      } catch (error) {
        console.warn(`Failed to apply reverse transformation for field ${mapping.salesforce_field}:`, error);
      }
    }
  }

  return prospectData;
}

async function transformProspectToContactAdvanced(prospect: Prospect, fieldMappings: SalesforceFieldMapping[], connectionId: number): Promise<any> {
  // Parse name into first and last name
  const nameParts = prospect.name ? prospect.name.split(' ') : ['', ''];
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
  const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : 'Unknown';
  
  const contactData: any = {
    FirstName: firstName || null,
    LastName: lastName || 'Unknown',
    Email: prospect.email,
    Title: prospect.position || null,
    LeadSource: 'CRM Import'
  };

  // Apply custom field mappings
  for (const mapping of fieldMappings) {
    const localValue = (prospect as any)[mapping.local_field];
    if (localValue !== undefined && localValue !== null) {
      try {
        contactData[mapping.salesforce_field] = applyTransformation(localValue, mapping.transformation_rule);
      } catch (error) {
        console.warn(`Failed to apply transformation for field ${mapping.local_field}:`, error);
      }
    }
  }

  // Remove null/undefined values
  Object.keys(contactData).forEach(key => {
    if (contactData[key] === null || contactData[key] === undefined) {
      delete contactData[key];
    }
  });

  return contactData;
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
      console.log(`Processing sync for object type: ${objectType}`);
      
      if (objectType === 'Lead') {
        if (direction === 'to_salesforce' || direction === 'bidirectional') {
          console.log('Syncing prospects to Salesforce leads...');
          await syncProspectsToSalesforce(client, connection, syncLog, forceSync);
        }
        
        if (direction === 'from_salesforce' || direction === 'bidirectional') {
          console.log('Syncing Salesforce leads to prospects...');
          await syncSalesforceToProspects(client, connection, syncLog, forceSync);
        }
      } else if (objectType === 'Contact') {
        if (direction === 'to_salesforce' || direction === 'bidirectional') {
          console.log('Syncing qualified prospects to Salesforce contacts...');
          await syncProspectsToContacts(client, connection, syncLog, forceSync);
        }
        
        if (direction === 'from_salesforce' || direction === 'bidirectional') {
          console.log('Syncing Salesforce contacts to prospects...');
          await syncContactsToProspects(client, connection, syncLog, forceSync);
        }
      }
      // Add support for other object types (Account, Opportunity) here
      else {
        console.log(`Object type ${objectType} sync not yet implemented`);
      }
    }

    // Mark sync as completed if we reach here
    const currentLog = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceSyncLog>(
        `SELECT * FROM salesforce_sync_logs WHERE id = $1`,
        syncLog.id
      ),
      "get current sync log"
    );

    if (currentLog && currentLog.status === 'running') {
      await updateSyncLog(syncLog.id, {
        status: 'completed',
        completed_at: new Date()
      });
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

// Sync Salesforce contacts to prospects
async function syncContactsToProspects(
  client: SalesforceClient,
  connection: SalesforceConnection,
  syncLog: SalesforceSyncLog,
  forceSync: boolean = false
): Promise<void> {
  try {
    // Get field mappings for contacts
    const fieldMappings = await getFieldMappings(connection.id, 'Contact');
    
    // Build SOQL query for contacts
    const salesforceFields = fieldMappings.map(fm => fm.salesforce_field);
    const baseFields = ['Id', 'FirstName', 'LastName', 'Name', 'Email', 'Title', 'Phone', 'LastModifiedDate', 'CreatedDate'];
    const allFields = [...new Set([...baseFields, ...salesforceFields])];
    
    let soql = `SELECT ${allFields.join(', ')} FROM Contact WHERE IsDeleted = false`;
    
    if (!forceSync && connection.last_sync_at) {
      const lastSyncDate = connection.last_sync_at.toISOString();
      soql += ` AND LastModifiedDate > ${lastSyncDate}`;
    }
    
    soql += ` ORDER BY LastModifiedDate DESC LIMIT 1000`;

    const contacts = await client.queryAll(soql);
    
    let successCount = 0;
    let failureCount = 0;

    for (const contact of contacts) {
      try {
        // Transform Salesforce Contact to prospect format
        const prospectData = await transformContactToProspectAdvanced(contact, fieldMappings, connection.id);
        
        // Check if mapping exists
        const existingMapping = await getExistingSyncMapping(
          connection.id, 'prospects', null, 'Contact', contact.Id
        );

        if (existingMapping) {
          // Update existing prospect
          await executeQuery(
            () => prospectDB.rawQueryRow(
              `UPDATE prospects SET 
               name = $1, email = $2, position = $3, classification = 'qualified', updated_at = NOW()
               WHERE id = $4`,
              prospectData.name, prospectData.email, prospectData.position, existingMapping.local_record_id
            ),
            "update prospect from salesforce contact"
          );
          
          await updateSyncMapping(existingMapping.id, null, new Date(contact.LastModifiedDate));
        } else {
          // Check if prospect with same email exists
          const existingProspectByEmail = await executeQuery(
            () => prospectDB.rawQueryRow<Prospect>(
              `SELECT * FROM prospects WHERE email = $1 LIMIT 1`,
              prospectData.email
            ),
            "check existing prospect by email for contact"
          );

          if (existingProspectByEmail) {
            // Update existing prospect and create mapping
            await executeQuery(
              () => prospectDB.rawQueryRow(
                `UPDATE prospects SET 
                 name = $1, position = $2, classification = 'qualified', updated_at = NOW()
                 WHERE id = $3`,
                prospectData.name, prospectData.position, existingProspectByEmail.id
              ),
              "update existing prospect for contact"
            );

            await createSyncMapping(
              connection.id,
              'prospects',
              existingProspectByEmail.id,
              'Contact',
              contact.Id,
              null,
              new Date(contact.LastModifiedDate)
            );
          } else {
            // Create new prospect
            const newProspect = await executeQuery(
              () => prospectDB.rawQueryRow<Prospect>(
                `INSERT INTO prospects 
                 (agent_id, name, email, position, classification, status, notes)
                 VALUES (1, $1, $2, $3, 'qualified', 'new', 'Imported from Salesforce Contact')
                 RETURNING *`,
                prospectData.name, prospectData.email, prospectData.position
              ),
              "create prospect from salesforce contact"
            );

            if (newProspect) {
              await createSyncMapping(
                connection.id,
                'prospects',
                newProspect.id,
                'Contact',
                contact.Id,
                null,
                new Date(contact.LastModifiedDate)
              );
            }
          }
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to sync contact ${contact.Id}:`, error);
        failureCount++;
      }
    }

    await updateSyncLog(syncLog.id, {
      records_success: successCount,
      records_failed: failureCount
    });

  } catch (error) {
    console.error('Contact to prospect sync failed:', error);
    throw error;
  }
}

async function transformContactToProspectAdvanced(contact: any, fieldMappings: SalesforceFieldMapping[], connectionId: number): Promise<any> {
  // Construct full name from FirstName and LastName
  const name = [contact.FirstName, contact.LastName].filter(Boolean).join(' ') || contact.Name || 'Unknown';
  
  const prospectData: any = {
    name: name.trim(),
    email: contact.Email,
    position: contact.Title
  };

  // Apply custom field mappings in reverse
  for (const mapping of fieldMappings) {
    const salesforceValue = contact[mapping.salesforce_field];
    if (salesforceValue !== undefined && salesforceValue !== null) {
      try {
        prospectData[mapping.local_field] = applyReverseTransformation(salesforceValue, mapping.transformation_rule);
      } catch (error) {
        console.warn(`Failed to apply reverse transformation for field ${mapping.salesforce_field}:`, error);
      }
    }
  }

  return prospectData;
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

async function transformProspectToLeadAdvanced(prospect: Prospect, fieldMappings: SalesforceFieldMapping[], connectionId: number): Promise<any> {
  // Parse name into first and last name
  const nameParts = prospect.name ? prospect.name.split(' ') : ['', ''];
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
  const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : 'Unknown';
  
  const leadData: any = {
    FirstName: firstName || null,
    LastName: lastName || 'Unknown',
    Email: prospect.email,
    Company: prospect.company || 'Unknown Company',
    Title: prospect.position || null,
    Status: mapProspectStatusToLeadStatus(prospect.status),
    LeadSource: 'CRM Import'
  };

  // Apply custom field mappings
  for (const mapping of fieldMappings) {
    const localValue = (prospect as any)[mapping.local_field];
    if (localValue !== undefined && localValue !== null) {
      try {
        leadData[mapping.salesforce_field] = applyTransformation(localValue, mapping.transformation_rule);
      } catch (error) {
        console.warn(`Failed to apply transformation for field ${mapping.local_field}:`, error);
      }
    }
  }

  // Remove null/undefined values to avoid Salesforce API errors
  Object.keys(leadData).forEach(key => {
    if (leadData[key] === null || leadData[key] === undefined) {
      delete leadData[key];
    }
  });

  return leadData;
}

function transformProspectToLead(prospect: Prospect, fieldMappings: SalesforceFieldMapping[]): any {
  // Legacy function for backward compatibility
  const nameParts = prospect.name ? prospect.name.split(' ') : ['', ''];
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
  const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : 'Unknown';
  
  const leadData: any = {
    FirstName: firstName || null,
    LastName: lastName,
    Email: prospect.email,
    Company: prospect.company || 'Unknown',
    Title: prospect.position,
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
  
  try {
    switch (rule.type) {
      case 'date_parse':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date value: ${value}`);
          return null;
        }
        return rule.format === 'datetime' ? date.toISOString() : date.toISOString().split('T')[0];
      case 'numeric_parse':
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      case 'string_truncate':
        const maxLength = rule.maxLength || 255;
        return String(value).substring(0, maxLength);
      case 'boolean_convert':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return ['true', 'yes', '1', 'on'].includes(value.toLowerCase());
        }
        return Boolean(value);
      case 'picklist_map':
        const mappings = rule.mappings || {};
        return mappings[value] || value;
      default:
        return value;
    }
  } catch (error) {
    console.error(`Transformation failed for rule ${rule.type}:`, error);
    return value; // Return original value if transformation fails
  }
}

function applyReverseTransformation(value: any, rule: any): any {
  if (!rule) return value;
  
  try {
    switch (rule.type) {
      case 'date_parse':
        return new Date(value);
      case 'numeric_parse':
        return value.toString();
      case 'string_truncate':
        return value; // No reverse needed
      case 'boolean_convert':
        return Boolean(value);
      case 'picklist_map':
        const mappings = rule.mappings || {};
        // Reverse lookup
        const reverseMapping = Object.fromEntries(
          Object.entries(mappings).map(([k, v]) => [v, k])
        );
        return reverseMapping[value] || value;
      default:
        return value;
    }
  } catch (error) {
    console.error(`Reverse transformation failed for rule ${rule.type}:`, error);
    return value;
  }
}