// Apollo.io API Client
import { secret } from "encore.dev/config";
import type { 
  ApolloSearchFilters, 
  ApolloSearchResponse, 
  ApolloPerson,
  ApolloEnrichResponse,
  ProspectFromApollo 
} from "./types";

// Apollo API Key - set via: encore secret set ApolloApiKey
const apolloApiKey = secret("ApolloApiKey");

const APOLLO_BASE_URL = "https://api.apollo.io/v1";

/**
 * Apollo.io API Client
 * Handles all communication with Apollo for prospect discovery
 */
export class ApolloClient {
  private _apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this._apiKey = apiKey;
    this.baseUrl = APOLLO_BASE_URL;
  }

  private get apiKey(): string {
    if (!this._apiKey) {
      this._apiKey = apolloApiKey();
    }
    return this._apiKey;
  }

  /**
   * Search for people matching criteria
   */
  async searchPeople(filters: ApolloSearchFilters): Promise<ApolloSearchResponse> {
    const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        ...filters,
        page: filters.page || 1,
        per_page: filters.per_page || 25,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Enrich a single person by email OR by name+company+linkedin
   * This is how we "reveal" emails from Apollo search results
   */
  async enrichPerson(params: {
    email?: string;
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    linkedin_url?: string;
  }): Promise<ApolloEnrichResponse | null> {
    const response = await fetch(`${this.baseUrl}/people/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        email: params.email,
        first_name: params.first_name,
        last_name: params.last_name,
        organization_name: params.organization_name,
        linkedin_url: params.linkedin_url,
        reveal_personal_emails: true, // Request email reveal
      }),
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Bulk enrich people by email
   */
  async bulkEnrich(emails: string[]): Promise<ApolloPerson[]> {
    const response = await fetch(`${this.baseUrl}/people/bulk_match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        details: emails.map(email => ({ email })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.matches || [];
  }

  /**
   * Get organization details
   */
  async getOrganization(domain: string): Promise<any> {
    const url = new URL(`${this.baseUrl}/organizations/enrich`);
    url.searchParams.set("domain", domain);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": this.apiKey,
      },
    });
    
    if (!response.ok) {
      return null;
    }

    return response.json();
  }
}

/**
 * Convert Apollo person to our prospect format
 */
export function apolloToProspect(person: ApolloPerson): ProspectFromApollo {
  const phone = person.phone_numbers?.find(p => p.status === "valid")?.sanitized_number || 
                person.phone_numbers?.[0]?.sanitized_number || 
                null;

  return {
    name: person.name,
    firstName: person.first_name,
    lastName: person.last_name,
    email: person.email,
    emailVerified: person.email_status === "verified",
    phone,
    title: person.title,
    company: person.organization?.name || "",
    companySize: person.organization?.estimated_num_employees || null,
    industry: person.organization?.industry || null,
    linkedinUrl: person.linkedin_url || null,
    location: [person.city, person.state, person.country].filter(Boolean).join(", "),
    source: "apollo",
    apolloId: person.id,
    rawData: person,
  };
}

// Export singleton instance
export const apolloClient = new ApolloClient();

