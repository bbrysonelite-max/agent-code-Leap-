# System Architecture

## Overview

The Leap AI CRM Platform is a microservices-based, full-stack application built with Encore.ts (backend) and React 19 (frontend). It provides intelligent lead nurturing, AI-powered scoring, multi-channel communication, and comprehensive CRM capabilities.

## Architecture Principles

1. **Microservices**: Each business domain is an independent Encore.ts service
2. **Type Safety**: Full TypeScript throughout the stack
3. **Offline-First**: React Query with persistence for optimal UX
4. **Real-time**: WebSocket-based notifications and updates
5. **Scalability**: PostgreSQL + Redis for data/cache layers
6. **Security**: Clerk authentication, GDPR compliance, audit logging

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend Layer                       │
│  React 19 + TypeScript + Tailwind CSS + shadcn/ui           │
│  React Query (offline-first, optimistic updates)             │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP/WebSocket
             │
┌────────────▼────────────────────────────────────────────────┐
│                     API Gateway (Encore)                     │
│           Authentication + Rate Limiting + CORS              │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│                    Microservices Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Agent   │  │  AI CRM  │  │ Nurturing│  │ Analytics│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Email   │  │  Payment │  │ HubSpot  │  │ Realtime │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Scoring  │  │  Client  │  │ Prospect │  │   Auth   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   GDPR   │  │   Audit  │  │  DB Perf │  │  System  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐                                │
│  │Rate Limit│  │    AI    │                                │
│  └──────────┘  └──────────┘                                │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌────────────────────┐      ┌──────────────────────┐      │
│  │   PostgreSQL 15    │      │     Redis 7          │      │
│  │  (Primary Store)   │      │  (Cache + PubSub)    │      │
│  └────────────────────┘      └──────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│                   External Integrations                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  OpenAI  │  │  Stripe  │  │ HubSpot  │  │  Clerk   │   │
│  │   API    │  │ Payments │  │   CRM    │  │   Auth   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend (Encore.ts)
- **Runtime**: Bun
- **Framework**: Encore.ts 1.50+
- **Language**: TypeScript 5.9
- **Database**: PostgreSQL 15 (via Encore ORM)
- **Cache**: Redis 7
- **Authentication**: Clerk Backend SDK
- **AI**: OpenAI API
- **Payments**: Stripe API

### Frontend (React)
- **Runtime**: Bun
- **Framework**: React 19.1 + React Router 7
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4 + @tailwindcss/oxide
- **UI Components**: shadcn/ui + Radix UI
- **State Management**: TanStack Query 5 (React Query)
- **Authentication**: Clerk React SDK
- **Charts**: Recharts
- **Build**: Vite 6

### Infrastructure
- **Container**: Docker + Docker Compose
- **Reverse Proxy**: Encore built-in
- **Package Manager**: Bun
- **Testing**: Vitest

## Service Architecture

### Core Services

#### 1. Agent Service
**Purpose**: AI agent lifecycle management and control
**Key Features**:
- Agent creation/deletion
- Status management (running/stopped/paused)
- Activity tracking
- Bootstrap agent operations
- Chat interface

**Database Tables**:
- `agents`: Agent metadata and status

**Key Endpoints**:
- `POST /agent/create` - Create new agent
- `GET /agent/list` - List all agents
- `POST /agent/control/:id` - Control agent (start/stop/pause)
- `POST /agent/chat` - Send message to agent

#### 2. AI CRM Service
**Purpose**: Core CRM functionality with AI-powered features
**Key Features**:
- Contact management
- Deal pipeline
- Lead management
- Activity tracking
- AI-powered recommendations
- AI scoring
- Conversation intelligence
- Analytics dashboard

**Database Tables**:
- `contacts`: Customer/prospect contacts
- `deals`: Sales opportunities
- `leads`: Lead information
- `activities`: CRM activities
- `ai_recommendations`: AI-generated insights
- `conversation_analytics`: Call/meeting analysis

