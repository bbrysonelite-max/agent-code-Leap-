import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "./db";
import { 
  DateRange, 
  SegmentDefinition, 
  SegmentCriteria,
  ReportFilters 
} from "./types";

export const createSegment = api(
  { method: "POST", path: "/segments", auth: true, expose: true },
  async (request: {
    name: string;
    description?: string;
    criteria: SegmentCriteria;
  }): Promise<SegmentDefinition> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    const result = await db.queryRow`
      INSERT INTO report_segments (name, description, criteria)
      VALUES (${request.name}, ${request.description || null}, ${JSON.stringify(request.criteria)})
      RETURNING *
    `;

    return {
      ...result,
      criteria: JSON.parse(result.criteria as string)
    };
  }
);

export const listSegments = api(
  { method: "GET", path: "/segments", auth: true, expose: true },
  async (): Promise<{ segments: SegmentDefinition[] }> => {
    const results = await db.queryAll`
      SELECT * FROM report_segments
      ORDER BY created_at DESC
    `;

    const segments = results.map(row => ({
      ...row,
      criteria: JSON.parse(row.criteria as string)
    }));

    return { segments };
  }
);

export const getSegment = api(
  { method: "GET", path: "/segments/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<SegmentDefinition> => {
    const result = await db.queryRow`
      SELECT * FROM report_segments WHERE id = ${id}
    `;

    if (!result) {
      throw new Error("Segment not found");
    }

    return {
      ...result,
      criteria: JSON.parse(result.criteria as string)
    };
  }
);

