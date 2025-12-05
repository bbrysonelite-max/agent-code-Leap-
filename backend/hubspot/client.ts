// HubSpot API Key - set via Encore secrets when ready
// import { secret } from "encore.dev/config";
// const hubspotApiKey = secret("HUBSPOT_API_KEY");

import { HubSpotContact, HubSpotDeal, HubSpotCompany } from "./types";

export class HubSpotClient {
  private baseUrl = "https://api.hubapi.com";
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Contacts
  async getContacts(limit = 100, after?: string) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      properties: 'email,firstname,lastname,company,phone,lifecyclestage,lead_status,hs_lead_status,createdate,lastmodifieddate'
    });
    
    if (after) {
      params.append('after', after);
    }

    return this.makeRequest(`/crm/v3/objects/contacts?${params}`);
  }

  async getContact(contactId: string) {
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,company,phone,lifecyclestage,lead_status,hs_lead_status,createdate,lastmodifieddate`);
  }

  async createContact(properties: Record<string, any>) {
    return this.makeRequest('/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });
  }

  async updateContact(contactId: string, properties: Record<string, any>) {
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.makeRequest(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'DELETE',
    });
  }

  // Deals
  async getDeals(limit = 100, after?: string) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      properties: 'dealname,amount,closedate,dealstage,pipeline,dealtype,hubspot_owner_id,createdate,lastmodifieddate'
    });
    
    if (after) {
      params.append('after', after);
    }

    return this.makeRequest(`/crm/v3/objects/deals?${params}`);
  }

  async getDeal(dealId: string) {
    return this.makeRequest(`/crm/v3/objects/deals/${dealId}?properties=dealname,amount,closedate,dealstage,pipeline,dealtype,hubspot_owner_id,createdate,lastmodifieddate`);
  }

  async createDeal(properties: Record<string, any>) {
    return this.makeRequest('/crm/v3/objects/deals', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });
  }

  async updateDeal(dealId: string, properties: Record<string, any>) {
    return this.makeRequest(`/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async deleteDeal(dealId: string): Promise<void> {
    await this.makeRequest(`/crm/v3/objects/deals/${dealId}`, {
      method: 'DELETE',
    });
  }

  // Companies
  async getCompanies(limit = 100, after?: string) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      properties: 'name,domain,industry,city,state,country,phone,createdate,lastmodifieddate'
    });
    
    if (after) {
      params.append('after', after);
    }

    return this.makeRequest(`/crm/v3/objects/companies?${params}`);
  }

  async getCompany(companyId: string) {
    return this.makeRequest(`/crm/v3/objects/companies/${companyId}?properties=name,domain,industry,city,state,country,phone,createdate,lastmodifieddate`);
  }

  async createCompany(properties: Record<string, any>) {
    return this.makeRequest('/crm/v3/objects/companies', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });
  }

  async updateCompany(companyId: string, properties: Record<string, any>) {
    return this.makeRequest(`/crm/v3/objects/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  // Associations
  async associateContactWithDeal(contactId: string, dealId: string): Promise<void> {
    await this.makeRequest(`/crm/v3/objects/contacts/${contactId}/associations/deals/${dealId}/contact_to_deal`, {
      method: 'PUT',
    });
  }

  async associateContactWithCompany(contactId: string, companyId: string): Promise<void> {
    await this.makeRequest(`/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/contact_to_company`, {
      method: 'PUT',
    });
  }

  // Search
  async searchContacts(filter: Record<string, any>) {
    return this.makeRequest('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [filter] }],
        properties: ['email', 'firstname', 'lastname', 'company', 'phone', 'lifecyclestage', 'lead_status'],
        limit: 100
      }),
    });
  }

  async searchDeals(filter: Record<string, any>) {
    return this.makeRequest('/crm/v3/objects/deals/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [filter] }],
        properties: ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline'],
        limit: 100
      }),
    });
  }
}