**Key Endpoints**:
- `POST /ai_crm/contacts` - Create contact
- `GET /ai_crm/contacts/:id` - Get contact
- `POST /ai_crm/deals` - Create deal
- `GET /ai_crm/recommendations/:contact_id` - Get AI recommendations
- `POST /ai_crm/score-lead` - Score lead with AI

#### 3. Nurturing Service
**Purpose**: Intelligent multi-channel lead nurturing sequences
**Key Features**:
- Multi-step sequences (email, LinkedIn, phone, SMS)
- Behavior tracking and scoring
- Engagement profile analysis
- AI-powered content generation
- A/B testing
- Real-time triggers
- Performance analytics
- Sequence management

**Database Tables**:
- `nurturing_sequences`: Sequence definitions
- `sequence_steps`: Individual sequence steps
- `sequence_enrollments`: Prospect enrollments
- `nurturing_communications`: Sent communications
- `prospect_behaviors`: Tracked behaviors
- `prospect_engagement_profiles`: Engagement analytics
- `sequence_ab_tests`: A/B test configurations
- `ab_test_results`: Test performance data

**Key Endpoints**:
- `POST /nurturing/sequences` - Create sequence
- `POST /nurturing/enroll` - Enroll prospect
- `POST /nurturing/track-behavior` - Track engagement
- `POST /nurturing/ai/generate-sequence` - AI sequence generation
- `GET /nurturing/analytics/engagement` - Get analytics
- `POST /nurturing/ab-tests` - Create A/B test

#### 4. Email Service
**Purpose**: Email campaign management and tracking
**Key Features**:
- Template management
- Campaign creation
- Send tracking (opens, clicks, replies)
- Response automation
- Bounce handling

**Database Tables**:
- `email_templates`: Reusable templates
- `email_campaigns`: Campaign instances
- `email_responses`: Tracked responses

**Key Endpoints**:
- `POST /email/send` - Send email
- `POST /email/templates` - Create template
- `GET /email/campaigns` - List campaigns
- `POST /email/track-response` - Track response

#### 5. Payment Service
**Purpose**: Stripe integration for billing and subscriptions
**Key Features**:
- Customer management
- Subscription handling
- Payment intent creation
- Invoice management
- Plan management
- Webhook processing

**Database Tables**:
- `customers`: Stripe customer records
- `subscriptions`: Active subscriptions
- `payment_methods`: Stored payment methods
- `invoices`: Invoice records
- `plans`: Available subscription plans

**Key Endpoints**:
- `POST /payment/customers` - Create customer
- `POST /payment/subscriptions` - Create subscription
- `POST /payment/payment-intents` - Create payment
- `GET /payment/invoices/:customer_id` - Get invoices
- `POST /payment/webhooks/stripe` - Stripe webhook handler

#### 6. Scoring Service
**Purpose**: AI-powered lead scoring and prioritization
**Key Features**:
- Prospect scoring algorithm
- Bulk scoring operations
- Priority prospect identification
- Score history tracking
- Configurable scoring weights

**Database Tables**:
- `prospect_scores`: Score records
- `score_history`: Historical scores
- `scoring_config`: Scoring parameters

**Key Endpoints**:
- `POST /scoring/score-prospect` - Score single prospect
- `POST /scoring/bulk-score` - Batch scoring
- `GET /scoring/priority-prospects` - Get top prospects

#### 7. Analytics Service
**Purpose**: Business intelligence and metrics
**Key Features**:
- Daily/weekly/monthly metrics
- Conversion tracking
- Performance dashboards
- Custom reports
- Trend analysis

**Database Tables**:
- `daily_analytics`: Daily metrics
- `conversion_events`: Conversion tracking

**Key Endpoints**:
- `GET /analytics/metrics` - Get metrics
- `POST /analytics/track-event` - Track event

#### 8. HubSpot Service
**Purpose**: HubSpot CRM integration and sync
**Key Features**:
- Bidirectional sync
- Connection management
- AI-powered automation
- Custom field mapping
- Sync scheduling

**Database Tables**:
- `hubspot_connections`: Connection configs
- `hubspot_sync_logs`: Sync history
- `hubspot_field_mappings`: Custom mappings
- `hubspot_automation_rules`: AI rules

