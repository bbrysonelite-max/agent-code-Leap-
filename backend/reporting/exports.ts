import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "./db";
import { ExportRequest, ExportOptions, ReportData } from "./types";
import { generateReportData } from "./report_generator";

export const exportReport = async (
  request: ExportRequest, 
  reportData?: ReportData
): Promise<{ file_path: string; file_size: number; mime_type: string }> => {
  const { report_id, format, options } = request;
  
  // Get report data if not provided
  if (!reportData) {
    const report = await db.queryAllRow`
      SELECT * FROM reports WHERE id = ${report_id}
    `;
    
    if (!report) {
      throw new Error("Report not found");
    }
    
    const reportConfig = {
      ...report,
      config: JSON.parse(report.config as string),
      filters: JSON.parse(report.filters as string)
    };
    
    reportData = await generateReportData(reportConfig);
    reportData.metadata.report_id = report_id;
  }
  
  switch (format) {
    case 'pdf':
      return await exportToPDF(reportData, options);
    case 'excel':
      return await exportToExcel(reportData, options);
    case 'json':
      return await exportToJSON(reportData, options);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};

async function exportToPDF(data: ReportData, options?: ExportOptions): Promise<any> {
  // PDF generation would typically use a library like puppeteer or jsPDF
  // For now, we'll create a structured HTML representation that could be converted to PDF
  
  const html = generateReportHTML(data, options);
  const fileName = `report_${data.metadata.report_id}_${Date.now()}.pdf`;
  const filePath = `/tmp/reports/${fileName}`;
  
  // In a real implementation, you would:
  // 1. Generate PDF from HTML using puppeteer or similar
  // 2. Save to file system or cloud storage
  // 3. Return file metadata
  
  // Mock implementation
  const pdfContent = `PDF Report: ${data.metadata.report_id}\n${JSON.stringify(data.summary, null, 2)}`;
  
  return {
    file_path: filePath,
    file_size: pdfContent.length,
    mime_type: 'application/pdf'
  };
}

async function exportToExcel(data: ReportData, options?: ExportOptions): Promise<any> {
  // Excel generation would typically use a library like ExcelJS
  // For now, we'll create a CSV representation
  
  const fileName = `report_${data.metadata.report_id}_${Date.now()}.xlsx`;
  const filePath = `/tmp/reports/${fileName}`;
  
  // Convert data to Excel format
  const excelData = generateExcelData(data, options);
  
  // Mock implementation - in reality you'd use ExcelJS or similar
  const csvContent = convertToCSV(excelData);
  
  return {
    file_path: filePath,
    file_size: csvContent.length,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
}

async function exportToJSON(data: ReportData, options?: ExportOptions): Promise<any> {
  const fileName = `report_${data.metadata.report_id}_${Date.now()}.json`;
  const filePath = `/tmp/reports/${fileName}`;
  
  const jsonContent = JSON.stringify(data, null, 2);
  
  return {
    file_path: filePath,
    file_size: jsonContent.length,
    mime_type: 'application/json'
  };
}

function generateReportHTML(data: ReportData, options?: ExportOptions): string {
  const { branding } = options || {};
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Report - ${data.metadata.report_id}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #333;
    }
    .header {
      border-bottom: 2px solid ${branding?.colors?.primary || '#3b82f6'};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: ${branding?.colors?.primary || '#3b82f6'};
    }
    .report-title {
      font-size: 32px;
      margin: 20px 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .summary-card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid ${branding?.colors?.accent || '#10b981'};
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: ${branding?.colors?.primary || '#3b82f6'};
    }
    .summary-label {
      color: #64748b;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${branding?.logo_url ? `<img src="${branding.logo_url}" alt="Logo" height="40">` : ''}
    ${branding?.company_name ? `<div class="company-name">${branding.company_name}</div>` : ''}
    <div class="report-title">Analytics Report</div>
    <div>Generated on: ${data.metadata.generated_at.toLocaleString()}</div>
  </div>
  
  <div class="summary-grid">
    ${Object.entries(data.summary).map(([key, value]) => `
      <div class="summary-card">
        <div class="summary-value">${formatValue(value)}</div>
        <div class="summary-label">${formatLabel(key)}</div>
      </div>
    `).join('')}
  </div>
  
  ${options?.include_raw_data ? `
    <h2>Detailed Data</h2>
    <table>
      <thead>
        <tr>
          ${data.data.length > 0 ? Object.keys(data.data[0]).map(key => `<th>${formatLabel(key)}</th>`).join('') : ''}
        </tr>
      </thead>
      <tbody>
        ${data.data.map(row => `
          <tr>
            ${Object.values(row).map(value => `<td>${formatValue(value)}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}
  
  <div class="footer">
    Report ID: ${data.metadata.report_id} | 
    Total Records: ${data.metadata.total_records} |
    Date Range: ${data.metadata.date_range.start_date.toLocaleDateString()} - ${data.metadata.date_range.end_date.toLocaleDateString()}
  </div>
</body>
</html>
  `;
}

function generateExcelData(data: ReportData, options?: ExportOptions): any {
  const worksheets = [];
  
  // Summary worksheet
  const summaryData = Object.entries(data.summary).map(([key, value]) => ({
    Metric: formatLabel(key),
    Value: formatValue(value)
  }));
  
  worksheets.push({
    name: 'Summary',
    data: summaryData
  });
  
  // Raw data worksheet
  if (options?.include_raw_data && data.data.length > 0) {
    worksheets.push({
      name: 'Data',
      data: data.data
    });
  }
  
  // Charts data worksheet
  if (options?.include_charts && data.charts?.length > 0) {
    data.charts.forEach((chart, index) => {
      worksheets.push({
        name: `Chart_${index + 1}`,
        data: chart.data
      });
    });
  }
  
  return worksheets;
}

function convertToCSV(worksheets: any[]): string {
  let csvContent = '';
  
  worksheets.forEach((worksheet, index) => {
    if (index > 0) csvContent += '\n\n';
    csvContent += `=== ${worksheet.name} ===\n`;
    
    if (worksheet.data.length > 0) {
      const headers = Object.keys(worksheet.data[0]);
      csvContent += headers.join(',') + '\n';
      
      worksheet.data.forEach((row: any) => {
        const values = headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        });
        csvContent += values.join(',') + '\n';
      });
    }
  });
  
  return csvContent;
}

function formatValue(value: any): string {
  if (typeof value === 'number') {
    if (value % 1 === 0) {
      return value.toLocaleString();
    } else {
      return value.toFixed(2);
    }
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value || '');
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

export const downloadReport = api(
  { method: "POST", path: "/reports/export", auth: true, expose: true },
  async (request: ExportRequest): Promise<{ download_url: string; file_name: string }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the report
    const report = await db.queryAllRow`
      SELECT * FROM reports 
      WHERE id = ${request.report_id} AND user_id = ${userID}
    `;
    
    if (!report) {
      throw new Error("Report not found or access denied");
    }
    
    // Create execution record
    const execution = await db.queryAllRow`
      INSERT INTO report_executions (report_id, status, format)
      VALUES (${request.report_id}, 'running', ${request.format})
      RETURNING *
    `;
    
    try {
      const startTime = Date.now();
      
      // Export the report
      const exportResult = await exportReport(request);
      
      const executionTime = Date.now() - startTime;
      
      // Update execution record
      await db.queryAll`
        UPDATE report_executions 
        SET status = 'completed', 
            file_path = ${exportResult.file_path},
            file_size = ${exportResult.file_size},
            execution_time_ms = ${executionTime},
            completed_at = NOW()
        WHERE id = ${execution.id}
      `;
      
      // In a real implementation, you would generate a secure download URL
      const fileName = exportResult.file_path.split('/').pop() || 'report';
      const downloadUrl = `/api/reports/download/${execution.id}`;
      
      return {
        download_url: downloadUrl,
        file_name: fileName
      };
      
    } catch (error) {
      // Update execution record with error
      await db.queryAll`
        UPDATE report_executions 
        SET status = 'failed', 
            error_message = ${error.message},
            completed_at = NOW()
        WHERE id = ${execution.id}
      `;
      
      throw error;
    }
  }
);

export const getDownload = api(
  { method: "GET", path: "/reports/download/:executionId", auth: true, expose: true },
  async ({ executionId }: { executionId: string }): Promise<{ file_content: string; mime_type: string }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the execution
    const execution = await db.queryAllRow`
      SELECT e.*, r.user_id 
      FROM report_executions e
      JOIN reports r ON e.report_id = r.id
      WHERE e.id = ${executionId} AND r.user_id = ${userID} AND e.status = 'completed'
    `;
    
    if (!execution) {
      throw new Error("Download not found or access denied");
    }
    
    // In a real implementation, you would read the actual file
    const mockFileContent = `Report content for execution ${executionId}`;
    
    return {
      file_content: mockFileContent,
      mime_type: execution.format === 'pdf' ? 'application/pdf' : 
                 execution.format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                 'application/json'
    };
  }
);