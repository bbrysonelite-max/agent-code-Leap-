import { secret } from "encore.dev/config";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";
import { salesforceDB } from "./db";
import { executeQuery } from "../shared/database";
import type { 
  SalesforceConnection, 
  SalesforceRecord, 
  SalesforceQueryResponse,
  SalesforceDescribeResponse 
} from "./types";

// Secrets for OAuth configuration
const salesforceClientId = secret("SalesforceClientId");
const salesforceClientSecret = secret("SalesforceClientSecret");

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
        client_id: salesforceClientId(),
        client_secret: salesforceClientSecret()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    
    // Update the connection with the new access token
    await this.updateConnectionToken(data.access_token);
    
    return data.access_token;
  }

  private async updateConnectionToken(newAccessToken: string): Promise<void> {
    try {
      await executeQuery(
        () => salesforceDB.rawQueryRow(
          `UPDATE salesforce_connections SET access_token = $1, updated_at = NOW() WHERE id = $2`,
          newAccessToken, this.connection.id
        ),
        "update salesforce connection token"
      );
      
      // Update the in-memory connection object
      this.connection.access_token = newAccessToken;
    } catch (error) {
      console.error('Failed to update connection token in database:', error);
      // Continue with the new token even if DB update fails
    }
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
        try {
          const newToken = await this.refreshAccessToken();
          
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
            const errorBody = await retryResponse.text();
            throw new Error(`Salesforce API error after token refresh: ${retryResponse.status} ${retryResponse.statusText} - ${errorBody}`);
          }

          return await retryResponse.json() as T;
        } catch (refreshError) {
          // If token refresh fails, the connection might be invalid
          await this.markConnectionInactive();
          throw new Error(`Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
        }
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

  private async markConnectionInactive(): Promise<void> {
    try {
      await executeQuery(
        () => salesforceDB.rawQueryRow(
          `UPDATE salesforce_connections SET is_active = false WHERE id = $1`,
          this.connection.id
        ),
        "mark salesforce connection inactive"
      );
    } catch (error) {
      console.error('Failed to mark connection as inactive:', error);
    }
  }

  async revokeAccess(): Promise<void> {
    try {
      // Revoke the access token
      await fetch(`${this.connection.instance_url}/services/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: this.connection.access_token
        })
      });
      
      // Mark connection as inactive
      await this.markConnectionInactive();
    } catch (error) {
      console.error('Failed to revoke Salesforce access:', error);
      throw error;
    }
  }
}