**Key Endpoints**:
- `POST /hubspot/connect` - Connect account
- `POST /hubspot/sync` - Trigger sync
- `GET /hubspot/sync-logs` - Get sync history
- `POST /hubspot/ai/create-automation` - Create AI rule

#### 9. Realtime Service
**Purpose**: WebSocket-based real-time notifications
**Key Features**:
- WebSocket connections
- Event broadcasting
- Presence tracking
- Connection management

**Key Endpoints**:
- `WebSocket /realtime/ws` - WebSocket endpoint
- `POST /realtime/broadcast` - Broadcast event

#### 10. Prospect Service
**Purpose**: Lead/prospect management
**Key Features**:
- Prospect CRUD operations
- Search simulation
- Bulk operations
- Status tracking

**Database Tables**:
- `prospects`: Prospect records

**Key Endpoints**:
- `POST /prospect/create` - Create prospect
- `GET /prospect/list` - List prospects
- `PUT /prospect/update/:id` - Update prospect
- `POST /prospect/simulate-search` - Simulate search

#### 11. Client Service
**Purpose**: Client/organization management
**Key Features**:
- Client CRUD operations
- Multi-tenancy support
- Configuration management

**Database Tables**:
- `clients`: Client records

**Key Endpoints**:
- `POST /client/create` - Create client
- `GET /client/list` - List clients
- `GET /client/get/:id` - Get client
- `PUT /client/update/:id` - Update client

#### 12. Auth Service
**Purpose**: Authentication and authorization
**Key Features**:
- Clerk integration
- User management
- Session handling
- Role-based access

