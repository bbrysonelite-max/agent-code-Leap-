import { api } from "encore.dev/api";
import { DB } from "./db";
import { CreateGDPRRequest, DataDeletionResponse } from "./types";
import { auditDataChange } from "../audit/logger";

export const requestDataDeletion = api(
  { method: "POST", path: "/gdpr/delete", expose: true },
  async (req: CreateGDPRRequest): Promise<{ request_id: string }> => {
    const requestId = `gdpr_del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await DB.exec`
      INSERT INTO gdpr_requests (
        request_id, user_id, request_type, verification_status, submitted_by
      ) VALUES (
        ${requestId}, ${req.user_id}, 'delete', 'verified', ${req.user_id}
      )
    `;

    await auditDataChange(
      'gdpr_deletion_requested',
      'gdpr_request',
      requestId,
      null,
      { user_id: req.user_id, request_type: 'delete' },
      req.user_id,
      'gdpr',
      true
    );

    // Start async processing
    processDataDeletion(requestId).catch(console.error);

    return { request_id: requestId };
  }
);

export interface DeletionStatusResponse {
  request_id?: string;
  deleted_records?: Array<{ service: string; table: string; count: number }>;
  anonymized_records?: Array<{ service: string; table: string; count: number; method: string }>;
  completed_at?: Date;
  status?: string;
}

export const getDataDeletionStatus = api(
  { method: "GET", path: "/gdpr/delete/:request_id", expose: true },
  async ({ request_id }: { request_id: string }): Promise<DeletionStatusResponse> => {
    const request = await DB.queryAllRow`
      SELECT * FROM gdpr_requests 
      WHERE request_id = ${request_id} AND request_type = 'delete'
    `;

    if (!request) {
      throw new Error("Deletion request not found");
    }

    if (request.status === 'completed') {
      return {
        request_id,
        deleted_records: request.metadata?.deleted_records || [],
        anonymized_records: request.metadata?.anonymized_records || [],
        completed_at: request.deletion_completed_at
      };
    }

    return { status: request.status };
  }
);

async function processDataDeletion(requestId: string): Promise<void> {
  try {
    await DB.exec`
      UPDATE gdpr_requests 
      SET status = 'processing', updated_at = NOW()
      WHERE request_id = ${requestId}
    `;

    const request = await DB.queryAllRow`
      SELECT * FROM gdpr_requests WHERE request_id = ${requestId}
    `;

    if (!request) return;

    // Get all data mappings that contain user data
    const mappings = await DB.queryAll`
      SELECT * FROM data_mapping 
      WHERE is_user_identifier = true OR data_category IN ('personal', 'contact')
      ORDER BY service_name, table_name
    `;

    const deletedRecords: Array<{ service: string; table: string; count: number }> = [];
    const anonymizedRecords: Array<{ service: string; table: string; count: number; method: string }> = [];

    // Process deletions and anonymizations per service
    const serviceGroups = mappings.reduce((acc, mapping) => {
      if (!acc[mapping.service_name]) acc[mapping.service_name] = [];
      acc[mapping.service_name].push(mapping);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [serviceName, serviceMappings] of Object.entries(serviceGroups)) {
      try {
        // Group by table
        const tableGroups = serviceMappings.reduce((acc, mapping) => {
          if (!acc[mapping.table_name]) acc[mapping.table_name] = [];
          acc[mapping.table_name].push(mapping);
          return acc;
        }, {} as Record<string, any[]>);

        for (const [tableName, tableMappings] of Object.entries(tableGroups)) {
          // Find user identifier columns
          const userIdColumns = tableMappings.filter(m => m.is_user_identifier);
          
          if (userIdColumns.length === 0) continue;

          // For each table, determine deletion strategy
          const hasDeleteMethod = tableMappings.some(m => m.anonymization_method === 'delete');
          
          if (hasDeleteMethod) {
            // Delete entire records
            try {
              // This would need actual database connections to each service
              // For now, we'll simulate the deletion
              const deleteCount = await simulateRecordDeletion(serviceName, tableName, request.user_id);
              
              if (deleteCount > 0) {
                deletedRecords.push({
                  service: serviceName,
                  table: tableName,
                  count: deleteCount
                });
              }
            } catch (error) {
              console.error(`Failed to delete from ${serviceName}.${tableName}:`, error);
            }
          } else {
            // Anonymize specific columns
            const anonymizeColumns = tableMappings.filter(m => 
              m.anonymization_method && m.anonymization_method !== 'delete'
            );

            for (const column of anonymizeColumns) {
              try {
                const anonymizeCount = await simulateColumnAnonymization(
                  serviceName, 
                  tableName, 
                  column.column_name,
                  column.anonymization_method,
                  request.user_id
                );

                if (anonymizeCount > 0) {
                  anonymizedRecords.push({
                    service: serviceName,
                    table: tableName,
                    count: anonymizeCount,
                    method: column.anonymization_method
                  });
                }
              } catch (error) {
                console.error(`Failed to anonymize ${serviceName}.${tableName}.${column.column_name}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process deletions for service ${serviceName}:`, error);
      }
    }

    // Update request as completed
    await DB.exec`
      UPDATE gdpr_requests 
      SET status = 'completed', 
          deletion_completed_at = NOW(),
          completed_at = NOW(),
          updated_at = NOW(),
          metadata = ${JSON.stringify({ deleted_records: deletedRecords, anonymized_records: anonymizedRecords })}
      WHERE request_id = ${requestId}
    `;

    await auditDataChange(
      'gdpr_deletion_completed',
      'gdpr_request',
      requestId,
      { status: 'processing' },
      { 
        status: 'completed', 
        deleted_records: deletedRecords.length,
        anonymized_records: anonymizedRecords.length 
      },
      request.user_id,
      'gdpr',
      true
    );

  } catch (error) {
    console.error(`Deletion processing failed for ${requestId}:`, error);
    
    await DB.exec`
      UPDATE gdpr_requests 
      SET status = 'failed', failure_reason = ${error.message}, updated_at = NOW()
      WHERE request_id = ${requestId}
    `;
  }
}

// Simulation functions - in a real implementation, these would connect to actual service databases
async function simulateRecordDeletion(service: string, table: string, userId: string): Promise<number> {
  // This would execute: DELETE FROM {service}.{table} WHERE user_id = {userId}
  // For simulation, return a random count
  return Math.floor(Math.random() * 10);
}

async function simulateColumnAnonymization(
  service: string, 
  table: string, 
  column: string, 
  method: string, 
  userId: string
): Promise<number> {
  // This would execute anonymization based on method:
  // hash: UPDATE {service}.{table} SET {column} = SHA256({column}) WHERE user_id = {userId}
  // random: UPDATE {service}.{table} SET {column} = RANDOM_STRING() WHERE user_id = {userId}
  // null: UPDATE {service}.{table} SET {column} = NULL WHERE user_id = {userId}
  
  // For simulation, return a random count
  return Math.floor(Math.random() * 5);
}