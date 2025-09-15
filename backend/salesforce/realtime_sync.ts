import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { salesforceDB } from "./db";
import { prospectDB } from "../prospect/db";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import { SalesforceClient } from "./client";
import type { 
  SalesforceConnection,
  SalesforceSyncMapping,
  SyncMappingStatus
} from "./types";
import type { Prospect } from "../agent/types";

// Real-time sync trigger for prospect updates
export const triggerProspectSync = api(
  { expose: false, method: "POST", path: "/salesforce/triggers/prospect" },
  wrapAsync(async (req: { prospect_id: number; action: 'create' | 'update' | 'delete' }): Promise<{ success: boolean }> => {
    validateField(req.prospect_id, "prospect_id", [Rules.positive(), Rules.integer()]);
    validateField(req.action, "action", [Rules.oneOf(['create', 'update', 'delete'])]);

    // Get all active Salesforce connections with real-time sync enabled
    const connections = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceConnection>(
        `SELECT * FROM salesforce_connections WHERE is_active = true`
      ),
      "get active salesforce connections"
    );

    // Process sync for each connection asynchronously
    const syncPromises = connections.map(connection => 
      processProspectSync(connection, req.prospect_id, req.action)
        .catch(error => {
          console.error(`Real-time sync failed for connection ${connection.id}:`, error);
          // Log error but don't fail the entire operation
          return { error: error.message, connectionId: connection.id };
        })
    );

    await Promise.allSettled(syncPromises);

    return { success: true };
  })
);

export interface SalesforceWebhookRequest {
  connection_id: number;
  object_type: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  timestamp: string;
}

