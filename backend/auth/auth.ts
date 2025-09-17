import { createClerkClient, verifyToken } from "@clerk/backend";
import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import { auditSecurityEvent } from "../audit/logger";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

interface AuthParams {
  authorization?: Header<"Authorization">;
  session?: Cookie<"session">;
}

export interface AuthData {
  userID: string;
  imageUrl: string;
  email: string | null;
}

// Configure the authorized parties.
const AUTHORIZED_PARTIES = [
  "https://agent-code-refactoring-d33pmes82vjqdcnesll0.lp.dev",
];

export const auth = authHandler<AuthParams, AuthData>(
  async (data: AuthParams) => {
    const req = data as any; // Type workaround for Encore.ts auth handler
    // Resolve the authenticated user from the authorization header or session cookie.
    const token = data.authorization?.replace("Bearer ", "") ?? data.session?.value;
    
    // Extract request metadata for audit logging
    const ipAddress = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'];
    const userAgent = req.headers?.['user-agent'];
    
    if (!token) {
      await auditSecurityEvent(
        'authentication_failed',
        false,
        undefined,
        'auth',
        'WARN',
        { reason: 'missing_token', ip_address: ipAddress, user_agent: userAgent },
        'Missing authentication token'
      );
      throw APIError.unauthenticated("missing token");
    }

    try {
      const verifiedToken = await verifyToken(token, {
        authorizedParties: AUTHORIZED_PARTIES,
        secretKey: clerkSecretKey(),
      });

      const user = await clerkClient.users.getUser(verifiedToken.sub);
      
      // Log successful authentication
      await auditSecurityEvent(
        'authentication_success',
        true,
        user.id,
        'auth',
        'INFO',
        { 
          method: 'clerk_token', 
          ip_address: ipAddress, 
          user_agent: userAgent,
          email: user.emailAddresses[0]?.emailAddress
        }
      );
      
      return {
        userID: user.id,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0]?.emailAddress ?? null,
      };
    } catch (err) {
      await auditSecurityEvent(
        'authentication_failed',
        false,
        undefined,
        'auth',
        'WARN',
        { 
          reason: 'invalid_token', 
          ip_address: ipAddress, 
          user_agent: userAgent,
          error: (err as Error).message 
        },
        'Invalid authentication token'
      );
      throw APIError.unauthenticated("invalid token", err as Error);
    }
  }
);

// Configure the API gateway to use the auth handler.
export const gw = new Gateway({ authHandler: auth });