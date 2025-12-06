const APOLLO_BASE_URL = "https://api.apollo.io/v1";

export class ApolloClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchPeople(filters: any): Promise<any> {
    const response = await fetch(`${APOLLO_BASE_URL}/mixed_people/search`, {
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

  async enrichPerson(params: {
    email?: string;
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    linkedin_url?: string;
  }): Promise<any | null> {
    const response = await fetch(`${APOLLO_BASE_URL}/people/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        ...params,
        reveal_personal_emails: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