// Enhanced real-time sync with webhook support
export const handleSalesforceWebhook = api<SalesforceWebhookRequest, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/salesforce/webhooks/:connection_id" },
  wrapAsync(async (req: SalesforceWebhookRequest): Promise<{ success: boolean; message: string }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    validateField(req.object_type, "object_type", [Rules.minLength(1)]);
    validateField(req.record_id, "record_id", [Rules.minLength(1)]);
    validateField(req.action, "action", [Rules.oneOf(['create', 'update', 'delete'])]);

    try {
      const connection = await executeQuery(
        () => salesforceDB.rawQueryRow<SalesforceConnection>(
          `SELECT * FROM salesforce_connections WHERE id = $1 AND is_active = true`,
          req.connection_id
        ),
        "get connection for webhook"
      );

      if (!connection) {
        return {
          success: false,
          message: "Connection not found or inactive"
        };
      }

      // Process the webhook event
      await processSalesforceWebhookEvent(
        connection,
        req.object_type,
        req.record_id,
        req.action,
        new Date(req.timestamp)
      );

      return {
        success: true,
        message: "Webhook processed successfully"
      };
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return {
        success: false,
        message: `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  })
);

export interface BatchResolveConflictsRequest {
  resolutions: Array<{
    mapping_id: number;
    resolution: 'local_wins' | 'salesforce_wins' | 'merge';
    merge_fields?: Record<string, any>;
  }>;
}

// Batch conflict resolution
export const batchResolveConflicts = api<BatchResolveConflictsRequest, {
  successful: number;
  failed: number;
  errors: Array<{ mapping_id: number; error: string }>;
}>(
  { expose: true, method: "POST", path: "/salesforce/conflicts/batch-resolve" },
  wrapAsync(async (req: BatchResolveConflictsRequest): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ mapping_id: number; error: string }>;
  }> => {
    validateField(req.resolutions, "resolutions", [Rules.minLength(1)]);

    let successful = 0;
    let failed = 0;
    const errors: Array<{ mapping_id: number; error: string }> = [];

    for (const resolution of req.resolutions) {
      try {
        const result = await resolveConflict({
          mapping_id: resolution.mapping_id,
          resolution: resolution.resolution,
          merge_fields: resolution.merge_fields
        });

        if (result.success) {
          successful++;
        } else {
          failed++;
          errors.push({ mapping_id: resolution.mapping_id, error: result.message });
        }
      } catch (error) {
        failed++;
        errors.push({
          mapping_id: resolution.mapping_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { successful, failed, errors };
  })
);

// Conflict resolution endpoint
export const resolveConflict = api(
  { expose: true, method: "POST", path: "/salesforce/conflicts/resolve" },
  wrapAsync(async (req: { 
    mapping_id: number; 
    resolution: 'local_wins' | 'salesforce_wins' | 'merge';
    merge_fields?: Record<string, any>;
  }): Promise<{ success: boolean; message: string }> => {
    validateField(req.mapping_id, "mapping_id", [Rules.positive(), Rules.integer()]);
    validateField(req.resolution, "resolution", [Rules.oneOf(['local_wins', 'salesforce_wins', 'merge'])]);

    const mapping = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceSyncMapping>(
        `SELECT * FROM salesforce_sync_mappings WHERE id = $1 AND sync_status = 'conflict'`,
        req.mapping_id
      ),
      "get conflict mapping"
    );

    if (!mapping) {
      throw new Error("Conflict mapping not found");
    }

    const connection = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceConnection>(
        `SELECT * FROM salesforce_connections WHERE id = $1 AND is_active = true`,
        mapping.connection_id
      ),
      "get salesforce connection"
    );

    if (!connection) {
      throw new Error("Active connection not found");
    }

    const client = new SalesforceClient(connection);

    try {
      switch (req.resolution) {
        case 'local_wins':
          await resolveWithLocalData(client, mapping);
          break;
        case 'salesforce_wins':
          await resolveWithSalesforceData(client, mapping);
          break;
        case 'merge':
          if (!req.merge_fields) {
            throw new Error("Merge fields required for merge resolution");
          }
          await resolveWithMergedData(client, mapping, req.merge_fields);
          break;
      }

      // Update mapping status
      await executeQuery(
        () => salesforceDB.rawQueryRow(
          `UPDATE salesforce_sync_mappings 
           SET sync_status = 'synced', last_synced_at = NOW()
           WHERE id = $1`,
          mapping.id
        ),
        "update mapping after conflict resolution"
      );

      return { 
        success: true, 
        message: `Conflict resolved using ${req.resolution} strategy` 
      };

    } catch (error) {
      return { 
        success: false, 
        message: `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  })
);

// Get conflicts for review
export const getConflicts = api(
  { expose: true, method: "GET", path: "/salesforce/conflicts" },
  wrapAsync(async (): Promise<{ conflicts: any[] }> => {
    const conflicts = await executeQuery(
      () => salesforceDB.rawQueryAll(
        `SELECT 
           sm.*,
           sc.org_name,
           p.name as prospect_name,
           p.email as prospect_email,
           p.updated_at as local_updated_at
         FROM salesforce_sync_mappings sm
         JOIN salesforce_connections sc ON sm.connection_id = sc.id
         LEFT JOIN prospects p ON sm.local_record_id = p.id AND sm.local_table = 'prospects'
         WHERE sm.sync_status = 'conflict'
         ORDER BY sm.last_synced_at DESC`
      ),
      "get conflicts"
    );

    // Enrich with Salesforce data
    const enrichedConflicts = [];
    for (const conflict of conflicts) {
      try {
        const connection = await executeQuery(
          () => salesforceDB.rawQueryRow<SalesforceConnection>(
            `SELECT * FROM salesforce_connections WHERE id = $1`,
            conflict.connection_id
          ),
          "get connection for conflict"
        );

        if (connection && connection.is_active) {
          const client = new SalesforceClient(connection);
          const salesforceRecord = await client.getRecord(
            conflict.salesforce_object,
            conflict.salesforce_record_id
          );

          enrichedConflicts.push({
            ...conflict,
            salesforce_data: salesforceRecord
          });
        } else {
          enrichedConflicts.push(conflict);
        }
      } catch (error) {
        console.error(`Failed to enrich conflict ${conflict.id}:`, error);
        enrichedConflicts.push(conflict);
      }
    }

    return { conflicts: enrichedConflicts };
  })
);

