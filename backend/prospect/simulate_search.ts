import { api } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ClientConfiguration } from "../client/types";
import { validateField, Rules } from "../shared/validation";
import { executeQuery, insertRow } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { broadcastMessage } from "../realtime/websocket";
import type { ProspectDiscoveryData } from "../realtime/types";

export interface SimulateSearchRequest {
  agent_id: number;
  count?: number;
}

export interface SimulateSearchResponse {
  prospects: Prospect[];
  message: string;
}

// Simulates prospect search based on client configuration and adds them to the database.
export const simulateSearch = api<SimulateSearchRequest, SimulateSearchResponse>(
  { expose: true, method: "POST", path: "/prospects/simulate-search" },
  wrapAsync(async (req) => {
    // Validate input
    validateField(req.agent_id, "agent_id", [Rules.required(), Rules.positive(), Rules.integer()]);
    if (req.count !== undefined) {
      validateField(req.count, "count", [Rules.positive(), Rules.integer(), Rules.max(20)]);
    }
    const count = req.count || 5;
    
    // Get agent and client configuration
    const agentInfo = await executeQuery(
      () => prospectDB.queryRow<{ client_id: number }>`
        SELECT client_id FROM agents WHERE id = ${req.agent_id}
      `,
      "get agent client"
    );
    
    if (!agentInfo) {
      throw new BusinessLogicError("Agent not found");
    }
    
    const clientConfig = await executeQuery(
      () => prospectDB.queryRow<ClientConfiguration>`
        SELECT * FROM client_configurations 
        WHERE id = ${agentInfo.client_id} AND is_active = true
      `,
      "get client config"
    );
    
    if (!clientConfig) {
      throw new BusinessLogicError("Client configuration not found or inactive");
    }
    
    // Generate dynamic prospect data based on client configuration
    const generateMockProspects = (config: ClientConfiguration) => {
      const baseProspects = [
        { name: "Sarah Johnson", email: "sarah.johnson@techcorp.com", company: "TechCorp Solutions", position: "Marketing Director" },
        { name: "Michael Chen", email: "m.chen@innovate.co", company: "Innovate Co", position: "Sales Manager" },
        { name: "Emily Rodriguez", email: "emily.r@wellness.com", company: "Wellness First", position: "Wellness Coach" },
        { name: "David Thompson", email: "david@startup.io", company: "Startup IO", position: "Founder & CEO" },
        { name: "Lisa Park", email: "lisa.park@beauty.com", company: "Beauty Brands", position: "Brand Manager" },
        { name: "Robert Williams", email: "rob@consulting.biz", company: "Business Consulting Group", position: "Senior Consultant" },
        { name: "Jennifer Lee", email: "jen.lee@healthco.com", company: "HealthCo", position: "Product Manager" },
        { name: "Mark Anderson", email: "mark@growth.agency", company: "Growth Agency", position: "Growth Manager" },
        { name: "Amanda Davis", email: "amanda@realtygroup.com", company: "Premier Realty", position: "Real Estate Agent" },
        { name: "Kevin Miller", email: "kevin@insurancepro.com", company: "Insurance Pro", position: "Insurance Broker" },
      ];
      
      const prospectTypes = config.enabled_prospect_types;
      const businessType = config.business_type;
      
      return baseProspects.map((prospect, index) => {
        // Cycle through enabled prospect types
        const prospectType = prospectTypes[index % prospectTypes.length];
        
        // Adjust company/position based on business type and prospect type
        let adjustedCompany = prospect.company;
        let adjustedPosition = prospect.position;
        
        if (businessType === 'network_marketing' || businessType === 'direct_sales') {
          if (prospectType === 'distributor' || prospectType === 'business_builder') {
            adjustedPosition = Math.random() > 0.5 ? "Entrepreneur" : "Sales Professional";
          }
        } else if (businessType === 'real_estate') {
          if (prospectType === 'customer') {
            adjustedPosition = "Homebuyer";
          } else if (prospectType === 'partners') {
            adjustedPosition = "Real Estate Agent";
          }
        }
        
        return {
          ...prospect,
          company: adjustedCompany,
          position: adjustedPosition,
          linkedin_profile: `https://linkedin.com/in/${prospect.name.toLowerCase().replace(' ', '')}`,
          prospect_type: prospectType,
        };
      });
    };
    
    const mockProspects = generateMockProspects(clientConfig);

    const prospects: Prospect[] = [];
    const searchId = `search_${Date.now()}_${req.agent_id}`;
    
    // Broadcast search started
    await broadcastMessage({
      type: "prospect_discovery",
      data: {
        searchId,
        prospectCount: 0,
        status: "searching"
      } as ProspectDiscoveryData,
      timestamp: new Date().toISOString()
    }, "prospect_discovery");
    
    for (let i = 0; i < Math.min(count, mockProspects.length); i++) {
      const mockData = mockProspects[i];
      
      try {
        const row = await insertRow(
          () => prospectDB.queryRow<Prospect>`
            INSERT INTO prospects (
              agent_id, client_id, name, email, linkedin_profile, company, position, prospect_type
            ) VALUES (
              ${req.agent_id}, ${agentInfo.client_id}, ${mockData.name}, ${mockData.email}, 
              ${mockData.linkedin_profile}, ${mockData.company}, 
              ${mockData.position}, ${mockData.prospect_type}
            )
            RETURNING *
          `,
          "prospect"
        );
        prospects.push(row);
        
        // Broadcast each new prospect found
        await broadcastMessage({
          type: "prospect_discovery",
          data: {
            searchId,
            prospectCount: prospects.length,
            status: "found",
            prospect: row
          } as ProspectDiscoveryData,
          timestamp: new Date().toISOString()
        }, "prospect_discovery");
        
      } catch (error) {
        // Skip duplicate prospects but continue with others
        console.warn(`Skipped duplicate prospect: ${mockData.email}`);
      }
    }
    
    // Broadcast search completed
    await broadcastMessage({
      type: "prospect_discovery",
      data: {
        searchId,
        prospectCount: prospects.length,
        status: "completed"
      } as ProspectDiscoveryData,
      timestamp: new Date().toISOString()
    }, "prospect_discovery");

    // Update agent's daily count
    await executeQuery(
      () => prospectDB.exec`
        UPDATE agents 
        SET prospects_found_today = prospects_found_today + ${prospects.length},
            last_activity_at = NOW()
        WHERE id = ${req.agent_id}
      `,
      "update agent prospect count"
    );

    return {
      prospects,
      message: `Found ${prospects.length} new ${clientConfig.messaging_config.primary_goal} prospects for ${clientConfig.messaging_config.brand_name}`,
    };
  })
);
