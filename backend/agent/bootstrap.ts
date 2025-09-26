import { api } from "encore.dev/api";
import { agentDB } from "./db";
import { client } from "~encore/clients";
import { wrapAsync } from "../shared/errors";

export interface BootstrapResponse {
  success: boolean;
  message: string;
  created: {
    client?: any;
    agents?: any[];
  };
}

// Bootstrap sample data for testing
export const bootstrap = api<void, BootstrapResponse>(
  { expose: true, method: "POST", path: "/agents/bootstrap" },
  wrapAsync(async () => {
    try {
      // First, create a sample client
      const sampleClient = await client.create({
        client_name: "Demo CRM Company",
        business_type: "consulting",
        business_description: "A demo consulting company for testing the CRM system",
        enabled_prospect_types: ["customer", "business_builder", "leads"],
        search_config: {
          target_industries: ["technology", "marketing", "sales"],
          target_positions: ["manager", "director", "founder", "ceo"],
          include_keywords: ["business", "consulting", "growth"],
          company_size_range: {
            min: 10,
            max: 500
          }
        },
        messaging_config: {
          brand_name: "Demo CRM",
          value_proposition: "We help businesses grow through intelligent prospecting and automation",
          tone: "professional",
          primary_goal: "Generate qualified leads and build business relationships"
        },
        daily_limits: {
          max_prospects_per_day: 50,
          max_emails_per_day: 100
        }
      });

      // Now create sample agents
      const agents = [];
      
      const agent1 = await agentDB.queryRow`
        INSERT INTO agents (name, client_id, status, prospects_found_today, emails_sent_today, responses_today, last_activity_at) 
        VALUES ('Sarah - Lead Generator', ${sampleClient.id}, 'running', 12, 8, 3, NOW())
        RETURNING *
      `;
      agents.push(agent1);

      const agent2 = await agentDB.queryRow`
        INSERT INTO agents (name, client_id, status, prospects_found_today, emails_sent_today, responses_today, last_activity_at) 
        VALUES ('Mike - Business Development', ${sampleClient.id}, 'paused', 8, 15, 5, NOW() - INTERVAL '2 hours')
        RETURNING *
      `;
      agents.push(agent2);

      const agent3 = await agentDB.queryRow`
        INSERT INTO agents (name, client_id, status, prospects_found_today, emails_sent_today, responses_today, last_activity_at) 
        VALUES ('Alex - Customer Success', ${sampleClient.id}, 'running', 6, 12, 2, NOW() - INTERVAL '30 minutes')
        RETURNING *
      `;
      agents.push(agent3);

      return {
        success: true,
        message: "Sample data created successfully! You now have 3 agents ready to chat with.",
        created: {
          client: sampleClient,
          agents: agents
        }
      };

    } catch (error) {
      console.error("Bootstrap error:", error);
      return {
        success: false,
        message: `Failed to create sample data: ${(error as Error).message}`,
        created: {}
      };
    }
  })
);