**Key Endpoints**:
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/user` - Get current user

#### 13. GDPR Service
**Purpose**: Data privacy and compliance
**Key Features**:
- Data export (Right to Access)
- Data deletion (Right to Erasure)
- Consent management
- Audit trails

**Database Tables**:
- `gdpr_requests`: Privacy requests
- `gdpr_audit_log`: Compliance audit

**Key Endpoints**:
- `POST /gdpr/export-data` - Export user data
- `POST /gdpr/delete-data` - Delete user data
- `GET /gdpr/requests/:user_id` - Get requests

#### 14. Audit Service
**Purpose**: Security and activity logging
**Key Features**:
- Activity logging
- Security event tracking
- Audit trail
- Analytics on logs
- Security middleware

**Database Tables**:
- `audit_logs`: Audit records

**Key Endpoints**:
- `POST /audit/log` - Create log entry
- `GET /audit/logs` - Query logs
- `GET /audit/analytics` - Get analytics

#### 15. DB Performance Service
**Purpose**: Database monitoring and optimization
**Key Features**:
- Query performance monitoring
- Slow query detection
- Index recommendations
- Connection pool monitoring
- Automatic optimization

**Database Tables**:
- `slow_queries`: Slow query log
- `performance_metrics`: DB metrics

**Key Endpoints**:
- `GET /db_performance/metrics` - Get metrics
- `GET /db_performance/slow-queries` - Get slow queries
- `POST /db_performance/optimize` - Trigger optimization

#### 16. Rate Limiting Service
**Purpose**: API rate limiting and quota management
**Key Features**:
- Per-endpoint limits
- User/client quotas
- Token bucket algorithm
- Usage tracking

**Database Tables**:
- `rate_limits`: Limit configurations
- `quota_usage`: Usage tracking

**Key Endpoints**:
- `GET /rate_limiting/quota/:user_id` - Get quota
- `POST /rate_limiting/check` - Check limit

#### 17. AI Service
**Purpose**: OpenAI integration and AI operations
**Key Features**:
- Chat completions
- Text generation
- Embeddings
- Model management

**Key Endpoints**:
- `POST /ai/chat` - Chat completion
- `POST /ai/generate` - Text generation

#### 18. System Service
**Purpose**: System utilities and operations
**Key Features**:
- Loop detection and prevention
- Health checks
- System status

**Key Endpoints**:
- `POST /system/stop-loop` - Stop infinite loop
- `GET /system/health` - Health check

### Shared Utilities

Located in `backend/shared/`:
- `database.ts`: Database helpers and error handling
- `db-config.ts`: Database configuration
- `enhanced-database.ts`: Advanced DB features
- `errors.ts`: Custom error types
- `intelligent-backoff.ts`: Retry logic with backoff
- `pagination.ts`: Pagination utilities
- `query-cache.ts`: Query caching layer
- `rate-limiting.ts`: Rate limiting utilities
- `simple-rate-limiting.ts`: Simple rate limiter
- `security.ts`: Security utilities
- `validation.ts`: Input validation

## Data Flow Patterns

### 1. User Request Flow
```
User Action → Frontend Component → React Query Hook →
Backend API → Service Layer → Database → Response →
Frontend Update → UI Render
```

### 2. Real-time Notification Flow
```
Backend Event → Realtime Service → WebSocket →
Frontend Listener → React Query Invalidation →
UI Update
```

### 3. AI Processing Flow
```
User Input → Frontend → API → AI Service → OpenAI API →
Response Processing → Database Update → Frontend Update
```

### 4. Email Campaign Flow
```
Create Campaign → Template Selection →
Nurturing Sequence → Schedule Send →
Email Service → Track Response →
Update Analytics → AI Scoring
```

## Frontend Architecture

### Component Structure
```
frontend/
├── App.tsx                    # Root component
├── main.tsx                   # Entry point
├── components/                # UI components
│   ├── Dashboard.tsx          # Main dashboard
│   ├── *Management.tsx        # CRUD interfaces
│   ├── ui/                    # shadcn/ui components
│   └── ...                    # Feature components
├── hooks/                     # React Query hooks
│   ├── useAgents.ts
│   ├── useProspects.ts
│   ├── useEmail.ts
│   └── ...
├── lib/
│   ├── react-query.ts         # Query client config
│   └── utils.ts               # Utilities
└── client.ts                  # Encore client
```

### State Management Strategy

#### React Query for Server State
- Automatic caching with 10-minute stale time
- Optimistic updates for instant UI feedback
- Offline-first with localStorage persistence
- Automatic retry with exponential backoff
- Query invalidation for data consistency

#### Component State for UI State
- React hooks (useState, useReducer) for local UI state
- No global state management needed due to React Query

### Hooks Architecture

Each backend service has a corresponding React Query hook:
- `useAgents()` → Agent service
- `useProspects()` → Prospect service
- `useEmail()` → Email service
- `usePayment()` → Payment service
- `useAnalytics()` → Analytics service
- `useHubSpot()` → HubSpot service
- `useAICRM()` → AI CRM service
- `useRealtime()` → Realtime service
- `useScoring()` → Scoring service
- `useCompliance()` → GDPR service

Each hook provides:
- Query functions (fetching data)
- Mutation functions (creating/updating/deleting)
- Loading states
- Error handling
- Optimistic updates

## Database Schema

### Multi-tenancy Pattern
Most tables include `client_id` for tenant isolation:
```sql
CREATE TABLE example (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  -- other fields
  CONSTRAINT fk_client FOREIGN KEY (client_id)
    REFERENCES clients(id)
);
```

### Audit Pattern
Timestamp tracking on all tables:
```sql
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
```

### Key Relationships
```
clients
  ├── agents
  ├── prospects
  ├── email_campaigns
  ├── nurturing_sequences
  │   ├── sequence_steps
  │   └── sequence_enrollments
  │       └── nurturing_communications
  ├── customers
  │   ├── subscriptions
  │   ├── payment_methods
  │   └── invoices
  └── contacts
      ├── deals
      ├── activities
      └── ai_recommendations
```

## Security Architecture

### Authentication
- **Provider**: Clerk
- **Method**: JWT tokens
- **Flow**:
  1. User logs in via Clerk
  2. Frontend receives JWT
  3. JWT sent in Authorization header
  4. Backend validates via Clerk SDK

### Authorization
- Role-based access control (RBAC)
- Client-level isolation (multi-tenancy)
- Row-level security in queries

### Data Protection
- Encryption at rest (PostgreSQL encryption)
- Encryption in transit (HTTPS/WSS)
- GDPR compliance features
- Audit logging for all sensitive operations

### Rate Limiting
- Per-user quotas
- Per-endpoint limits
- Token bucket algorithm
- Redis-backed counters

## Deployment Architecture

### Docker Compose (Development)
```
services:
  - app-dev (Encore app)
  - postgres (Database)
  - redis (Cache)