// Cron job endpoint for conflict detection
export const detectAndResolveConflictsEndpoint = api(
  { expose: false, method: "POST", path: "/salesforce/cron/detect-conflicts" },
  wrapAsync(async (): Promise<{ success: boolean }> => {
    await detectAndResolveConflicts();
    return { success: true };
  })
);

// Cron job for periodic conflict detection and auto-resolution
const conflictDetectionCron = new CronJob("conflict-detection", {
  title: "Salesforce Conflict Detection",
  endpoint: detectAndResolveConflictsEndpoint,
  every: "5m", // Run every 5 minutes for better real-time experience
});

export const cleanupOldSyncLogsEndpoint = api(
  { expose: false, method: "POST", path: "/salesforce/cron/cleanup-logs" },
  wrapAsync(async (): Promise<{ success: boolean; deleted_count: number }> => {
    // Delete sync logs older than 30 days
    const result = await executeQuery(
      () => salesforceDB.rawQueryRow<{ count: number }>(
        `DELETE FROM salesforce_sync_logs 
         WHERE started_at < NOW() - INTERVAL '30 days'
         RETURNING COUNT(*) as count`,
      ),
      "cleanup old sync logs"
    );

    const deletedCount = result?.count || 0;
    console.log(`Cleaned up ${deletedCount} old sync logs`);

    return { success: true, deleted_count: deletedCount };
  })
);

// Cron job for cleaning up old sync logs
const cleanupSyncLogsCron = new CronJob("cleanup-sync-logs", {
  title: "Cleanup Old Sync Logs",
  endpoint: cleanupOldSyncLogsEndpoint,
  every: "1h", // Run every hour
});

async function detectAndResolveConflicts(): Promise<void> {
  console.log("Starting conflict detection...");

  try {
    // Get all active connections
    const connections = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceConnection>(
        `SELECT * FROM salesforce_connections WHERE is_active = true`
      ),
      "get active connections for conflict detection"
    );

    // Process connections in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < connections.length; i += concurrency) {
      const batch = connections.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(connection => detectConflictsForConnection(connection))
      );
    }

    // Auto-resolve simple conflicts
    await autoResolveSimpleConflicts();

    console.log("Conflict detection completed");
  } catch (error) {
    console.error("Conflict detection failed:", error);
  }
}

async function detectConflictsForConnection(connection: SalesforceConnection): Promise<void> {
  const client = new SalesforceClient(connection);

  try {
    // Test connection first
    const isConnected = await client.testConnection();
    if (!isConnected) {
      console.warn(`Skipping conflict detection for connection ${connection.id} - connection test failed`);
      return;
    }

    // Get all synced mappings that might have conflicts
    const syncedMappings = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceSyncMapping>(
        `SELECT * FROM salesforce_sync_mappings 
         WHERE connection_id = $1 AND sync_status IN ('synced', 'pending')
         AND last_synced_at > NOW() - INTERVAL '24 hours'
         ORDER BY last_synced_at DESC
         LIMIT 100`,
        connection.id
      ),
      "get recent sync mappings"
    );

    console.log(`Checking ${syncedMappings.length} mappings for conflicts on connection ${connection.id}`);

    // Process mappings in batches
    const batchSize = 5;
    for (let i = 0; i < syncedMappings.length; i += batchSize) {
      const batch = syncedMappings.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (mapping) => {
          try {
            await checkMappingForConflict(client, mapping);
          } catch (error) {
            console.error(`Conflict check failed for mapping ${mapping.id}:`, error);
            await markAsSyncError(mapping.id, error);
          }
        })
      );

      // Small delay between batches to avoid API limits
      if (i + batchSize < syncedMappings.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error(`Conflict detection failed for connection ${connection.id}:`, error);
  }
}

