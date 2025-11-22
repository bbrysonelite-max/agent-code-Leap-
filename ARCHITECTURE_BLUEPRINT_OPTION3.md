# 🏗️ Architectural Blueprint - Option 3 (Manual Deployment)

**AI Prospecting Agent Platform**
**Version**: 1.0.0
**Last Updated**: 2025-11-22

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Infrastructure Requirements](#infrastructure-requirements)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Data Architecture](#data-architecture)
7. [Security Architecture](#security-architecture)
8. [Integration Architecture](#integration-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Scaling Strategy](#scaling-strategy)
11. [Cost Analysis](#cost-analysis)

---

## System Overview

### Purpose

The AI Prospecting Agent Platform is an enterprise-grade, AI-powered lead generation and nurturing system designed to automate the entire prospect lifecycle from discovery to conversion.

### Key Capabilities

- **Automated Lead Discovery**: AI agents continuously find and classify prospects
- **Intelligent Scoring**: Multi-factor AI scoring (20+ parameters)
- **Personalized Outreach**: GPT-4o-mini powered email generation
- **CRM Integration**: Bi-directional HubSpot sync
- **Revenue Attribution**: Track deals from first touch to close
- **Multi-tenancy**: Isolated client environments with custom configurations

### Target Scale

- **Users**: 100-10,000+ concurrent users
- **Prospects**: 10,000-1M+ prospects managed
- **Emails**: 10,000-100,000+ emails/day
- **API Requests**: 100K-1M+ requests/day

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                          │
│                      React 19.1 + Vite 6                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │Dashboard │ │Prospects │ │Campaigns │ │ Analytics/Charts │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│         │                                                         │
│         │ TanStack Query (React Query) + shadcn/ui              │
│         ▼                                                         │
└─────────────────────────────────────────────────────────────────┘
         │
         │ HTTPS/WSS (Port 5173 → Nginx → 443)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       REVERSE PROXY LAYER                        │
│                        Nginx / Caddy                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ SSL/TLS      │  │ Load Balance │  │ Rate Limiting       │  │
│  │ Termination  │  │ (Multi-node) │  │ (DDoS Protection)   │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │
         │ HTTP (Port 4000)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER (22 Microservices)            │
│                         Encore.ts Framework                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    CORE SERVICES                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │  Agent   │ │ Prospect │ │ Scoring  │ │   Email   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │Nurturing │ │  AI CRM  │ │ Analytics│ │    AI     │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                INTEGRATION SERVICES                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                │   │
│  │  │ HubSpot  │ │  Stripe  │ │  Clerk   │                │   │
│  │  │   Sync   │ │ Payments │ │   Auth   │                │   │
│  │  └──────────┘ └──────────┘ └──────────┘                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             INFRASTRUCTURE SERVICES                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │  Client  │ │Realtime  │ │  Audit   │ │   GDPR    │  │   │
│  │  │  (Tenant)│ │(WebSocket│ │ Logging  │ │Compliance │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │   Rate   │ │Database  │ │  System  │ │  Shared   │  │   │
│  │  │ Limiting │ │  Perf    │ │  Health  │ │ Utilities │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────┐
│   DATA LAYER         │          │  EXTERNAL SERVICES   │
│                      │          │                      │
│ ┌────────────────┐  │          │ ┌────────────────┐  │
│ │  PostgreSQL 15 │  │          │ │  OpenAI API    │  │
│ │  (Primary DB)  │  │          │ │  (GPT-4o-mini) │  │
│ └────────────────┘  │          │ └────────────────┘  │
│ ┌────────────────┐  │          │ ┌────────────────┐  │
│ │    Redis 7     │  │          │ │  HubSpot API   │  │
│ │   (Cache/Jobs) │  │          │ │  (CRM Sync)    │  │
│ └────────────────┘  │          │ └────────────────┘  │
│ ┌────────────────┐  │          │ ┌────────────────┐  │
│ │  PgBouncer     │  │          │ │   Stripe API   │  │
│ │(Connection Pool│  │          │ │  (Payments)    │  │
│ └────────────────┘  │          │ └────────────────┘  │
│                      │          │ ┌────────────────┐  │
│                      │          │ │  Clerk API     │  │
│                      │          │ │  (Auth)        │  │
│                      │          │ └────────────────┘  │
│                      │          │ ┌────────────────┐  │
│                      │          │ │  SMTP Server   │  │
│                      │          │ │(Email Delivery)│  │
│                      │          │ └────────────────┘  │
└──────────────────────┘          └──────────────────────┘
```

---

## Infrastructure Requirements

### Server Requirements (Option 3: Self-Hosted)

#### Production Server Specifications

| Component | Minimum | Recommended | High-Traffic |
|-----------|---------|-------------|--------------|
| **CPU** | 2 cores | 4 cores | 8+ cores |
| **RAM** | 4GB | 8GB | 16GB+ |
| **Storage** | 50GB SSD | 100GB SSD | 500GB+ NVMe SSD |
| **Network** | 100Mbps | 1Gbps | 10Gbps |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

#### Database Server Specifications

| Component | Minimum | Recommended | High-Traffic |
|-----------|---------|-------------|--------------|
| **CPU** | 2 cores | 4 cores | 8+ cores |
| **RAM** | 4GB | 8GB | 32GB+ |
| **Storage** | 50GB SSD | 250GB SSD | 1TB+ NVMe SSD |
| **IOPS** | 3,000 | 10,000 | 50,000+ |

#### Redis Cache Server

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 1GB | 4GB+ |
| **CPU** | 1 core | 2 cores |
| **Storage** | 10GB | 50GB |

### Software Requirements

```bash
# Core Runtime
- Node.js 18.x or higher
- Bun 1.0+ (package manager)
- Encore CLI 1.40+

# Databases
- PostgreSQL 15.x
- Redis 7.x

# Process Management
- PM2 (for Node.js process management)
- systemd (for service management)

# Web Server
- Nginx 1.24+ or Caddy 2.7+

# SSL/TLS
- Certbot (Let's Encrypt)
- OpenSSL 3.0+

# Monitoring (Optional)
- Prometheus + Grafana
- Sentry (error tracking)
```

### Network Requirements

```
Firewall Rules:
- Inbound:
  - Port 80 (HTTP → redirect to 443)
  - Port 443 (HTTPS)
  - Port 22 (SSH - restricted to admin IPs)

- Outbound:
  - Port 443 (HTTPS - API calls to OpenAI, HubSpot, Stripe, Clerk)
  - Port 587 (SMTP - email sending)
  - Port 5432 (PostgreSQL - if database is external)
  - Port 6379 (Redis - if cache is external)

- Internal (if multi-server):
  - Port 4000 (Backend API)
  - Port 5173 (Frontend dev - production uses static files)
  - Port 5432 (PostgreSQL)
  - Port 6379 (Redis)
```

---

## Backend Architecture

### Microservices Architecture (Encore.ts)

#### Service Categories

**1. Core Business Logic Services**

| Service | Responsibility | Key Endpoints |
|---------|---------------|---------------|
| `agent` | Agent lifecycle management | `/agent/*` |
| `prospect` | Prospect CRUD operations | `/prospect/*` |
| `scoring` | AI-powered lead scoring | `/scoring/*` |
| `email` | Email campaigns & tracking | `/email/*` |
| `nurturing` | Nurturing sequences | `/nurturing/*` |
| `ai_crm` | CRM operations (leads/deals) | `/ai_crm/*` |
| `ai` | OpenAI integration | `/ai/*` |
| `analytics` | Business intelligence | `/analytics/*` |

**2. Integration Services**

| Service | Responsibility | External API |
|---------|---------------|--------------|
| `hubspot` | HubSpot bi-directional sync | HubSpot API v3 |
| `payment` | Stripe payment processing | Stripe API |
| `auth` | User authentication | Clerk API |

**3. Infrastructure Services**

| Service | Responsibility | Purpose |
|---------|---------------|---------|
| `client` | Multi-tenant management | Isolated client configs |
| `realtime` | WebSocket connections | Real-time updates |
| `rate_limiting` | API throttling | Protect against abuse |
| `audit` | Security audit logging | Compliance & forensics |
| `gdpr` | Data privacy compliance | GDPR export/deletion |
| `db_performance` | Database monitoring | Query optimization |
| `system` | Health checks | Uptime monitoring |
| `shared` | Common utilities | Shared helpers |

### Service Communication

```typescript
// Example: Inter-service communication via Encore
import { api } from "encore.dev/api";
import { scoring } from "~encore/clients";

// Agent service calls Scoring service
export const createProspect = api(async (req: CreateProspectRequest) => {
  // Create prospect
  const prospect = await db.prospects.create(req);

  // Call scoring service to score prospect
  const score = await scoring.scoreProspect({
    prospectId: prospect.id,
    factors: extractScoringFactors(prospect)
  });

  // Update prospect with score
  await db.prospects.update(prospect.id, { ai_score: score.totalScore });

  return prospect;
});
```

### Database Schema Architecture

See [DATA_ARCHITECTURE.md](#data-architecture) for detailed schema.

Key principles:
- **Multi-tenancy**: All tables have `client_id` for tenant isolation
- **Audit trails**: `created_at`, `updated_at` on all tables
- **Soft deletes**: Use `deleted_at` instead of hard deletes
- **Indexing**: Indexed on foreign keys and frequently queried columns
- **Partitioning**: Large tables partitioned by date (if needed)

---

## Frontend Architecture

### Technology Stack

```typescript
// Core Framework
React 19.1           // Latest React with concurrent features
Vite 6               // Lightning-fast build tool
TypeScript 5.9       // Type safety

// Routing & State
React Router 7       // Client-side routing
TanStack Query 5.89  // Server state management

// UI Components
shadcn/ui            // Accessible component library
Radix UI             // Headless UI primitives
Tailwind CSS 4.1     // Utility-first CSS
Lucide React         // Icon library
Recharts 2.15        // Data visualization
```

### Component Architecture

```
frontend/
├── components/
│   ├── ui/                    # shadcn/ui components (20+)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── Dashboard.tsx          # Main dashboard
│   ├── AgentControls.tsx      # Agent management
│   ├── ProspectManagement.tsx # Prospect list/CRUD
│   ├── EmailCampaigns.tsx     # Campaign builder
│   ├── Analytics.tsx          # Analytics dashboard
│   ├── AICRMDashboard.tsx     # AI CRM overview
│   ├── LeadsManagement.tsx    # Lead pipeline
│   ├── DealsManagement.tsx    # Deal management
│   └── ClientManagement.tsx   # Multi-tenant admin
├── hooks/                     # Custom React hooks (18)
│   ├── useAgents.ts
│   ├── useProspects.ts
│   ├── useScoring.ts
│   ├── useEmailCampaigns.ts
│   └── ...
├── lib/
│   ├── api.ts                 # API client (Encore generated)
│   ├── utils.ts               # Utility functions
│   └── queryClient.ts         # React Query config
└── main.tsx                   # App entry point
```

### State Management Strategy

```typescript
// Server State: TanStack Query
import { useQuery, useMutation } from "@tanstack/react-query";

// Fetch prospects with caching
const { data: prospects } = useQuery({
  queryKey: ["prospects", filters],
  queryFn: () => api.prospect.list(filters),
  staleTime: 30_000, // Cache for 30s
});

// Create prospect with optimistic updates
const createProspect = useMutation({
  mutationFn: api.prospect.create,
  onSuccess: () => {
    queryClient.invalidateQueries(["prospects"]);
  },
});

// Client State: React useState/useContext
// Used minimally - prefer server state
```

### Routing Architecture

```typescript
// React Router 7 configuration
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { path: "dashboard", element: <Dashboard /> },
      { path: "clients", element: <ClientManagement /> },
      { path: "prospects", element: <ProspectManagement /> },
      { path: "priority", element: <PriorityProspects /> },
      { path: "campaigns", element: <EmailCampaigns /> },
      { path: "analytics", element: <Analytics /> },
      { path: "agent", element: <AgentControls /> },
      { path: "ai-crm/*", element: <AICRMRouter /> },
      { path: "payments", element: <PaymentDashboard /> },
    ],
  },
]);
```

---

## Data Architecture

### Database Schema

#### Core Tables

**agents**
```sql
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES client_configurations(id),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('stopped', 'running', 'paused')),
  prospects_found_today INTEGER DEFAULT 0,
  emails_sent_today INTEGER DEFAULT 0,
  responses_today INTEGER DEFAULT 0,
  last_activity_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_client_id ON agents(client_id);
CREATE INDEX idx_agents_status ON agents(status);
```

**prospects**
```sql
CREATE TABLE prospects (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  client_id INTEGER NOT NULL REFERENCES client_configurations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  linkedin_profile TEXT,
  company VARCHAR(255),
  position VARCHAR(255),
  prospect_type VARCHAR(50) NOT NULL,
  custom_prospect_type VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  notes TEXT,
  ai_score DECIMAL(5,2),
  priority VARCHAR(10),
  score_reasons JSONB,
  last_scored_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prospects_client_id ON prospects(client_id);
CREATE INDEX idx_prospects_agent_id ON prospects(agent_id);
CREATE INDEX idx_prospects_email ON prospects(email);
CREATE INDEX idx_prospects_ai_score ON prospects(ai_score DESC);
CREATE INDEX idx_prospects_priority ON prospects(priority);
```

**client_configurations** (Multi-tenancy)
```sql
CREATE TABLE client_configurations (
  id SERIAL PRIMARY KEY,
  client_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) NOT NULL,
  business_description TEXT,
  enabled_prospect_types JSONB NOT NULL,
  custom_prospect_types JSONB,
  search_config JSONB NOT NULL,
  messaging_config JSONB NOT NULL,
  daily_limits JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_client_configurations_active ON client_configurations(is_active);
```

#### AI CRM Tables

**leads**
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id INTEGER NOT NULL REFERENCES client_configurations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(255),
  position VARCHAR(255),
  source VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  ai_score DECIMAL(5,2) NOT NULL,
  ai_qualification TEXT,
  next_best_action TEXT,
  priority VARCHAR(20) NOT NULL,
  assigned_to VARCHAR(255),
  linkedin_profile TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP
);

CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_ai_score ON leads(ai_score DESC);
```

**deals**
```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id INTEGER NOT NULL REFERENCES client_configurations(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  name VARCHAR(255) NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  stage VARCHAR(50) NOT NULL,
  probability INTEGER NOT NULL CHECK (probability BETWEEN 0 AND 100),
  ai_win_probability DECIMAL(5,2),
  ai_risk_factors JSONB,
  ai_recommendations JSONB,
  expected_close_date DATE,
  actual_close_date DATE,
  assigned_to VARCHAR(255),
  source VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deals_client_id ON deals(client_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_value ON deals(value DESC);
```

### Data Flow

```
1. Lead Discovery
   User → Agent Service → Prospect Service → PostgreSQL

2. Lead Scoring
   Prospect Service → Scoring Service → AI Service → OpenAI API
   → Scoring Service → PostgreSQL (update score)

3. Email Campaign
   User → Email Service → AI Service → OpenAI (generate content)
   → SMTP Server → Prospect Email
   → Email Service → PostgreSQL (track engagement)

4. CRM Sync
   HubSpot Webhook → HubSpot Service → AI CRM Service → PostgreSQL
   PostgreSQL → AI CRM Service → HubSpot Service → HubSpot API

5. Real-time Updates
   Backend Service → PostgreSQL → Realtime Service → WebSocket
   → Frontend → UI Update
```

---

## Security Architecture

### Authentication & Authorization

```typescript
// Clerk JWT validation middleware
import { AuthHandler } from "encore.dev/auth";

interface AuthParams {
  authorization: string;
}

export const authHandler = new AuthHandler<AuthParams>(async (params) => {
  const token = params.authorization?.replace("Bearer ", "");

  // Verify JWT with Clerk
  const session = await verifyToken(token);

  return {
    userID: session.userId,
    userRole: session.role,
    clientId: session.clientId, // Multi-tenant isolation
  };
});

// Protected endpoint
export const createAgent = api(
  { auth: true },
  async (req: CreateAgentRequest): Promise<Agent> => {
    const { userID, clientId } = authHandler.data;

    // Ensure user can only create agents for their client
    if (req.clientId !== clientId) {
      throw new Error("Unauthorized: Client ID mismatch");
    }

    // Create agent...
  }
);
```

### Multi-Tenant Isolation

```typescript
// Row-level security via application logic
export async function getProspects(clientId: number, userId: string) {
  // Always filter by client_id
  return db.prospects.findMany({
    where: {
      client_id: clientId,
      // Additional user-level filters if needed
    },
  });
}

// PostgreSQL Row-Level Security (RLS) - Optional
-- Enable RLS on all tables
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON prospects
  FOR ALL
  USING (client_id = current_setting('app.client_id')::INTEGER);
```

### Data Encryption

```yaml
# At Rest
- Database: PostgreSQL encryption at rest (cloud provider or LUKS)
- Backups: Encrypted backups (GPG or cloud encryption)
- Secrets: Encrypted in .env or secrets manager

# In Transit
- HTTPS: TLS 1.3 (Let's Encrypt certificates)
- Database: SSL/TLS connections (sslmode=require)
- Redis: TLS-encrypted connections
- API calls: HTTPS to OpenAI, HubSpot, Stripe, Clerk
```

### API Security

```typescript
// Rate limiting by tier
import { RateLimiter } from "~encore/clients";

export const createProspect = api(async (req: CreateProspectRequest) => {
  const userId = authHandler.data.userID;

  // Check rate limit based on user tier
  const allowed = await RateLimiter.checkLimit({
    userId,
    endpoint: "prospect.create",
    limit: userTier === "enterprise" ? 1000 : 50, // per minute
  });

  if (!allowed) {
    throw APIError.resourceExhausted("Rate limit exceeded");
  }

  // Validate input
  if (!isValidEmail(req.email)) {
    throw APIError.invalidArgument("Invalid email");
  }

  // Sanitize input (prevent SQL injection, XSS)
  const sanitized = sanitizeProspectData(req);

  // Create prospect...
});
```

### Audit Logging

```typescript
// Audit all sensitive operations
import { audit } from "~encore/clients";

export const deleteProspect = api(async (req: DeleteProspectRequest) => {
  const { userID, clientId } = authHandler.data;

  // Log deletion attempt
  await audit.log({
    action: "prospect.delete",
    userId: userID,
    clientId: clientId,
    resourceType: "prospect",
    resourceId: req.prospectId,
    ipAddress: req.ipAddress,
    userAgent: req.userAgent,
    timestamp: new Date(),
  });

  // Soft delete
  await db.prospects.update(req.prospectId, { deleted_at: new Date() });

  return { success: true };
});
```

---

## Integration Architecture

### External Service Integration

#### OpenAI Integration

```typescript
// AI Service: OpenAI GPT-4o-mini integration
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OpenAIKey,
});

export const generateEmail = api(async (req: GenerateEmailRequest) => {
  const prompt = `
    Generate a personalized email for:
    Name: ${req.prospectName}
    Company: ${req.company}
    Position: ${req.position}

    Goal: ${req.goal}
    Tone: ${req.tone}

    Email should be professional, concise, and include a clear call-to-action.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert sales copywriter." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return {
    subject: extractSubject(response.choices[0].message.content),
    body: extractBody(response.choices[0].message.content),
  };
});
```

#### HubSpot Integration

```typescript
// HubSpot Service: Bi-directional sync
import { Client } from "@hubspot/api-client";

const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_API_KEY,
});

export const syncContactToHubSpot = api(async (req: SyncContactRequest) => {
  const contact = await db.leads.findUnique(req.leadId);

  // Create or update in HubSpot
  const hubspotContact = await hubspotClient.crm.contacts.basicApi.create({
    properties: {
      email: contact.email,
      firstname: contact.name.split(" ")[0],
      lastname: contact.name.split(" ")[1],
      company: contact.company,
      jobtitle: contact.position,
      hs_lead_status: contact.status,
      ai_score: contact.ai_score,
    },
  });

  // Store HubSpot ID for future sync
  await db.leads.update(req.leadId, {
    hubspot_id: hubspotContact.id,
  });

  return { success: true, hubspotId: hubspotContact.id };
});

// Webhook endpoint for HubSpot updates
export const hubspotWebhook = api(async (req: WebhookRequest) => {
  // Verify webhook signature
  if (!verifyHubSpotSignature(req.signature, req.body)) {
    throw APIError.unauthenticated("Invalid webhook signature");
  }

  // Process contact update
  const hubspotContact = req.body;

  // Update local database
  await db.leads.update(
    { hubspot_id: hubspotContact.id },
    {
      status: hubspotContact.properties.hs_lead_status,
      updated_at: new Date(),
    }
  );

  return { success: true };
});
```

#### Stripe Integration

```typescript
// Payment Service: Stripe integration
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export const createSubscription = api(async (req: CreateSubscriptionRequest) => {
  const { userId, clientId, tier } = authHandler.data;

  // Create customer
  const customer = await stripe.customers.create({
    email: req.email,
    name: req.name,
    metadata: {
      userId,
      clientId,
    },
  });

  // Create subscription
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      { price: getPriceIdForTier(tier) }, // basic, premium, enterprise
    ],
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  });

  // Save subscription to database
  await db.subscriptions.create({
    user_id: userId,
    client_id: clientId,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
    tier: tier,
    status: subscription.status,
  });

  return {
    subscriptionId: subscription.id,
    clientSecret: subscription.latest_invoice.payment_intent.client_secret,
  };
});
```

---

## Deployment Architecture (Option 3: Manual)

### Server Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Server                         │
│                   (Ubuntu 22.04 LTS)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Nginx (Port 80/443)                                   │  │
│  │  - SSL/TLS termination                                │  │
│  │  - Reverse proxy                                      │  │
│  │  - Static file serving (frontend/dist)               │  │
│  │  - Gzip compression                                   │  │
│  │  - Request logging                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Backend (PM2)                                         │  │
│  │  - Encore.ts runtime (Port 4000)                      │  │
│  │  - 22 microservices                                   │  │
│  │  - Auto-restart on crash                              │  │
│  │  - Cluster mode (4 workers)                           │  │
│  │  - Log rotation                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PostgreSQL 15 (Port 5432)                             │  │
│  │  - Primary database                                   │  │
│  │  - Auto-vacuum enabled                                │  │
│  │  - Daily backups (pg_dump)                            │  │
│  │  - Connection pooling (PgBouncer)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Redis 7 (Port 6379)                                   │  │
│  │  - Session storage                                    │  │
│  │  - Cache layer                                        │  │
│  │  - Job queue (background tasks)                       │  │
│  │  - Pub/Sub (real-time features)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Monitoring & Logging                                  │  │
│  │  - PM2 monitoring                                     │  │
│  │  - Nginx access/error logs                            │  │
│  │  - PostgreSQL slow query log                          │  │
│  │  - Sentry (error tracking)                            │  │
│  │  - Prometheus + Grafana (optional)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```bash
/opt/ai-prospecting-agent/
├── backend/                 # Encore.ts backend
│   ├── node_modules/
│   ├── agent/
│   ├── prospect/
│   ├── scoring/
│   ├── ... (19 more services)
│   ├── encore.app
│   └── .env
├── frontend/                # React frontend
│   └── dist/               # Built static files (served by Nginx)
├── logs/
│   ├── backend/
│   ├── nginx/
│   └── postgresql/
├── backups/
│   └── postgresql/
└── scripts/
    ├── deploy.sh
    ├── backup.sh
    └── restore.sh
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/ai-prospecting-agent
upstream backend {
    # PM2 cluster mode - 4 workers
    server 127.0.0.1:4000;
    server 127.0.0.1:4001;
    server 127.0.0.1:4002;
    server 127.0.0.1:4003;
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Frontend (static files)
    location / {
        root /opt/ai-prospecting-agent/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket (real-time features)
    location /ws {
        proxy_pass http://backend/realtime;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Health check
    location /health {
        proxy_pass http://backend/system/health;
        access_log off;
    }
}
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "ai-prospecting-backend",
      script: "encore",
      args: "run --env production",
      cwd: "/opt/ai-prospecting-agent/backend",
      instances: 4, // Cluster mode
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      error_file: "/opt/ai-prospecting-agent/logs/backend/error.log",
      out_file: "/opt/ai-prospecting-agent/logs/backend/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
```

### Deployment Script

```bash
#!/bin/bash
# /opt/ai-prospecting-agent/scripts/deploy.sh

set -e # Exit on error

echo "🚀 Starting deployment..."

# Pull latest code
cd /opt/ai-prospecting-agent
git pull origin main

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
bun install

# Install frontend dependencies and build
echo "📦 Building frontend..."
cd ../frontend
bun install
bun run build

# Run database migrations
echo "🗄️  Running database migrations..."
cd ../backend
encore db migrate

# Restart backend with PM2
echo "🔄 Restarting backend..."
pm2 reload ecosystem.config.js

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deployment complete!"
```

---

## Scaling Strategy

### Horizontal Scaling

```yaml
# Load Balancer Configuration (HAProxy/Nginx)
upstream backend_cluster {
    least_conn; # Least connections algorithm

    server backend-1.internal:4000 max_fails=3 fail_timeout=30s;
    server backend-2.internal:4000 max_fails=3 fail_timeout=30s;
    server backend-3.internal:4000 max_fails=3 fail_timeout=30s;
    server backend-4.internal:4000 max_fails=3 fail_timeout=30s;

    keepalive 32;
}

# Health checks
health_check interval=10s fails=3 passes=2 uri=/health;
```

### Database Scaling

```sql
-- Read Replicas for Analytics
-- Primary: Read/Write
-- Replica 1: Analytics queries
-- Replica 2: Reporting queries

-- Configure in Encore
database analytics_replica {
  connectionString: process.env.ANALYTICS_DB_URL
}

-- Use replica for expensive queries
export const getAnalytics = api(async () => {
  // Route to read replica
  const data = await analytics_replica.query(`
    SELECT ...
    FROM daily_analytics
    WHERE ...
  `);

  return data;
});
```

### Caching Strategy

```typescript
// Multi-layer caching
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export const getProspectScore = api(async (req: GetScoreRequest) => {
  // L1: In-memory cache (LRU)
  const memCached = scoreCache.get(req.prospectId);
  if (memCached) return memCached;

  // L2: Redis cache
  const redisCached = await redis.get(`score:${req.prospectId}`);
  if (redisCached) {
    const score = JSON.parse(redisCached);
    scoreCache.set(req.prospectId, score); // Populate L1
    return score;
  }

  // L3: Database
  const score = await db.prospect_scores.findUnique(req.prospectId);

  // Populate caches
  await redis.setex(`score:${req.prospectId}`, 3600, JSON.stringify(score));
  scoreCache.set(req.prospectId, score);

  return score;
});
```

### Auto-Scaling Triggers

```yaml
# Based on metrics
CPU Usage > 70% for 5 minutes → Scale up
Memory Usage > 80% for 5 minutes → Scale up
API Response Time > 1s (p95) for 10 minutes → Scale up
Request Rate > 1000 req/s → Scale up

# Scale down
CPU Usage < 30% for 15 minutes → Scale down
Request Rate < 200 req/s for 15 minutes → Scale down

# Limits
Min instances: 2
Max instances: 10 (or based on budget)
```

---

## Cost Analysis (Option 3: Self-Hosted)

### Monthly Cost Breakdown

| Component | Provider | Specs | Monthly Cost |
|-----------|----------|-------|--------------|
| **VPS Server** | DigitalOcean/Linode/Hetzner | 8GB RAM, 4 CPU, 160GB SSD | $40-80 |
| **Database** | Self-hosted PostgreSQL | (included in VPS) | $0 |
| **Redis** | Self-hosted Redis | (included in VPS) | $0 |
| **Domain** | Namecheap | 1 domain | $12/year (~$1/mo) |
| **SSL Certificate** | Let's Encrypt | Free | $0 |
| **Backups** | Backblaze B2 | 100GB storage | $5 |
| **OpenAI API** | OpenAI | 1000 prospects/mo | $15-25 |
| **Email Sending** | SendGrid/SMTP | 5000 emails/mo | $15 |
| **Monitoring** | Sentry Free Tier | <5k events | $0 |
| **Total** | | | **$76-126/month** |

### Cost Comparison

| Deployment Option | Monthly Cost | Pros | Cons |
|-------------------|--------------|------|------|
| **Option 1: Encore Cloud** | $150-250 | Managed, auto-scaling, zero ops | Higher cost, vendor lock-in |
| **Option 2: Docker** | $80-150 | Easy deployment, portable | Requires container knowledge |
| **Option 3: Manual** | $76-126 | **Lowest cost**, full control | **Most complex**, requires DevOps skills |

### Cost Optimization Tips

```bash
# 1. Use reserved instances (40% savings)
# 2. Compress static assets (reduce bandwidth)
# 3. Optimize OpenAI usage:
   - Cache AI-generated content
   - Batch requests
   - Use cheaper models for simple tasks

# 4. Database optimization:
   - Regular VACUUM
   - Index unused columns
   - Archive old data

# 5. CDN for static assets (CloudFlare free tier)
# 6. Optimize email sending:
   - Remove inactive subscribers
   - Use sendmail for transactional emails (free)
```

---

## Appendix

### Key Technologies

- **Backend Framework**: Encore.ts (TypeScript microservices)
- **Frontend Framework**: React 19.1 + Vite 6
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **AI**: OpenAI GPT-4o-mini
- **Auth**: Clerk
- **Payments**: Stripe
- **Process Manager**: PM2
- **Web Server**: Nginx
- **SSL**: Let's Encrypt (Certbot)

### Useful Commands

```bash
# Backend
cd backend && encore run              # Start backend
encore db shell agent                 # Database shell
encore logs                           # View logs
encore gen client --output ../frontend/client.ts  # Generate API client

# Frontend
cd frontend && bun run dev            # Dev server
bun run build                         # Production build
bun run preview                       # Preview build

# PM2
pm2 start ecosystem.config.js         # Start app
pm2 reload ecosystem.config.js        # Reload (zero-downtime)
pm2 logs                              # View logs
pm2 monit                             # Monitor resources
pm2 list                              # List apps

# Nginx
sudo nginx -t                         # Test config
sudo systemctl reload nginx           # Reload config
sudo systemctl status nginx           # Check status

# Database
pg_dump -U postgres agent > backup.sql  # Backup
psql -U postgres agent < backup.sql     # Restore
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-22
**Next Review**: 2026-02-22