export const updateSegment = api(
  { method: "PUT", path: "/segments/:id", auth: true, expose: true },
  async ({ id, ...request }: {
    id: string;
    name?: string;
    description?: string;
    criteria?: SegmentCriteria;
  }): Promise<SegmentDefinition> => {
    const updates: string[] = [];
    const values: any[] = [];

    if (request.name !== undefined) {
      updates.push(`name = $${values.length + 1}`);
      values.push(request.name);
    }
    if (request.description !== undefined) {
      updates.push(`description = $${values.length + 1}`);
      values.push(request.description);
    }
    if (request.criteria !== undefined) {
      updates.push(`criteria = $${values.length + 1}`);
      values.push(JSON.stringify(request.criteria));
    }

    values.push(id);

    const query = `
      UPDATE report_segments 
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await db.rawQueryRow(query, ...values);

    if (!result) {
      throw new Error("Segment not found");
    }

    return {
      ...result,
      criteria: JSON.parse(result.criteria as string)
    };
  }
);

export const deleteSegment = api(
  { method: "DELETE", path: "/segments/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    await db.queryAll`
      DELETE FROM report_segments WHERE id = ${id}
    `;

    return { success: true };
  }
);

export const getAvailableFilters = api(
  { method: "GET", path: "/filters/available", auth: true, expose: true },
  async ({ data_source }: { data_source: string }): Promise<{
    available_filters: any[];
    filter_presets: any[];
  }> => {
    const filterDefinitions: { [key: string]: any[] } = {
      prospects: [
        {
          field: 'status',
          type: 'multi_select',
          label: 'Status',
          options: ['new', 'contacted', 'qualified', 'converted', 'unqualified'],
          default: []
        },
        {
          field: 'score_range',
          type: 'range',
          label: 'Score Range',
          min: 0,
          max: 100,
          default: { min: 0, max: 100 }
        },
        {
          field: 'source',
          type: 'multi_select',
          label: 'Lead Source',
          options: ['website', 'linkedin', 'email', 'referral', 'cold_outreach'],
          default: []
        },
        {
          field: 'industry',
          type: 'multi_select',
          label: 'Industry',
          options: ['technology', 'finance', 'healthcare', 'retail', 'manufacturing'],
          default: []
        },
        {
          field: 'company_size',
          type: 'multi_select',
          label: 'Company Size',
          options: ['startup', 'smb', 'mid_market', 'enterprise'],
          default: []
        },
        {
          field: 'geographic_region',
          type: 'multi_select',
          label: 'Geographic Region',
          options: ['north_america', 'europe', 'asia_pacific', 'latin_america'],
          default: []
        },
        {
          field: 'created_date_range',
          type: 'date_range',
          label: 'Creation Date Range',
          default: null
        },
        {
          field: 'last_activity_date_range',
          type: 'date_range',
          label: 'Last Activity Date Range',
          default: null
        }
      ],
      campaigns: [
        {
          field: 'campaign_type',
          type: 'multi_select',
          label: 'Campaign Type',
          options: ['email', 'linkedin', 'cold_call', 'nurturing'],
          default: []
        },
        {
          field: 'template_category',
          type: 'multi_select',
          label: 'Template Category',
          options: ['introduction', 'follow_up', 'demo_request', 'case_study'],
          default: []
        },
        {
          field: 'open_rate_range',
          type: 'range',
          label: 'Open Rate Range (%)',
          min: 0,
          max: 100,
          default: { min: 0, max: 100 }
        },
        {
          field: 'click_rate_range',
          type: 'range',
          label: 'Click Rate Range (%)',
          min: 0,
          max: 100,
          default: { min: 0, max: 100 }
        },
        {
          field: 'target_audience',
          type: 'multi_select',
          label: 'Target Audience',
          options: ['executives', 'managers', 'individual_contributors', 'decision_makers'],
          default: []
        },
        {
          field: 'send_time_range',
          type: 'time_range',
          label: 'Send Time Range',
          min: 0,
          max: 23,
          default: { min: 9, max: 17 }
        }
      ],
      agents: [
        {
          field: 'agent_status',
          type: 'multi_select',
          label: 'Agent Status',
          options: ['active', 'paused', 'stopped', 'error'],
          default: []
        },
        {
          field: 'daily_limit_range',
          type: 'range',
          label: 'Daily Limit Range',
          min: 1,
          max: 500,
          default: { min: 1, max: 500 }
        },
        {
          field: 'performance_tier',
          type: 'multi_select',
          label: 'Performance Tier',
          options: ['top_25_percent', 'top_50_percent', 'bottom_50_percent', 'bottom_25_percent'],
          default: []
        },
        {
          field: 'territory',
          type: 'multi_select',
          label: 'Territory',
          options: ['west_coast', 'east_coast', 'midwest', 'south', 'international'],
          default: []
        }
      ],
      deals: [
        {
          field: 'stage',
          type: 'multi_select',
          label: 'Deal Stage',
          options: ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
          default: []
        },
        {
          field: 'value_range',
          type: 'range',
          label: 'Deal Value Range',
          min: 0,
          max: 1000000,
          default: { min: 0, max: 1000000 }
        },
        {
          field: 'source',
          type: 'multi_select',
          label: 'Deal Source',
          options: ['inbound', 'outbound', 'referral', 'partner'],
          default: []
        },
        {
          field: 'priority',
          type: 'multi_select',
          label: 'Priority',
          options: ['low', 'medium', 'high', 'critical'],
          default: []
        },
        {
          field: 'expected_close_date_range',
          type: 'date_range',
          label: 'Expected Close Date Range',
          default: null
        }
      ]
    };

    const filterPresets = [
      {
        name: 'High-Value Prospects',
        description: 'Prospects with high scores and large company size',
        filters: {
          score_range: { min: 80, max: 100 },
          company_size: ['mid_market', 'enterprise'],
          status: ['qualified', 'contacted']
        }
      },
      {
        name: 'Recent Activity',
        description: 'Prospects with activity in the last 7 days',
        filters: {
          last_activity_date_range: {
            start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end_date: new Date()
          }
        }
      },
      {
        name: 'High-Performing Campaigns',
        description: 'Campaigns with above-average engagement',
        filters: {
          open_rate_range: { min: 25, max: 100 },
          click_rate_range: { min: 5, max: 100 }
        }
      },
      {
        name: 'Active Agents',
        description: 'Currently active agents with good performance',
        filters: {
          agent_status: ['active'],
          performance_tier: ['top_50_percent', 'top_25_percent']
        }
      },
      {
        name: 'Pipeline Deals',
        description: 'Open deals in active stages',
        filters: {
          stage: ['qualified', 'proposal', 'negotiation'],
          value_range: { min: 5000, max: 1000000 }
        }
      }
    ];

    return {
      available_filters: filterDefinitions[data_source] || [],
      filter_presets: filterPresets
    };
  }
);

export const validateFilters = api(
  { method: "POST", path: "/filters/validate", auth: true, expose: true },
  async (request: {
    data_source: string;
    filters: ReportFilters;
  }): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }> => {
    const { data_source, filters } = request;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get available filters for validation
    const { available_filters } = await getAvailableFilters({ data_source });
    const filterMap = new Map(available_filters.map(f => [f.field, f]));

    // Validate each filter
    Object.entries(filters).forEach(([field, value]) => {
      const filterDef = filterMap.get(field);
      
      if (!filterDef) {
        errors.push(`Unknown filter field: ${field}`);
        return;
      }

      // Validate based on filter type
      switch (filterDef.type) {
        case 'multi_select':
          if (!Array.isArray(value)) {
            errors.push(`${field} must be an array`);
          } else {
            const invalidOptions = value.filter(v => !filterDef.options.includes(v));
            if (invalidOptions.length > 0) {
              errors.push(`Invalid options for ${field}: ${invalidOptions.join(', ')}`);
            }
          }
          break;

        case 'range':
          if (typeof value !== 'object' || value === null) {
            errors.push(`${field} must be an object with min and max properties`);
          } else {
            const { min, max } = value;
            if (typeof min !== 'number' || typeof max !== 'number') {
              errors.push(`${field} min and max must be numbers`);
            } else if (min > max) {
              errors.push(`${field} min cannot be greater than max`);
            } else if (min < filterDef.min || max > filterDef.max) {
              warnings.push(`${field} range is outside recommended bounds`);
            }
          }
          break;

        case 'date_range':
          if (typeof value !== 'object' || value === null) {
            errors.push(`${field} must be an object with start_date and end_date properties`);
          } else {
            const { start_date, end_date } = value;
            try {
              const start = new Date(start_date);
              const end = new Date(end_date);
              if (start > end) {
                errors.push(`${field} start_date cannot be after end_date`);
              }
              if (start > new Date()) {
                warnings.push(`${field} start_date is in the future`);
              }
            } catch (e) {
              errors.push(`${field} contains invalid dates`);
            }
          }
          break;
      }
    });

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }
);

export const getFilterSuggestions = api(
  { method: "POST", path: "/filters/suggestions", auth: true, expose: true },
  async (request: {
    data_source: string;
    current_filters: ReportFilters;
    user_intent?: string;
  }): Promise<{
    suggested_filters: any[];
    explanations: string[];
  }> => {
    const { data_source, current_filters, user_intent } = request;
    const suggestions: any[] = [];
    const explanations: string[] = [];

    // Analyze current filters and suggest improvements
    if (data_source === 'prospects') {
      // If no status filter, suggest focusing on qualified prospects
      if (!current_filters.status || current_filters.status.length === 0) {
        suggestions.push({
          field: 'status',
          suggested_value: ['qualified', 'contacted'],
          reason: 'Focus on engaged prospects for better insights'
        });
        explanations.push('Adding status filters helps focus on prospects in your sales funnel');
      }

      // If wide score range, suggest narrowing to high-value prospects
      if (!current_filters.score_range || 
          (current_filters.score_range.max - current_filters.score_range.min) > 50) {
        suggestions.push({
          field: 'score_range',
          suggested_value: { min: 70, max: 100 },
          reason: 'High-score prospects are more likely to convert'
        });
        explanations.push('Focusing on high-score prospects (70+) can improve conversion insights');
      }

      // If no time range, suggest recent data
      if (!current_filters.created_date_range) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        suggestions.push({
          field: 'created_date_range',
          suggested_value: {
            start_date: thirtyDaysAgo,
            end_date: new Date()
          },
          reason: 'Recent data provides more actionable insights'
        });
        explanations.push('Adding a time range helps focus on recent trends');
      }
    }

    if (data_source === 'campaigns') {
      // Suggest performance-based filtering
      if (!current_filters.open_rate_range) {
        suggestions.push({
          field: 'open_rate_range',
          suggested_value: { min: 20, max: 100 },
          reason: 'Filter out poor-performing campaigns'
        });
        explanations.push('Filtering by open rate helps identify successful campaign patterns');
      }
    }

    // User intent-based suggestions
    if (user_intent) {
      if (user_intent.toLowerCase().includes('conversion')) {
        suggestions.push({
          field: 'status',
          suggested_value: ['qualified', 'converted'],
          reason: 'Focus on conversion funnel stages'
        });
        explanations.push('For conversion analysis, focus on qualified and converted prospects');
      }

      if (user_intent.toLowerCase().includes('performance')) {
        suggestions.push({
          field: 'score_range',
          suggested_value: { min: 60, max: 100 },
          reason: 'Analyze high-performing segments'
        });
        explanations.push('Performance analysis benefits from focusing on higher-score prospects');
      }
    }

    return {
      suggested_filters: suggestions,
      explanations
    };
  }
);

export const buildDynamicQuery = api(
  { method: "POST", path: "/filters/build-query", auth: true, expose: true },
  async (request: {
    data_source: string;
    filters: ReportFilters;
    base_query?: string;
  }): Promise<{
    query: string;
    parameters: any[];
    filter_summary: string;
  }> => {
    const { data_source, filters, base_query } = request;
    
    let whereClause = "WHERE 1=1";
    const parameters: any[] = [];
    const filterDescriptions: string[] = [];
    let paramIndex = 0;

    // Build where clause based on filters
    Object.entries(filters).forEach(([field, value]) => {
      switch (field) {
        case 'status':
          if (Array.isArray(value) && value.length > 0) {
            whereClause += ` AND status = ANY($${++paramIndex})`;
            parameters.push(value);
            filterDescriptions.push(`Status: ${value.join(', ')}`);
          }
          break;

        case 'score_range':
          if (value && typeof value === 'object') {
            whereClause += ` AND score >= $${++paramIndex} AND score <= $${++paramIndex}`;
            parameters.push(value.min, value.max);
            filterDescriptions.push(`Score: ${value.min}-${value.max}`);
          }
          break;

        case 'source':
          if (Array.isArray(value) && value.length > 0) {
            whereClause += ` AND source = ANY($${++paramIndex})`;
            parameters.push(value);
            filterDescriptions.push(`Source: ${value.join(', ')}`);
          }
          break;

        case 'created_date_range':
          if (value && typeof value === 'object') {
            whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
            parameters.push(value.start_date, value.end_date);
            filterDescriptions.push(`Created: ${new Date(value.start_date).toLocaleDateString()} - ${new Date(value.end_date).toLocaleDateString()}`);
          }
          break;

        case 'industry':
          if (Array.isArray(value) && value.length > 0) {
            whereClause += ` AND industry = ANY($${++paramIndex})`;
            parameters.push(value);
            filterDescriptions.push(`Industry: ${value.join(', ')}`);
          }
          break;

        case 'company_size':
          if (Array.isArray(value) && value.length > 0) {
            whereClause += ` AND company_size = ANY($${++paramIndex})`;
            parameters.push(value);
            filterDescriptions.push(`Company Size: ${value.join(', ')}`);
          }
          break;

        case 'value_range':
          if (value && typeof value === 'object') {
            whereClause += ` AND value >= $${++paramIndex} AND value <= $${++paramIndex}`;
            parameters.push(value.min, value.max);
            filterDescriptions.push(`Value: $${value.min.toLocaleString()}-$${value.max.toLocaleString()}`);
          }
          break;
      }
    });

    const query = base_query ? 
      base_query.replace('WHERE 1=1', whereClause) : 
      `SELECT * FROM ${data_source} ${whereClause}`;

    const filterSummary = filterDescriptions.length > 0 ? 
      filterDescriptions.join(', ') : 
      'No filters applied';

    return {
      query,
      parameters,
      filter_summary: filterSummary
    };
  }
);

export const getFilterInsights = api(
  { method: "POST", path: "/filters/insights", auth: true, expose: true },
  async (request: {
    data_source: string;
    filters: ReportFilters;
  }): Promise<{
    impact_analysis: any;
    recommendations: string[];
    data_coverage: number;
  }> => {
    const { data_source, filters } = request;
    
    // Mock implementation - in practice, you'd run queries to analyze impact
    const impactAnalysis = {
      records_affected: Math.floor(Math.random() * 10000),
      exclusion_rate: Math.random() * 0.3, // 0-30% excluded
      most_restrictive_filter: 'score_range',
      filter_distribution: {
        status: 0.25,
        score_range: 0.45,
        source: 0.15,
        date_range: 0.15
      }
    };

    const recommendations = [
      'Consider broadening the score range to include more prospects',
      'Adding a time filter could provide more recent insights',
      'Status filter is effectively narrowing the dataset'
    ];

    const dataCoverage = (1 - impactAnalysis.exclusion_rate) * 100;

    return {
      impact_analysis: impactAnalysis,
      recommendations,
      data_coverage: dataCoverage
    };
  }
);