async function checkMappingForConflict(client: SalesforceClient, mapping: SalesforceSyncMapping): Promise<void> {
  // Check for conflicts by comparing timestamps
  if (mapping.local_table === 'prospects') {
    const localProspect = await executeQuery(
      () => prospectDB.rawQueryRow<Prospect>(
        `SELECT * FROM prospects WHERE id = $1`,
        mapping.local_record_id
      ),
      "get local prospect"
    );

    if (!localProspect) {
      // Local record was deleted, mark mapping for cleanup
      await executeQuery(
        () => salesforceDB.rawQueryRow(
          `UPDATE salesforce_sync_mappings 
           SET sync_status = 'local_deleted', salesforce_updated_at = NOW()
           WHERE id = $1`,
          mapping.id
        ),
        "mark mapping as local deleted"
      );
      return;
    }

    // Get Salesforce record
    let salesforceRecord;
    try {
      salesforceRecord = await client.getRecord(
        mapping.salesforce_object,
        mapping.salesforce_record_id,
        ['LastModifiedDate', 'IsDeleted']
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        // Salesforce record was deleted
        await executeQuery(
          () => salesforceDB.rawQueryRow(
            `UPDATE salesforce_sync_mappings 
             SET sync_status = 'salesforce_deleted', local_updated_at = NOW()
             WHERE id = $1`,
            mapping.id
          ),
          "mark mapping as salesforce deleted"
        );
        return;
      }
      throw error;
    }

    const localUpdated = localProspect.updated_at;
    const salesforceUpdated = new Date(salesforceRecord.LastModifiedDate);
    const lastSynced = mapping.last_synced_at || new Date(0);

    // Define conflict threshold (5 minutes)
    const conflictThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Detect conflict: both sides updated since last sync with significant time difference
    if (localUpdated > lastSynced && salesforceUpdated > lastSynced) {
      const timeDiff = Math.abs(localUpdated.getTime() - salesforceUpdated.getTime());
      
      if (timeDiff < conflictThreshold) {
        // Very close timing, likely same change - use newest timestamp
        if (salesforceUpdated > localUpdated) {
          await syncSalesforceToLocal(client, mapping, salesforceRecord);
        } else {
          await syncLocalToSalesforce(client, mapping, localProspect);
        }
      } else {
        // Significant time difference - mark as conflict
        await markAsConflict(mapping.id, localUpdated, salesforceUpdated);
      }
    } else if (localUpdated > lastSynced) {
      // Local is newer, sync to Salesforce
      await syncLocalToSalesforce(client, mapping, localProspect);
    } else if (salesforceUpdated > lastSynced) {
      // Salesforce is newer, sync to local
      await syncSalesforceToLocal(client, mapping, salesforceRecord);
    }
  }
}

