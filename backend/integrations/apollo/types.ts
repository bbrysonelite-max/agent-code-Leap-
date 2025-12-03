// Apollo.io API Types

export interface ApolloConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ApolloSearchFilters {
  // Person filters
  person_titles?: string[];
  person_seniorities?: string[];
  person_locations?: string[];
  
  // Company filters
  organization_industry_tag_ids?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
  organization_revenue_ranges?: string[];
  
  // Contact requirements
  contact_email_status?: string[];
  has_phone?: boolean;
  
  // Pagination
  page?: number;
  per_page?: number;
}

// Request type used by api.ts
export interface ApolloSearchPeopleRequest {
  q_keywords?: string;
  person_titles?: string[];
  person_seniorities?: string[];
  organization_industries?: string[];
  organization_employee_counts?: string[];
  organization_revenues?: string[];
  page?: number;
  per_page?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  email_status: string;
  phone_numbers?: ApolloPhoneNumber[];
  title: string;
  seniority: string;
  linkedin_url: string;
  
  // Organization
  organization_id: string;
  organization?: ApolloOrganization;
  
  // Metadata
  city: string;
  state: string;
  country: string;
}

export interface ApolloPhoneNumber {
  raw_number: string;
  sanitized_number: string;
  type: string;
  position: number;
  status: string;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string;
  linkedin_url: string;
  industry: string;
  estimated_num_employees: number;
  annual_revenue: number;
  city: string;
  state: string;
  country: string;
}

export interface ApolloSearchResponse {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface ApolloEnrichResponse {
  person: ApolloPerson;
}

// Mapped to our system
export interface ProspectFromApollo {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  title: string;
  company: string;
  companySize: number | null;
  industry: string | null;
  linkedinUrl: string | null;
  location: string;
  source: 'apollo';
  apolloId: string;
  rawData: ApolloPerson;
}

