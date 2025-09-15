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

    // Get all active Salesforce connections
    const connections = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceConnection>(
        `SELECT * FROM salesforce_connections WHERE is_active = true`
      ),
      "get active salesforce connections"
    );

    // Process sync for each connection
    for (const connection of connections) {
      await processProspectSync(connection, req.prospect_id, req.action);
    }

    return { success: true };
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
  every: "10m", // Run every 10 minutes
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

    for (const connection of connections) {
      await detectConflictsForConnection(connection);
    }

    console.log("Conflict detection completed");
  } catch (error) {
    console.error("Conflict detection failed:", error);
  }
}

async function detectConflictsForConnection(connection: SalesforceConnection): Promise<void> {
  const client = new SalesforceClient(connection);

  // Get all pending sync mappings
  const pendingMappings = await executeQuery(
    () => salesforceDB.rawQueryAll<SalesforceSyncMapping>(
      `SELECT * FROM salesforce_sync_mappings 
       WHERE connection_id = $1 AND sync_status = 'pending'`,
      connection.id
    ),
    "get pending sync mappings"
  );

  for (const mapping of pendingMappings) {
    try {
      // Check for conflicts by comparing timestamps
      if (mapping.local_table === 'prospects') {
        const localProspect = await executeQuery(
          () => prospectDB.rawQueryRow<Prospect>(
            `SELECT * FROM prospects WHERE id = $1`,
            mapping.local_record_id
          ),
          "get local prospect"
        );

        if (!localProspect) continue;

        const salesforceRecord = await client.getRecord(
          mapping.salesforce_object,
          mapping.salesforce_record_id,
          ['LastModifiedDate']
        );

        const localUpdated = localProspect.updated_at;
        const salesforceUpdated = new Date(salesforceRecord.LastModifiedDate);
        const lastSynced = mapping.last_synced_at;

        // Detect conflict: both sides updated since last sync
        if (lastSynced && localUpdated > lastSynced && salesforceUpdated > lastSynced) {
          await markAsConflict(mapping.id, localUpdated, salesforceUpdated);
        } else if (localUpdated > lastSynced) {
          // Local is newer, sync to Salesforce
          await syncLocalToSalesforce(client, mapping, localProspect);
        } else if (salesforceUpdated > lastSynced) {
          // Salesforce is newer, sync to local
          await syncSalesforceToLocal(client, mapping, salesforceRecord);
        }
      }
    } catch (error) {
      console.error(`Conflict detection failed for mapping ${mapping.id}:`, error);
      await markAsSyncError(mapping.id, error);
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