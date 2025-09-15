import { api } from "encore.dev/api";
import { emailDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";
import { broadcastMessage } from "../realtime/websocket";
import type { EmailResponseData } from "../realtime/types";

export interface TrackEmailResponseRequest {
  email_id: number;
  response_type: "opened" | "clicked" | "replied" | "bounced" | "unsubscribed";
  response_data?: any;
}

export interface TrackEmailResponseResponse {
  success: boolean;
  message: string;
}

// Tracks email responses and sends real-time notifications
export const trackResponse = api<TrackEmailResponseRequest, TrackEmailResponseResponse>(
  { expose: true, method: "POST", path: "/email/track-response" },
  wrapAsync(async (req) => {
    validateField(req.email_id, "email_id", [Rules.required(), Rules.positive(), Rules.integer()]);
    validateField(req.response_type, "response_type", [
      Rules.required(), 
      Rules.oneOf(["opened", "clicked", "replied", "bounced", "unsubscribed"])
    ]);

    // Get email campaign details
    const campaign = await emailDB.queryRow<{
      id: number;
      prospect_id: number;
      subject: string;
      status: string;
      recipient_email: string;
    }>`
      SELECT ec.id, ec.prospect_id, ec.subject, ec.status,
             p.email as recipient_email
      FROM email_campaigns ec
      JOIN prospects p ON ec.prospect_id = p.id
      WHERE ec.id = ${req.email_id}
    `;

    if (!campaign) {
      throw new Error("Email campaign not found");
    }

    // Update campaign status if needed
    if (req.response_type === "replied" || req.response_type === "clicked") {
      await emailDB.exec`
        UPDATE email_campaigns 
        SET status = 'engaged', updated_at = NOW()
        WHERE id = ${req.email_id}
      `;
    }

    // Broadcast email response notification
    const responseData: EmailResponseData = {
      emailId: req.email_id.toString(),
      campaignId: campaign.id.toString(),
      recipientEmail: campaign.recipient_email,
      responseType: req.response_type,
      responseData: req.response_data
    };

    await broadcastMessage({
      type: "email_response",
      data: responseData,
      timestamp: new Date().toISOString()
    }, "email_response");

    return {
      success: true,
      message: `Email ${req.response_type} tracked successfully`
    };
  })
);

// Simulate random email responses for demo purposes
export const simulateResponse = api(
  { expose: true, method: "POST", path: "/email/simulate-response" },
  wrapAsync(async (): Promise<{ message: string }> => {
    // Get recent email campaigns
    const recentEmailsResult = await emailDB.query<{ id: number; recipient_email: string }>`
      SELECT ec.id, p.email as recipient_email
      FROM email_campaigns ec
      JOIN prospects p ON ec.prospect_id = p.id
      WHERE ec.sent_at > NOW() - INTERVAL '1 hour'
      AND ec.status = 'sent'
      ORDER BY ec.sent_at DESC
      LIMIT 5
    `;

    const recentEmails: { id: number; recipient_email: string }[] = [];
    for await (const email of recentEmailsResult) {
      recentEmails.push(email);
    }

    if (recentEmails.length === 0) {
      return { message: "No recent emails to simulate responses for" };
    }

    // Randomly select an email and response type
    const randomEmail = recentEmails[Math.floor(Math.random() * recentEmails.length)];
    const responseTypes = ["opened", "clicked", "replied"];
    const randomResponse = responseTypes[Math.floor(Math.random() * responseTypes.length)];

    // Track the simulated response
    await trackResponse({
      email_id: randomEmail.id,
      response_type: randomResponse as any,
      response_data: { 
        simulated: true, 
        timestamp: new Date().toISOString() 
      }
    });

    return {
      message: `Simulated ${randomResponse} response for email to ${randomEmail.recipient_email}`
    };
  })
);