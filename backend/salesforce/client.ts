import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";
import type { 
  SalesforceConnection, 
  SalesforceRecord, 
  SalesforceQueryResponse,
  SalesforceDescribeResponse 
} from "./types";

export class SalesforceClient {
  constructor(private connection: SalesforceConnection) {}

  private get baseUrl(): string {
    return `${this.connection.instance_url}/services/data/v58.0`;
  }

  private get headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.connection.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async refreshAccessToken(): Promise<string> {
    const response = await fetch(`${this.connection.instance_url}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.connection.refresh_token,
        client_id: this.connection.client_id,
        client_secret: this.connection.client_secret
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers }
      });

      if (response.status === 401) {
        // Token expired, try to refresh
        const newToken = await this.refreshAccessToken();
        this.connection.access_token = newToken;
        
        // Retry with new token
        const retryResponse = await fetch(url, {
          ...options,
          headers: { 
            ...this.headers, 
            'Authorization': `Bearer ${newToken}`,
            ...options.headers 
          }
        });

        if (!retryResponse.ok) {
          throw new Error(`Salesforce API error: ${retryResponse.status} ${retryResponse.statusText}`);
        }

        return await retryResponse.json() as T;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Salesforce API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      return await response.json() as T;
    } catch (error) {
      console.error('Salesforce API request failed:', error);
      throw error;
    }
  }

  async query<T = SalesforceRecord>(soql: string): Promise<SalesforceQueryResponse> {
    validateField(soql, "soql", [Rules.minLength(1)]);
    
    const encodedQuery = encodeURIComponent(soql);
    return this.makeRequest<SalesforceQueryResponse>(`/query?q=${encodedQuery}`);
  }

  async queryAll<T = SalesforceRecord>(soql: string): Promise<SalesforceRecord[]> {
    const allRecords: SalesforceRecord[] = [];
    let response = await this.query(soql);
    
    allRecords.push(...response.records);

    while (!response.done && response.nextRecordsUrl) {
      const nextUrl = response.nextRecordsUrl.replace('/services/data/v58.0', '');
      response = await this.makeRequest<SalesforceQueryResponse>(nextUrl);
      allRecords.push(...response.records);
    }

    return allRecords;
  }

  async describe(objectType: string): Promise<SalesforceDescribeResponse> {
    validateField(objectType, "objectType", [Rules.minLength(1)]);
    
    return this.makeRequest<SalesforceDescribeResponse>(`/sobjects/${objectType}/describe`);
  }

  async create(objectType: string, data: any): Promise<{ id: string; success: boolean }> {
    validateField(objectType, "objectType", [Rules.minLength(1)]);
    
    return this.makeRequest(`/sobjects/${objectType}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async update(objectType: string, recordId: string, data: any): Promise<void> {
    validateField(objectType, "objectType", [Rules.minLength(1)]);
    validateField(recordId, "recordId", [Rules.minLength(1)]);
    
    await this.makeRequest(`/sobjects/${objectType}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete(objectType: string, recordId: string): Promise<void> {
    validateField(objectType, "objectType", [Rules.minLength(1)]);
    validateField(recordId, "recordId", [Rules.minLength(1)]);
    
    await this.makeRequest(`/sobjects/${objectType}/${recordId}`, {
      method: 'DELETE'
    });
  }

  async getRecord(objectType: string, recordId: string, fields?: string[]): Promise<SalesforceRecord> {
    validateField(objectType, "objectType", [Rules.minLength(1)]);
    validateField(recordId, "recordId", [Rules.minLength(1)]);
    
    const fieldsParam = fields ? `?fields=${fields.join(',')}` : '';
    return this.makeRequest<SalesforceRecord>(`/sobjects/${objectType}/${recordId}${fieldsParam}`);
  }

  async search(searchQuery: string): Promise<SalesforceRecord[]> {
    validateField(searchQuery, "searchQuery", [Rules.minLength(1)]);
    
    const encodedQuery = encodeURIComponent(searchQuery);
    const response = await this.makeRequest<{ searchRecords: SalesforceRecord[] }>(`/search?q=${encodedQuery}`);
    return response.searchRecords || [];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/limits');
      return true;
    } catch (error) {
      console.error('Salesforce connection test failed:', error);
      return false;
    }
  }
}