async function processProspectSync(
  connection: SalesforceConnection, 
  prospectId: number, 
  action: 'create' | 'update' | 'delete'
): Promise<void> {
  const client = new SalesforceClient(connection);

  try {
    // Get sync mapping
    const mapping = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceSyncMapping>(
        `SELECT * FROM salesforce_sync_mappings 
         WHERE connection_id = $1 AND local_table = 'prospects' AND local_record_id = $2`,
        connection.id, prospectId
      ),
      "get prospect sync mapping"
    );

    if (action === 'delete') {
      if (mapping) {
        // Delete from Salesforce
        await client.delete(mapping.salesforce_object, mapping.salesforce_record_id);
        // Remove mapping
        await executeQuery(
          () => salesforceDB.rawQueryRow(
            `DELETE FROM salesforce_sync_mappings WHERE id = $1`,
            mapping.id
          ),
          "delete sync mapping"
        );
      }
      return;
    }

    const prospect = await executeQuery(
      () => prospectDB.rawQueryRow<Prospect>(
        `SELECT * FROM prospects WHERE id = $1`,
        prospectId
      ),
      "get prospect for sync"
    );

    if (!prospect) return;

    if (mapping) {
      // Update existing record
      const leadData = await transformProspectToLeadData(prospect, connection.id);
      await client.update(mapping.salesforce_object, mapping.salesforce_record_id, leadData);
      
      await executeQuery(
        () => salesforceDB.rawQueryRow(
          `UPDATE salesforce_sync_mappings 
           SET last_synced_at = NOW(), local_updated_at = $1, sync_status = 'synced'
           WHERE id = $2`,
          prospect.updated_at, mapping.id
        ),
        "update sync mapping"
      );
    } else if (action === 'create') {
      // Create new record
      const leadData = await transformProspectToLeadData(prospect, connection.id);
      const result = await client.create('Lead', leadData);
      
      // Create mapping
      await executeQuery(
        () => salesforceDB.rawQueryRow(
          `INSERT INTO salesforce_sync_mappings 
           (connection_id, local_table, local_record_id, salesforce_object, salesforce_record_id, 
            local_updated_at, sync_status)
           VALUES ($1, 'prospects', $2, 'Lead', $3, $4, 'synced')`,
          connection.id, prospectId, result.id, prospect.updated_at
        ),
        "create sync mapping"
      );
    }
  } catch (error) {
    console.error(`Real-time sync failed for prospect ${prospectId}:`, error);
  }
}

async function resolveWithLocalData(client: SalesforceClient, mapping: SalesforceSyncMapping): Promise<void> {
  if (mapping.local_table === 'prospects') {
    const prospect = await executeQuery(
      () => prospectDB.rawQueryRow<Prospect>(
        `SELECT * FROM prospects WHERE id = $1`,
        mapping.local_record_id
      ),
      "get local prospect for conflict resolution"
    );

    if (prospect) {
      const leadData = await transformProspectToLeadData(prospect, mapping.connection_id);
      await client.update(mapping.salesforce_object, mapping.salesforce_record_id, leadData);
    }
  }
}

async function resolveWithSalesforceData(client: SalesforceClient, mapping: SalesforceSyncMapping): Promise<void> {
  if (mapping.local_table === 'prospects') {
    const salesforceRecord = await client.getRecord(mapping.salesforce_object, mapping.salesforce_record_id);
    const prospectData = await transformLeadToProspectData(salesforceRecord, mapping.connection_id);
    
    await executeQuery(
      () => prospectDB.rawQueryRow(
        `UPDATE prospects SET 
         name = $1, email = $2, company = $3, position = $4, status = $5, updated_at = NOW()
         WHERE id = $6`,
        prospectData.name, prospectData.email, prospectData.company,
        prospectData.position, prospectData.status, mapping.local_record_id
      ),
      "update prospect from salesforce conflict resolution"
    );
  }
}

async function resolveWithMergedData(
  client: SalesforceClient, 
  mapping: SalesforceSyncMapping, 
  mergeFields: Record<string, any>
): Promise<void> {
  // Update both local and Salesforce with merged data
  if (mapping.local_table === 'prospects') {
    // Update local
    const updateFields = Object.keys(mergeFields).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [mapping.local_record_id, ...Object.values(mergeFields)];
    
    await executeQuery(
      () => prospectDB.rawQueryRow(
        `UPDATE prospects SET ${updateFields}, updated_at = NOW() WHERE id = $1`,
        ...values
      ),
      "update prospect with merged data"
    );

    // Update Salesforce
    await client.update(mapping.salesforce_object, mapping.salesforce_record_id, mergeFields);
  }
}