```

### Docker Compose (Production)
```
services:
  - app (Encore app)
  - postgres (Database + backups)
  - redis (Cache + persistence)
```

### Environment Variables
See `.env.example` for complete list:
- `DATABASE_URL`: PostgreSQL connection
- `REDIS_URL`: Redis connection
- `CLERK_SECRET_KEY`: Clerk authentication
- `OPENAI_API_KEY`: OpenAI integration
- `STRIPE_API_KEY`: Stripe payments
- `HUBSPOT_API_KEY`: HubSpot integration

## Performance Optimizations

### Backend
1. **Database**:
   - Connection pooling
   - Query optimization
   - Index management
   - Slow query monitoring

2. **Caching**:
   - Redis for frequently accessed data
   - Query result caching
   - Session caching

3. **Rate Limiting**:
   - Protect against abuse
   - Ensure fair resource allocation

### Frontend
1. **Code Splitting**:
   - Lazy loading routes
   - Dynamic imports
   - Component-level splitting

2. **Data Fetching**:
   - React Query caching
   - Prefetching on hover
   - Optimistic updates
   - Background refetching

3. **Rendering**:
   - React 19 optimizations
   - Virtual scrolling for lists
   - Memoization

## Monitoring & Observability

### Logging
- Encore built-in logging
- Custom audit service
- Structured JSON logs

### Metrics
- Database performance metrics
- API endpoint metrics
- User activity analytics
- Business metrics dashboard

### Error Tracking
- Frontend: Console + React Error Boundaries
- Backend: Encore error handling + audit logs

## Testing Strategy

### Unit Tests
- Service logic testing
- Hook testing (React Testing Library)
- Utility function testing

### Integration Tests
- API endpoint testing
- Database operations
- External service mocks

### E2E Tests
- Critical user flows
- Payment flows
- Multi-step processes

### Test Tools
- Vitest (unit/integration)
- Testing Library (React)
- Mock Service Worker (API mocking)

## Scaling Considerations

### Horizontal Scaling
- Encore services are stateless
- Multiple app instances behind load balancer
- Redis for shared state/cache

### Database Scaling
- Read replicas for reporting
- Connection pooling
- Query optimization
- Partitioning for large tables

### Cache Strategy
- Redis cluster for high availability
- Cache warming for common queries
- Invalidation strategies

## Development Workflow

### Local Development
```bash
# Install dependencies
bun install

# Start development environment
docker-compose --profile dev up

# Run tests
bun test

# Type checking
bun run type-check
```

### Git Workflow
1. Feature branch from main
2. Development and testing
3. Commit with descriptive messages
4. Push to remote
5. Create pull request
6. Code review
7. Merge to main

## Future Enhancements

### Planned Features
1. Advanced AI features (GPT-4, embeddings)
2. More integrations (Salesforce, Zoom, Calendly)
3. Mobile application (React Native)
4. Advanced reporting (custom dashboards)
5. Workflow automation builder
6. Voice/video communication

### Scalability Roadmap
1. Microservices decomposition (split large services)
2. Event-driven architecture (message queue)
3. GraphQL API option
4. Multi-region deployment
5. Advanced caching strategies

## Glossary

- **Encore.ts**: Backend framework with built-in infrastructure
- **Agent**: Autonomous AI system for outreach/nurturing
- **Prospect**: Potential customer/lead
- **Sequence**: Multi-step nurturing campaign
- **Enrollment**: Prospect assigned to a sequence
- **Classification**: Categorization of prospects (hot/warm/cold)
- **Score**: AI-calculated lead quality metric
- **Client**: Tenant/organization in multi-tenant system
- **Communication**: Single message sent to prospect
- **Behavior**: Tracked prospect action (open, click, etc.)
