import { api } from "encore.dev/api";
import { DB } from "./db";
import { CreateGDPRRequest, DataExportResponse, UserDataSummary } from "./types";
import { auditDataChange } from "../audit/logger";

export const requestDataExport = api(
  { method: "POST", path: "/gdpr/export", expose: true },
  async (req: CreateGDPRRequest): Promise<{ request_id: string }> => {
    const requestId = `gdpr_exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await DB.exec`
      INSERT INTO gdpr_requests (
        request_id, user_id, request_type, data_categories, 
        export_format, verification_status, submitted_by
      ) VALUES (
        ${requestId}, ${req.user_id}, ${req.request_type}, ${req.data_categories || []},
        ${req.export_format || 'json'}, 'verified', ${req.user_id}
      )
    `;

    await auditDataChange(
      'gdpr_export_requested',
      'gdpr_request',
      requestId,
      null,
      { user_id: req.user_id, request_type: req.request_type },
      req.user_id,
      'gdpr',
      true
    );

    // Start async processing
    processDataExport(requestId).catch(console.error);

    return { request_id: requestId };
  }
);

export const getDataExport = api(
  { method: "GET", path: "/gdpr/export/:request_id", expose: true },
  async ({ request_id }: { request_id: string }): Promise<DataExportResponse> => {
    const request = await DB.queryAllRow`
      SELECT * FROM gdpr_requests 
      WHERE request_id = ${request_id} AND request_type = 'export'
    `;

    if (!request) {
      throw new Error("Export request not found");
    }

    if (request.status === 'completed' && request.export_file_path) {
      return {
        request_id,
        download_url: `/gdpr/download/${request_id}`,
        expires_at: request.expires_at,
        format: request.export_format || 'json'
      };
    }

    return {
      request_id,
      format: request.export_format || 'json'
    };
  }
);

export const getUserDataSummary = api(
  { method: "GET", path: "/gdpr/summary/:user_id", expose: true },
  async ({ user_id }: { user_id: string }): Promise<UserDataSummary> => {
    // Get data categories
    const dataCategories = await DB.queryAll`
      SELECT DISTINCT data_category, service_name
      FROM data_mapping dm
      WHERE EXISTS (
        SELECT 1 FROM information_schema.tables t 
        WHERE t.table_name = dm.table_name
      )
    `;

    // Get active GDPR requests
    const activeRequests = await DB.queryAll`
      SELECT request_id, request_type, status, created_at
      FROM gdpr_requests
      WHERE user_id = ${user_id} AND status != 'completed'
      ORDER BY created_at DESC
    `;

    return {
      user_id,
      data_categories: dataCategories.map(cat => ({
        category: cat.data_category,
        services: [cat.service_name],
        record_count: 0 // Would need dynamic counting
      })),
      retention_policies: [
        { service: 'global', policy: 'GDPR compliance - 3 years default' }
      ],
      active_gdpr_requests: activeRequests.map(req => ({
        request_id: req.request_id,
        type: req.request_type,
        status: req.status,
        created_at: req.created_at
      }))
    };
  }
);

async function processDataExport(requestId: string): Promise<void> {
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

    // Get all data mappings for exportable data
    const mappings = await DB.queryAll`
      SELECT * FROM data_mapping 
      WHERE is_exportable = true
    `;

    const exportData: Record<string, any> = {};

    // Collect data from each service/table
    for (const mapping of mappings) {
      if (!exportData[mapping.service_name]) {
        exportData[mapping.service_name] = {};
      }

      try {
        // This would need to be implemented per service
        // For now, we'll create a placeholder structure
        if (!exportData[mapping.service_name][mapping.table_name]) {
          exportData[mapping.service_name][mapping.table_name] = [];
        }
      } catch (error) {
        console.error(`Failed to export data from ${mapping.service_name}.${mapping.table_name}:`, error);
      }
    }

    // Store the export data (in a real implementation, this would be stored as a file)
    const exportPath = `/exports/${requestId}.json`;
    
    await DB.exec`
      UPDATE gdpr_requests 
      SET status = 'completed', export_file_path = ${exportPath}, 
          completed_at = NOW(), expires_at = NOW() + INTERVAL '30 days',
          updated_at = NOW()
      WHERE request_id = ${requestId}
    `;

    await auditDataChange(
      'gdpr_export_completed',
      'gdpr_request',
      requestId,
      { status: 'processing' },
      { status: 'completed', export_file_path: exportPath },
      request.user_id,
      'gdpr',
      true
    );

  } catch (error) {
    console.error(`Export processing failed for ${requestId}:`, error);
    
    await DB.exec`
      UPDATE gdpr_requests 
      SET status = 'failed', failure_reason = ${error.message}, updated_at = NOW()
      WHERE request_id = ${requestId}
    `;
  }
}