async function markAsConflict(
  mappingId: number, 
  localUpdated: Date, 
  salesforceUpdated: Date
): Promise<void> {
  await executeQuery(
    () => salesforceDB.rawQueryRow(
      `UPDATE salesforce_sync_mappings 
       SET sync_status = 'conflict', local_updated_at = $1, salesforce_updated_at = $2
       WHERE id = $3`,
      localUpdated, salesforceUpdated, mappingId
    ),
    "mark mapping as conflict"
  );
  
  console.log(`Marked mapping ${mappingId} as conflict - Local: ${localUpdated.toISOString()}, Salesforce: ${salesforceUpdated.toISOString()}`);
}

// Auto-resolve simple conflicts based on business rules
async function autoResolveSimpleConflicts(): Promise<void> {
  // Get conflicts that can be auto-resolved
  const autoResolvableConflicts = await executeQuery(
    () => salesforceDB.rawQueryAll<SalesforceSyncMapping>(
      `SELECT * FROM salesforce_sync_mappings 
       WHERE sync_status = 'conflict' 
       AND local_updated_at IS NOT NULL 
       AND salesforce_updated_at IS NOT NULL
       ORDER BY last_synced_at DESC
       LIMIT 50`,
    ),
    "get auto-resolvable conflicts"
  );

  for (const mapping of autoResolvableConflicts) {
    try {
      // Apply business rules for auto-resolution
      const resolution = determineAutoResolution(mapping);
      
      if (resolution) {
        console.log(`Auto-resolving conflict ${mapping.id} with strategy: ${resolution}`);
        
        await resolveConflict({
          mapping_id: mapping.id,
          resolution: resolution
        });
      }
    } catch (error) {
      console.error(`Auto-resolution failed for mapping ${mapping.id}:`, error);
    }
  }
}

function determineAutoResolution(mapping: SalesforceSyncMapping): 'local_wins' | 'salesforce_wins' | null {
  if (!mapping.local_updated_at || !mapping.salesforce_updated_at) {
    return null;
  }

  const timeDiff = mapping.salesforce_updated_at.getTime() - mapping.local_updated_at.getTime();
  const oneHour = 60 * 60 * 1000;

  // If Salesforce was updated more than 1 hour after local, prefer Salesforce
  if (timeDiff > oneHour) {
    return 'salesforce_wins';
  }
  
  // If local was updated more than 1 hour after Salesforce, prefer local
  if (timeDiff < -oneHour) {
    return 'local_wins';
  }

  // For recent conflicts, prefer the most recent change
  return timeDiff > 0 ? 'salesforce_wins' : 'local_wins';
}

// Process Salesforce webhook events
async function processSalesforceWebhookEvent(
  connection: SalesforceConnection,
  objectType: string,
  recordId: string,
  action: 'create' | 'update' | 'delete',
  timestamp: Date
): Promise<void> {
  console.log(`Processing webhook event: ${action} ${objectType} ${recordId}`);

  try {
    // Find existing sync mapping
    const mapping = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceSyncMapping>(
        `SELECT * FROM salesforce_sync_mappings 
         WHERE connection_id = $1 AND salesforce_object = $2 AND salesforce_record_id = $3`,
        connection.id, objectType, recordId
      ),
      "find mapping for webhook event"
    );

    if (action === 'delete') {
      if (mapping) {
        await executeQuery(
          () => salesforceDB.rawQueryRow(
            `UPDATE salesforce_sync_mappings 
             SET sync_status = 'salesforce_deleted', salesforce_updated_at = $1
             WHERE id = $2`,
            timestamp, mapping.id
          ),
          "mark mapping as salesforce deleted via webhook"
        );
      }
      return;
    }

    if (mapping) {
      // Update existing mapping timestamp
      await executeQuery(
        () => salesforceDB.rawQueryRow(
          `UPDATE salesforce_sync_mappings 
           SET salesforce_updated_at = $1, sync_status = 'pending'
           WHERE id = $2`,
          timestamp, mapping.id
        ),
        "update mapping timestamp via webhook"
      );

      // Trigger conflict detection for this specific mapping
      const client = new SalesforceClient(connection);
      await checkMappingForConflict(client, {
        ...mapping,
        salesforce_updated_at: timestamp,
        sync_status: 'pending' as SyncMappingStatus
      });
    } else if (action === 'create') {
      // Handle new record creation via webhook
      // This would involve creating a new local record and mapping
      console.log(`New ${objectType} created in Salesforce: ${recordId}`);
      // Implementation depends on business rules
    }
  } catch (error) {
    console.error(`Webhook event processing failed:`, error);
    throw error;
  }
}

