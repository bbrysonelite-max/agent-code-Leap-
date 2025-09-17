import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "./db";
import { ExportRequest, ExportOptions, ReportData, BulkExportRequest } from "./types";
import { generateReportData } from "./report_generator";

export const exportReport = async (
  request: ExportRequest, 
  reportData?: ReportData
): Promise<{ file_path: string; file_size: number; mime_type: string }> => {
  const { report_id, format, options } = request;
  
  // Get report data if not provided
  if (!reportData) {
    const report = await db.queryRow`
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
  const html = generateReportHTML(data, options);
  const fileName = `report_${data.metadata.report_id}_${Date.now()}.pdf`;
  const filePath = `/tmp/reports/${fileName}`;
  
  // Enhanced PDF generation with proper styling and charts
  const enhancedHtml = generateEnhancedPDFHTML(data, options);
  
  // In a real implementation with puppeteer:
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();
  // await page.setContent(enhancedHtml);
  // const pdfBuffer = await page.pdf({
  //   format: 'A4',
  //   printBackground: true,
  //   margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
  // });
  // await browser.close();
  // 
  // Save to file system or cloud storage
  // const fileSize = pdfBuffer.length;
  
  // Mock implementation with enhanced content
  const pdfContent = generatePDFContent(data, options);
  
  return {
    file_path: filePath,
    file_size: pdfContent.length,
    mime_type: 'application/pdf',
    content: pdfContent
  };
}

async function exportToExcel(data: ReportData, options?: ExportOptions): Promise<any> {
  const fileName = `report_${data.metadata.report_id}_${Date.now()}.xlsx`;
  const filePath = `/tmp/reports/${fileName}`;
  
  // Enhanced Excel generation with multiple worksheets and formatting
  const excelData = generateEnhancedExcelData(data, options);
  
  // In a real implementation with ExcelJS:
  // const workbook = new ExcelJS.Workbook();
  // 
  // // Summary worksheet with formatting
  // const summarySheet = workbook.addWorksheet('Summary');
  // addSummaryToWorksheet(summarySheet, data.summary);
  // 
  // // Data worksheet with filters and formatting
  // const dataSheet = workbook.addWorksheet('Data');
  // addDataToWorksheet(dataSheet, data.data);
  // 
  // // Charts worksheet (if supported)
  // if (options?.include_charts && data.charts) {
  //   const chartsSheet = workbook.addWorksheet('Charts');
  //   addChartsToWorksheet(chartsSheet, data.charts);
  // }
  // 
  // const buffer = await workbook.xlsx.writeBuffer();
  // const fileSize = buffer.length;
  
  const excelContent = generateExcelContent(excelData);
  
  return {
    file_path: filePath,
    file_size: excelContent.length,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: excelContent
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

// Enhanced helper functions

function generateEnhancedPDFHTML(data: ReportData, options?: ExportOptions): string {
  const { branding } = options || {};
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Advanced Report - ${data.metadata.report_id}</title>
  <style>
    @page { 
      size: A4; 
      margin: 2cm; 
      @bottom-center { content: "Page " counter(page) " of " counter(pages); }
    }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      margin: 0; 
      color: #1f2937; 
      line-height: 1.6;
    }
    .header { 
      border-bottom: 3px solid ${branding?.colors?.primary || '#3b82f6'}; 
      padding-bottom: 30px; 
      margin-bottom: 40px; 
      text-align: center;
    }
    .company-logo { max-height: 60px; margin-bottom: 20px; }
    .report-title { 
      font-size: 36px; 
      font-weight: 700; 
      color: ${branding?.colors?.primary || '#3b82f6'};
      margin: 0;
    }
    .report-subtitle { 
      font-size: 16px; 
      color: #6b7280; 
      margin: 10px 0;
    }
    .executive-summary {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      padding: 30px;
      border-radius: 12px;
      margin: 30px 0;
      border-left: 6px solid ${branding?.colors?.accent || '#10b981'};
    }
    .summary-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
      gap: 25px; 
      margin: 40px 0; 
    }
    .summary-card { 
      background: #ffffff; 
      padding: 25px; 
      border-radius: 12px; 
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border-left: 6px solid ${branding?.colors?.accent || '#10b981'};
    }
    .summary-value { 
      font-size: 32px; 
      font-weight: 700; 
      color: ${branding?.colors?.primary || '#3b82f6'};
      margin-bottom: 8px;
    }
    .summary-label { 
      color: #6b7280; 
      font-size: 14px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .insights-section {
      margin: 50px 0;
    }
    .insight-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .chart-placeholder {
      background: #f3f4f6;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      color: #6b7280;
      margin: 20px 0;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 25px 0; 
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    th, td { 
      border: 1px solid #e5e7eb; 
      padding: 12px 15px; 
      text-align: left; 
    }
    th { 
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); 
      font-weight: 600; 
      color: #374151;
    }
    .footer { 
      margin-top: 60px; 
      padding-top: 30px; 
      border-top: 2px solid #e5e7eb; 
      color: #6b7280; 
      font-size: 12px; 
      text-align: center;
    }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="header">
    ${branding?.logo_url ? `<img src="${branding.logo_url}" alt="Logo" class="company-logo">` : ''}
    <h1 class="report-title">Analytics Report</h1>
    <p class="report-subtitle">Generated on ${data.metadata.generated_at.toLocaleString()}</p>
    <p class="report-subtitle">Report ID: ${data.metadata.report_id}</p>
  </div>
  
  <div class="executive-summary">
    <h2>Executive Summary</h2>
    <p>This report provides comprehensive insights across ${data.metadata.total_records} data points, 
    covering the period from ${data.metadata.date_range?.start_date?.toLocaleDateString()} 
    to ${data.metadata.date_range?.end_date?.toLocaleDateString()}.</p>
  </div>
  
  <div class="summary-grid">
    ${Object.entries(data.summary).map(([key, value]) => `
      <div class="summary-card">
        <div class="summary-value">${formatValue(value)}</div>
        <div class="summary-label">${formatLabel(key)}</div>
      </div>
    `).join('')}
  </div>
  
  ${data.charts && data.charts.length > 0 ? `
    <div class="page-break"></div>
    <div class="insights-section">
      <h2>Key Insights</h2>
      ${data.charts.map(chart => `
        <div class="insight-card">
          <h3>${chart.title}</h3>
          <div class="chart-placeholder">
            ${chart.type.toUpperCase()} Chart<br>
            ${chart.data.length} data points
          </div>
          <p><strong>Chart Type:</strong> ${chart.type}</p>
          <p><strong>Data Points:</strong> ${chart.data.length}</p>
        </div>
      `).join('')}
    </div>
  ` : ''}
  
  ${options?.include_raw_data && data.raw_data ? `
    <div class="page-break"></div>
    <h2>Detailed Data</h2>
    <table>
      <thead>
        <tr>
          ${data.raw_data.length > 0 ? Object.keys(data.raw_data[0]).map(key => `<th>${formatLabel(key)}</th>`).join('') : ''}
        </tr>
      </thead>
      <tbody>
        ${data.raw_data.slice(0, 100).map(row => `
          <tr>
            ${Object.values(row).map(value => `<td>${formatValue(value)}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${data.raw_data.length > 100 ? `<p><em>Showing first 100 of ${data.raw_data.length} records</em></p>` : ''}
  ` : ''}
  
  <div class="footer">
    <p>Report generated by Advanced Analytics Platform</p>
    <p>© ${new Date().getFullYear()} ${branding?.company_name || 'Your Company'}. All rights reserved.</p>
  </div>
</body>
</html>
  `;
}

function generateEnhancedExcelData(data: ReportData, options?: ExportOptions): any {
  const worksheets = [];
  
  // Enhanced summary worksheet
  const summaryData = Object.entries(data.summary).map(([key, value]) => ({
    Metric: formatLabel(key),
    Value: formatValue(value),
    Type: typeof value === 'number' ? 'Numeric' : 'Text',
    'Last Updated': data.metadata.generated_at.toISOString()
  }));
  
  worksheets.push({
    name: 'Executive Summary',
    data: summaryData,
    formatting: {
      headers: { bold: true, backgroundColor: '#f3f4f6' },
      columns: [
        { width: 30 },
        { width: 20, numberFormat: '#,##0.00' },
        { width: 15 },
        { width: 25 }
      ]
    }
  });
  
  // Raw data worksheet with enhanced formatting
  if (options?.include_raw_data && data.raw_data?.length > 0) {
    worksheets.push({
      name: 'Detailed Data',
      data: data.raw_data.slice(0, 10000), // Limit for performance
      formatting: {
        headers: { bold: true, backgroundColor: '#e5e7eb' },
        alternatingRows: true,
        autoFilter: true
      }
    });
  }
  
  // Charts data worksheets
  if (options?.include_charts && data.charts?.length > 0) {
    data.charts.forEach((chart, index) => {
      worksheets.push({
        name: `Chart ${index + 1} Data`,
        data: chart.data,
        metadata: {
          chart_title: chart.title,
          chart_type: chart.type,
          data_points: chart.data.length
        }
      });
    });
  }
  
  // Drill-down options if available
  if (data.drill_down_options?.length > 0) {
    const drillDownData = data.drill_down_options.map(option => ({
      Metric: option.metric,
      Label: option.label,
      Description: option.description || '',
      'Available Dimensions': option.available_dimensions.join(', '),
      'Default Grouping': option.default_grouping || 'None'
    }));
    
    worksheets.push({
      name: 'Drill-Down Options',
      data: drillDownData
    });
  }
  
  return worksheets;
}

function generatePDFContent(data: ReportData, options?: ExportOptions): string {
  // Mock PDF content generation
  return `PDF Report Content:\n${JSON.stringify({
    report_id: data.metadata.report_id,
    generated_at: data.metadata.generated_at,
    summary: data.summary,
    charts_count: data.charts?.length || 0,
    data_points: data.metadata.total_records
  }, null, 2)}`;
}

function generateExcelContent(worksheets: any[]): string {
  // Mock Excel content generation
  let content = 'Excel Workbook Content:\n';
  worksheets.forEach(worksheet => {
    content += `\n=== ${worksheet.name} ===\n`;
    content += `Rows: ${worksheet.data.length}\n`;
    if (worksheet.data.length > 0) {
      content += `Columns: ${Object.keys(worksheet.data[0]).join(', ')}\n`;
    }
  });
  return content;
}

async function generateBulkZipExport(reports: any[], options?: ExportOptions): Promise<string> {
  // Mock ZIP generation
  return `Bulk ZIP Export with ${reports.length} reports`;
}

async function generateCombinedReport(reports: any[], format: string): Promise<string> {
  // Mock combined report generation
  return `Combined ${format.toUpperCase()} report with ${reports.length} reports`;
}

async function readExportFile(filePath: string, format: string): Promise<string> {
  // Mock file reading
  return `Mock file content for ${filePath} in ${format} format`;
}

function getMimeType(format: string): string {
  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'json': 'application/json',
    'zip': 'application/zip'
  };
  return mimeTypes[format] || 'application/octet-stream';
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || 'report';
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
    const report = await db.queryRow`
      SELECT * FROM reports 
      WHERE id = ${request.report_id} AND user_id = ${userID}
    `;
    
    if (!report) {
      throw new Error("Report not found or access denied");
    }
    
    // Create execution record
    const execution = await db.queryRow`
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

export const bulkExportReports = api(
  { method: "POST", path: "/reports/bulk-export", auth: true, expose: true },
  async (request: BulkExportRequest): Promise<{ download_url: string; file_name: string }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns all reports
    const reports = await db.queryAll`
      SELECT * FROM reports 
      WHERE id = ANY(${request.report_ids}) AND user_id = ${userID}
    `;
    
    if (reports.length !== request.report_ids.length) {
      throw new Error("Some reports not found or access denied");
    }
    
    // Create bulk export execution record
    const execution = await db.queryRow`
      INSERT INTO report_executions (report_id, status, format)
      VALUES (${request.report_ids[0]}, 'running', ${request.format})
      RETURNING *
    `;
    
    try {
      const startTime = Date.now();
      
      if (request.format === 'zip') {
        // Generate individual reports and zip them
        const zipContent = await generateBulkZipExport(reports, request.options);
        const executionTime = Date.now() - startTime;
        
        await db.queryAll`
          UPDATE report_executions 
          SET status = 'completed', 
              file_size = ${zipContent.length},
              execution_time_ms = ${executionTime},
              completed_at = NOW()
          WHERE id = ${execution.id}
        `;
        
        return {
          download_url: `/api/reports/download/${execution.id}`,
          file_name: `bulk_reports_${Date.now()}.zip`
        };
      } else {
        // Generate combined report
        const combinedData = await generateCombinedReport(reports, request.format);
        const executionTime = Date.now() - startTime;
        
        await db.queryAll`
          UPDATE report_executions 
          SET status = 'completed', 
              file_size = ${combinedData.length},
              execution_time_ms = ${executionTime},
              completed_at = NOW()
          WHERE id = ${execution.id}
        `;
        
        return {
          download_url: `/api/reports/download/${execution.id}`,
          file_name: `combined_report_${Date.now()}.${request.format}`
        };
      }
    } catch (error) {
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
  async ({ executionId }: { executionId: string }): Promise<{ file_content: string; mime_type: string; file_name: string }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the execution
    const execution = await db.queryRow`
      SELECT e.*, r.user_id 
      FROM report_executions e
      JOIN reports r ON e.report_id = r.id
      WHERE e.id = ${executionId} AND r.user_id = ${userID} AND e.status = 'completed'
    `;
    
    if (!execution) {
      throw new Error("Download not found or access denied");
    }
    
    // In a real implementation, read from cloud storage or file system
    const fileContent = await readExportFile(execution.file_path, execution.format);
    
    return {
      file_content: fileContent,
      mime_type: getMimeType(execution.format),
      file_name: getFileName(execution.file_path)
    };
  }
);