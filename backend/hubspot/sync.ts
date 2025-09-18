import { api } from "encore.dev/api";
// import { cron } from "encore.dev/cron";
import { hubspotDB } from "./db";
import { HubSpotClient } from "./client";
import { executeAIAction } from "./ai_automation";
import { HubSpotContact, HubSpotDeal } from "./types";

export const syncContacts = api(
  { method: "POST", path: "/sync/contacts/:connectionId", expose: true },
  async ({ connectionId }: { connectionId: string }): Promise<{ synced: number; errors: number }> => {
    const connection = await hubspotDB.queryRow`
      SELECT * FROM hubspot_connections 
      WHERE id = ${connectionId} AND is_active = true
    `;

    if (!connection) {
      throw new Error("Connection not found or inactive");
    }

    const client = new HubSpotClient(connection.access_token);
    let synced = 0;
    let errors = 0;
    let hasMore = true;
    let after: string | undefined;

    while (hasMore) {
      try {
        const response = await client.getContacts(100, after) as any;
        
        for (const contact of (response.results || []) as HubSpotContact[]) {
          try {
            // Check if contact exists in our AI CRM
            const existingContact = await checkContactExists(contact.email);
            
            if (!existingContact) {
              // Trigger AI automation for new contact
              await executeAIAction({
                connection_id: connectionId,
                trigger_data: {
                  email: contact.email,
                  firstname: contact.firstname,
                  lastname: contact.lastname,
                  company_name: contact.company,
                  hubspot_id: (contact as any).id,
                  contact_exists: false
                }
              });
            } else {
              // Update existing contact with latest HubSpot data
              await updateExistingContact(existingContact.id, contact);
            }

            synced++;
            
            await hubspotDB.exec`
              INSERT INTO hubspot_sync_logs (connection_id, operation, hubspot_id, status)
              VALUES (${connectionId}, 'sync_contact', ${contact.id}, 'success')
            `;
            
          } catch (error) {
            errors++;
            await hubspotDB.exec`
              INSERT INTO hubspot_sync_logs (connection_id, operation, hubspot_id, status, error_message)
              VALUES (${connectionId}, 'sync_contact', ${(contact as any).id}, 'error', ${(error as Error).message})
            `;
          }
        }

        hasMore = !!response.paging?.next;
        after = response.paging?.next?.after;
        
      } catch (error) {
        console.error('Error syncing contacts:', error);
        break;
      }
    }

    return { synced, errors };
  }
);

export const syncDeals = api(
  { method: "POST", path: "/sync/deals/:connectionId", expose: true },
  async ({ connectionId }: { connectionId: string }): Promise<{ synced: number; errors: number }> => {
    const connection = await hubspotDB.queryRow`
      SELECT * FROM hubspot_connections 
      WHERE id = ${connectionId} AND is_active = true
    `;

    if (!connection) {
      throw new Error("Connection not found or inactive");
    }

    const client = new HubSpotClient(connection.access_token);
    let synced = 0;
    let errors = 0;
    let hasMore = true;
    let after: string | undefined;

    while (hasMore) {
      try {
        const response = await client.getDeals(100, after) as any;
        
        for (const deal of (response.results || []) as HubSpotDeal[]) {
          try {
            // Check if deal exists in our AI CRM
            const existingDeal = await checkDealExists(deal.id);
            
            if (!existingDeal) {
              // Trigger AI automation for new deal
              await executeAIAction({
                connection_id: connectionId,
                trigger_data: {
                  deal_name: deal.dealname,
                  amount: deal.amount,
                  stage: deal.dealstage,
                  hubspot_deal_id: deal.id,
                  deal_exists: false
                }
              });
            } else {
              // Update existing deal with latest HubSpot data
              await updateExistingDeal(existingDeal.id, deal);
            }

            synced++;
            
            await hubspotDB.exec`
              INSERT INTO hubspot_sync_logs (connection_id, operation, hubspot_id, status)
              VALUES (${connectionId}, 'sync_deal', ${deal.id}, 'success')
            `;
            
          } catch (error) {
            errors++;
            await hubspotDB.exec`
              INSERT INTO hubspot_sync_logs (connection_id, operation, hubspot_id, status, error_message)
              VALUES (${connectionId}, 'sync_deal', ${(deal as any).id}, 'error', ${(error as Error).message})
            `;
          }
        }

        hasMore = !!(response as any).paging?.next;
        after = (response as any).paging?.next?.after;
        
      } catch (error) {
        console.error('Error syncing deals:', error);
        break;
      }
    }

    return { synced, errors };
  }
);

// TODO: Add cron job for automatic sync
// export const autoSync = cron("hubspot-auto-sync", "0 * * * *", async () => {
//   const connections = await hubspotDB.query`
//     SELECT * FROM hubspot_connections WHERE is_active = true
//   `;

//   for (const connection of connections) {
//     try {
//       console.log(`Starting auto-sync for connection ${connection.id}`);
      
//       const contactsResult = await syncContacts({ connectionId: connection.id });
//       const dealsResult = await syncDeals({ connectionId: connection.id });
      
//       console.log(`Auto-sync completed for ${connection.id}:`, {
//         contacts: contactsResult,
//         deals: dealsResult
//       });
      
//     } catch (error) {
//       console.error(`Auto-sync failed for connection ${connection.id}:`, error);
//     }
//   }
// });

// Helper functions to check existing records in AI CRM
async function checkContactExists(email: string): Promise<{ id: string } | null> {
  // This would check against your existing AI CRM contacts table
  // For now, we'll simulate this check
  return null;
}

async function checkDealExists(hubspotDealId: string): Promise<{ id: string } | null> {
  // This would check against your existing AI CRM deals table
  // For now, we'll simulate this check
  return null;
}

async function updateExistingContact(contactId: string, hubspotContact: any) {
  // This would update the existing contact in your AI CRM
  console.log(`Updating contact ${contactId} with HubSpot data:`, hubspotContact);
}

async function updateExistingDeal(dealId: string, hubspotDeal: any) {
  // This would update the existing deal in your AI CRM
  console.log(`Updating deal ${dealId} with HubSpot data:`, hubspotDeal);
}

export const getSyncLogs = api(
  { method: "GET", path: "/sync/logs/:connectionId", expose: true },
  async ({ connectionId, limit = 100 }: { connectionId: string; limit?: number }) => {
    return await hubspotDB.query`
      SELECT * FROM hubspot_sync_logs 
      WHERE connection_id = ${connectionId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }
);

export const getSyncStats = api(
  { method: "GET", path: "/sync/stats/:connectionId", expose: true },
  async ({ connectionId }: { connectionId: string }) => {
    const stats = await hubspotDB.queryRow`
      SELECT 
        COUNT(*) as total_operations,
        COUNT(*) FILTER (WHERE status = 'success') as successful_operations,
        COUNT(*) FILTER (WHERE status = 'error') as failed_operations,
        COUNT(*) FILTER (WHERE operation = 'sync_contact') as contact_syncs,
        COUNT(*) FILTER (WHERE operation = 'sync_deal') as deal_syncs,
        MAX(created_at) as last_sync
      FROM hubspot_sync_logs 
      WHERE connection_id = ${connectionId}
    `;

    return stats;
  }
);