async function markAsSyncError(mappingId: number, error: any): Promise<void> {
  await executeQuery(
    () => salesforceDB.rawQueryRow(
      `UPDATE salesforce_sync_mappings 
       SET sync_status = 'error'
       WHERE id = $1`,
      mappingId
    ),
    "mark mapping as error"
  );
}

async function syncLocalToSalesforce(
  client: SalesforceClient, 
  mapping: SalesforceSyncMapping, 
  prospect: Prospect
): Promise<void> {
  const leadData = await transformProspectToLeadData(prospect, mapping.connection_id);
  await client.update(mapping.salesforce_object, mapping.salesforce_record_id, leadData);
  
  await executeQuery(
    () => salesforceDB.rawQueryRow(
      `UPDATE salesforce_sync_mappings 
       SET last_synced_at = NOW(), local_updated_at = $1, sync_status = 'synced'
       WHERE id = $2`,
      prospect.updated_at, mapping.id
    ),
    "update mapping after local to salesforce sync"
  );
}

async function syncSalesforceToLocal(
  client: SalesforceClient, 
  mapping: SalesforceSyncMapping, 
  salesforceRecord: any
): Promise<void> {
  const prospectData = await transformLeadToProspectData(salesforceRecord, mapping.connection_id);
  
  await executeQuery(
    () => prospectDB.rawQueryRow(
      `UPDATE prospects SET 
       name = $1, email = $2, company = $3, position = $4, status = $5, updated_at = NOW()
       WHERE id = $6`,
      prospectData.name, prospectData.email, prospectData.company,
      prospectData.position, prospectData.status, mapping.local_record_id
    ),
    "update prospect from salesforce sync"
  );

  await executeQuery(
    () => salesforceDB.rawQueryRow(
      `UPDATE salesforce_sync_mappings 
       SET last_synced_at = NOW(), salesforce_updated_at = $1, sync_status = 'synced'
       WHERE id = $2`,
      new Date(salesforceRecord.LastModifiedDate), mapping.id
    ),
    "update mapping after salesforce to local sync"
  );
}

// Helper functions for data transformation (simplified versions)
async function transformProspectToLeadData(prospect: Prospect, connectionId: number): Promise<any> {
  // Get field mappings and apply transformations
  const fieldMappings = await executeQuery(
    () => salesforceDB.rawQueryAll(
      `SELECT * FROM salesforce_field_mappings 
       WHERE connection_id = $1 AND object_type = 'Lead' AND is_active = true`,
      connectionId
    ),
    "get field mappings for prospect transformation"
  );

  const leadData: any = {
    LastName: prospect.name,
    Email: prospect.email,
    Company: prospect.company || 'Unknown',
    Title: prospect.position,
    Status: mapProspectStatusToLeadStatus(prospect.status)
  };

  // Apply custom mappings
  for (const mapping of fieldMappings) {
    const localValue = (prospect as any)[mapping.local_field];
    if (localValue !== undefined && localValue !== null) {
      leadData[mapping.salesforce_field] = localValue;
    }
  }

  return leadData;
}

async function transformLeadToProspectData(lead: any, connectionId: number): Promise<any> {
  return {
    name: lead.Name || `${lead.FirstName || ''} ${lead.LastName || ''}`.trim(),
    email: lead.Email,
    company: lead.Company,
    position: lead.Title,
    status: mapLeadStatusToProspectStatus(lead.Status)
  };
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