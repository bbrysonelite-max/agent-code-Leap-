import { api } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect } from "../agent/types";

export interface SimulateSearchRequest {
  agent_id: number;
  count?: number;
}

export interface SimulateSearchResponse {
  prospects: Prospect[];
  message: string;
}

// Simulates LinkedIn-style prospect search and adds them to the database.
export const simulateSearch = api<SimulateSearchRequest, SimulateSearchResponse>(
  { expose: true, method: "POST", path: "/prospects/simulate-search" },
  async (req) => {
    const count = req.count || 5;
    
    // Simulate prospect data
    const mockProspects = [
      {
        name: "Sarah Johnson",
        email: "sarah.johnson@techcorp.com",
        linkedin_profile: "https://linkedin.com/in/sarahjohnson",
        company: "TechCorp Solutions",
        position: "Marketing Director",
        classification: "business_builder" as const,
      },
      {
        name: "Michael Chen",
        email: "m.chen@innovate.co",
        linkedin_profile: "https://linkedin.com/in/michaelchen",
        company: "Innovate Co",
        position: "Sales Manager",
        classification: "business_builder" as const,
      },
      {
        name: "Emily Rodriguez",
        email: "emily.r@wellness.com",
        linkedin_profile: "https://linkedin.com/in/emilyrodriguez",
        company: "Wellness First",
        position: "Wellness Coach",
        classification: "product_customer" as const,
      },
      {
        name: "David Thompson",
        email: "david@startup.io",
        linkedin_profile: "https://linkedin.com/in/davidthompson",
        company: "Startup IO",
        position: "Founder & CEO",
        classification: "business_builder" as const,
      },
      {
        name: "Lisa Park",
        email: "lisa.park@beauty.com",
        linkedin_profile: "https://linkedin.com/in/lisapark",
        company: "Beauty Brands",
        position: "Brand Manager",
        classification: "product_customer" as const,
      },
      {
        name: "Robert Williams",
        email: "rob@consulting.biz",
        linkedin_profile: "https://linkedin.com/in/robertwilliams",
        company: "Business Consulting Group",
        position: "Senior Consultant",
        classification: "business_builder" as const,
      },
      {
        name: "Jennifer Lee",
        email: "jen.lee@healthco.com",
        linkedin_profile: "https://linkedin.com/in/jenniferlee",
        company: "HealthCo",
        position: "Product Manager",
        classification: "product_customer" as const,
      },
      {
        name: "Mark Anderson",
        email: "mark@growth.agency",
        linkedin_profile: "https://linkedin.com/in/markanderson",
        company: "Growth Agency",
        position: "Growth Manager",
        classification: "business_builder" as const,
      },
    ];

    const prospects: Prospect[] = [];
    
    for (let i = 0; i < Math.min(count, mockProspects.length); i++) {
      const mockData = mockProspects[i];
      
      const row = await prospectDB.queryRow<Prospect>`
        INSERT INTO prospects (
          agent_id, name, email, linkedin_profile, company, position, classification
        ) VALUES (
          ${req.agent_id}, ${mockData.name}, ${mockData.email}, 
          ${mockData.linkedin_profile}, ${mockData.company}, 
          ${mockData.position}, ${mockData.classification}
        )
        RETURNING *
      `;
      
      if (row) {
        prospects.push(row);
      }
    }

    // Update agent's daily count
    await prospectDB.exec`
      UPDATE agents 
      SET prospects_found_today = prospects_found_today + ${prospects.length},
          last_activity_at = NOW()
      WHERE id = ${req.agent_id}
    `;

    return {
      prospects,
      message: `Found ${prospects.length} new prospects from LinkedIn search simulation`,
    };
  }
);
