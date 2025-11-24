# TypeScript Types Reference

Complete reference for all TypeScript types used in the Leap AI CRM Platform.

## Table of Contents

1. [Agent Types](#agent-types)
2. [Nurturing Types](#nurturing-types)
3. [Payment Types](#payment-types)
4. [AI CRM Types](#ai-crm-types)
5. [Email Types](#email-types)
6. [Scoring Types](#scoring-types)
7. [HubSpot Types](#hubspot-types)
8. [GDPR Types](#gdpr-types)
9. [Audit Types](#audit-types)
10. [Shared Types](#shared-types)

---

## Agent Types

**File**: `backend/agent/types.ts`

### Enums

```typescript
type AgentStatus = 'stopped' | 'running' | 'paused';
type ProspectClassification = 'business_builder' | 'product_customer' | 'unqualified';
type ProspectStatus = 'new' | 'contacted' | 'responded' | 'qualified' | 'converted';
type EmailTemplateType = 'initial_outreach' | 'follow_up' | 'business_builder' | 'product_customer';
type CampaignStatus = 'draft' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced';
```

### Interfaces

#### Agent
```typescript
interface Agent {
  id: number;
  name: string;
  status: AgentStatus;
  prospects_found_today: number;
  emails_sent_today: number;
  responses_today: number;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
```

**Description**: Represents an AI agent that manages prospect outreach.

**Fields**:
- `id`: Unique identifier
- `name`: Agent display name
- `status`: Current operational status
- `prospects_found_today`: Count of prospects found today
- `emails_sent_today`: Count of emails sent today
- `responses_today`: Count of responses received today
- `last_activity_at`: Timestamp of last activity (null if never active)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

#### Prospect
```typescript
interface Prospect {
  id: number;
  agent_id: number;
  name: string;
  email: string;
  linkedin_profile: string | null;
  company: string | null;
  position: string | null;
  classification: ProspectClassification;
  status: ProspectStatus;
  notes: string | null;
  ai_score?: number;
  priority?: 'high' | 'medium' | 'low';
  score_reasons?: string[];
  last_scored_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

**Description**: A potential customer or lead.

**Fields**:
- `id`: Unique identifier
- `agent_id`: Associated agent ID
- `name`: Full name
- `email`: Email address
- `linkedin_profile`: LinkedIn profile URL (optional)
- `company`: Company name (optional)
- `position`: Job title (optional)
- `classification`: Category of prospect
- `status`: Current engagement status
- `notes`: Free-form notes (optional)
- `ai_score`: AI-calculated score 0-100 (optional)
- `priority`: Prioritization level (optional)
- `score_reasons`: Factors contributing to score (optional)
- `last_scored_at`: Last scoring timestamp (optional)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

#### EmailTemplate
```typescript
interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  template_type: EmailTemplateType;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

**Description**: Reusable email template.

**Fields**:
- `id`: Unique identifier
- `name`: Template name
- `subject`: Email subject line
- `body`: Email body content (supports variables)
- `template_type`: Category of template
- `is_active`: Whether template is currently usable
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

#### EmailCampaign
```typescript
interface EmailCampaign {
  id: number;
  prospect_id: number;
  template_id: number;
  subject: string;
  body: string;
  sent_at: Date | null;
  opened_at: Date | null;
  clicked_at: Date | null;
  replied_at: Date | null;
  status: CampaignStatus;
  created_at: Date;
}
```

**Description**: Individual email sent to a prospect.

**Fields**:
- `id`: Unique identifier
- `prospect_id`: Target prospect ID
- `template_id`: Source template ID
- `subject`: Rendered subject line
- `body`: Rendered email body
- `sent_at`: Sent timestamp (null if not sent)
- `opened_at`: First open timestamp (null if not opened)
- `clicked_at`: First click timestamp (null if not clicked)
- `replied_at`: Reply timestamp (null if no reply)
- `status`: Current status
- `created_at`: Creation timestamp

---

#### DailyAnalytics
```typescript
interface DailyAnalytics {
  id: number;
  agent_id: number;
  date: Date;
  prospects_found: number;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  prospects_qualified: number;
  prospects_converted: number;
  created_at: Date;
}
```

**Description**: Daily performance metrics per agent.

**Fields**:
- `id`: Unique identifier
- `agent_id`: Associated agent ID
- `date`: Date for metrics
- `prospects_found`: Prospects found on this date
- `emails_sent`: Emails sent on this date
- `emails_opened`: Emails opened on this date
- `emails_clicked`: Emails with clicks on this date
- `emails_replied`: Emails with replies on this date
- `prospects_qualified`: Prospects qualified on this date
- `prospects_converted`: Prospects converted on this date
- `created_at`: Creation timestamp

---

## Nurturing Types

**File**: `backend/nurturing/types.ts`

### Enums

```typescript
type BehaviorType =
  | 'email_open'
  | 'email_click'
  | 'email_reply'
  | 'website_visit'
  | 'linkedin_view'
  | 'linkedin_connect'
  | 'phone_answer'
  | 'phone_voicemail'
  | 'content_download'
  | 'meeting_scheduled'
  | 'meeting_attended'
  | 'meeting_no_show';

type EngagementTrend = 'increasing' | 'decreasing' | 'stable' | 'neutral';
type ContentPreference = 'email' | 'linkedin' | 'phone' | 'sms' | 'video';
type SequenceStatus = 'active' | 'paused' | 'completed' | 'stopped';
type CommunicationType = 'email' | 'linkedin_message' | 'phone_call' | 'sms' | 'task';
type ClassificationTarget = 'hot' | 'warm' | 'cold' | 'nurture' | 'unqualified';
type StageTarget = 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
```

### Interfaces

#### ProspectBehavior
```typescript
interface ProspectBehavior {
  id: number;
  prospect_id: number;
  client_id: number;
  behavior_type: BehaviorType;
  behavior_data: Record<string, any>;
  engagement_score: number;
  created_at: Date;
}
```

**Description**: Tracked prospect engagement behavior.

**Fields**:
- `id`: Unique identifier
- `prospect_id`: Associated prospect ID
- `client_id`: Associated client ID (multi-tenancy)
- `behavior_type`: Type of behavior tracked
- `behavior_data`: Additional behavior metadata
- `engagement_score`: Score contribution from this behavior
- `created_at`: Behavior timestamp

---

#### ProspectEngagementProfile
```typescript
interface ProspectEngagementProfile {
  id: number;
  prospect_id: number;
  client_id: number;
  total_score: number;
  email_engagement_score: number;
  content_engagement_score: number;
  response_rate: number;
  avg_response_time_hours: number;
  preferred_content_type?: ContentPreference;
  optimal_send_time?: string;
  optimal_send_day?: number;
  engagement_trend: EngagementTrend;
  last_engagement_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

**Description**: Comprehensive engagement analytics for a prospect.

**Fields**:
- `id`: Unique identifier
- `prospect_id`: Associated prospect ID
- `client_id`: Associated client ID
- `total_score`: Overall engagement score
- `email_engagement_score`: Email-specific engagement
- `content_engagement_score`: Content interaction score
- `response_rate`: Percentage of messages responded to (0-1)
- `avg_response_time_hours`: Average hours to respond
- `preferred_content_type`: Most engaged channel (optional)
- `optimal_send_time`: Best time to send (HH:MM format, optional)
- `optimal_send_day`: Best day to send (0-6, optional)
- `engagement_trend`: Trend direction
- `last_engagement_at`: Last engagement timestamp (optional)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

#### NurturingSequence
```typescript
interface NurturingSequence {
  id: number;
  client_id: number;
  name: string;
  classification_target: ClassificationTarget;
  stage_target: StageTarget;
  sequence_type: string;
  total_steps: number;
  is_active: boolean;
  performance_score: number;
  conversion_rate: number;
  created_by_ai: boolean;
  template_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  steps?: SequenceStep[];
}
```

**Description**: Multi-step nurturing sequence definition.

**Fields**:
- `id`: Unique identifier
- `client_id`: Associated client ID
- `name`: Sequence name
- `classification_target`: Target prospect classification
- `stage_target`: Target buyer journey stage
- `sequence_type`: Category (e.g., "onboarding", "re-engagement")
- `total_steps`: Number of steps in sequence
- `is_active`: Whether sequence is currently usable
- `performance_score`: Overall effectiveness score
- `conversion_rate`: Percentage of enrollments that convert
- `created_by_ai`: Whether AI generated this sequence
- `template_data`: Additional configuration
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `steps`: Array of sequence steps (optional, populated on demand)

---

#### SequenceStep
```typescript
interface SequenceStep {
  id: number;
  sequence_id: number;
  step_number: number;
  content_type: CommunicationType;
  delay_days: number;
  delay_hours: number;
  subject_template?: string;
  content_template: string;
  conditions: Record<string, any>;
  performance_metrics: Record<string, any>;
  is_active: boolean;
  created_at: Date;
}
```

**Description**: Individual step within a nurturing sequence.

**Fields**:
- `id`: Unique identifier
- `sequence_id`: Parent sequence ID
- `step_number`: Order in sequence (1-based)
- `content_type`: Communication channel
- `delay_days`: Days to wait after previous step
- `delay_hours`: Additional hours to wait (0-23)
- `subject_template`: Subject line template (for email, optional)
- `content_template`: Message content template
- `conditions`: Conditional logic for step execution
- `performance_metrics`: Step-level analytics
- `is_active`: Whether step is enabled
- `created_at`: Creation timestamp

---

#### SequenceEnrollment
```typescript
interface SequenceEnrollment {
  id: number;
  prospect_id: number;
  sequence_id: number;
  client_id: number;
  current_step: number;
  status: SequenceStatus;
  enrolled_at: Date;
  last_step_sent_at?: Date;
  next_step_scheduled_at?: Date;
  completion_reason?: string;
  created_at: Date;
  updated_at: Date;
  sequence?: NurturingSequence;
}
```

**Description**: Prospect enrolled in a nurturing sequence.

**Fields**:
- `id`: Unique identifier
- `prospect_id`: Enrolled prospect ID
- `sequence_id`: Associated sequence ID
- `client_id`: Associated client ID
- `current_step`: Current step number
- `status`: Enrollment status
- `enrolled_at`: Enrollment timestamp
- `last_step_sent_at`: Last step execution timestamp (optional)
- `next_step_scheduled_at`: Next step scheduled time (optional)
- `completion_reason`: Why enrollment ended (optional)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `sequence`: Full sequence object (optional, populated on demand)

---

#### NurturingCommunication
```typescript
interface NurturingCommunication {
  id: number;
  enrollment_id: number;
  step_id: number;
  prospect_id: number;
  communication_type: CommunicationType;
  subject?: string;
  content: string;
  sent_at: Date;
  opened_at?: Date;
  clicked_at?: Date;
  replied_at?: Date;
  engagement_score: number;
  created_at: Date;
}
```

**Description**: Communication sent as part of a nurturing sequence.

**Fields**:
- `id`: Unique identifier
- `enrollment_id`: Associated enrollment ID
- `step_id`: Sequence step ID
- `prospect_id`: Target prospect ID
- `communication_type`: Channel used
- `subject`: Subject line (for email, optional)
- `content`: Rendered message content
- `sent_at`: Sent timestamp
- `opened_at`: First open timestamp (optional)
- `clicked_at`: First click timestamp (optional)
- `replied_at`: Reply timestamp (optional)
- `engagement_score`: Engagement score generated
- `created_at`: Creation timestamp

---

#### SequenceABTest
```typescript
interface SequenceABTest {
  id: number;
  sequence_id: number;
  test_name: string;
  variant_a_data: Record<string, any>;
  variant_b_data: Record<string, any>;
  traffic_split: number;
  status: 'active' | 'paused' | 'completed';
  winner?: 'a' | 'b';
  statistical_significance: number;
  start_date: Date;
  end_date?: Date;
  created_at: Date;
}
```

**Description**: A/B test configuration for sequence optimization.

**Fields**:
- `id`: Unique identifier
- `sequence_id`: Associated sequence ID
- `test_name`: Test name
- `variant_a_data`: Configuration for variant A
- `variant_b_data`: Configuration for variant B
- `traffic_split`: Percentage to variant A (0-1)
- `status`: Test status
- `winner`: Winning variant (optional, set when completed)
- `statistical_significance`: Confidence level (0-1)
- `start_date`: Test start timestamp
- `end_date`: Test end timestamp (optional)
- `created_at`: Creation timestamp

---

### Request/Response Types

#### TrackBehaviorRequest
```typescript
interface TrackBehaviorRequest {
  prospect_id: number;
  client_id: number;
  behavior_type: BehaviorType;
  behavior_data?: Record<string, any>;
}
```

**Description**: Request to track prospect behavior.

---

#### CreateSequenceRequest
```typescript
interface CreateSequenceRequest {
  client_id: number;
  name: string;
  classification_target: ClassificationTarget;
  stage_target: StageTarget;
  sequence_type?: string;
  steps: CreateSequenceStepRequest[];
  template_data?: Record<string, any>;
}
```

**Description**: Request to create a new nurturing sequence.

---

#### CreateSequenceStepRequest
```typescript
interface CreateSequenceStepRequest {
  step_number: number;
  content_type: CommunicationType;
  delay_days: number;
  delay_hours?: number;
  subject_template?: string;
  content_template: string;
  conditions?: Record<string, any>;
}
```

**Description**: Step definition when creating a sequence.

---

#### EnrollProspectRequest
```typescript
interface EnrollProspectRequest {
  prospect_id: number;
  sequence_id: number;
  client_id: number;
}
```

**Description**: Request to enroll a prospect in a sequence.

---

#### AISequenceGenerationRequest
```typescript
interface AISequenceGenerationRequest {
  client_id: number;
  prospect_data: Record<string, any>;
  classification: ClassificationTarget;
  stage: StageTarget;
  sequence_length?: number;
  preferred_channels?: CommunicationType[];
}
```

**Description**: Request for AI to generate a nurturing sequence.

---

#### AIAnalysisRequest
```typescript
interface AIAnalysisRequest {
  prospect_id: number;
  client_id: number;
  analysis_type: 'engagement_prediction' | 'content_optimization' | 'timing_optimization' | 'channel_optimization';
  context?: Record<string, any>;
}
```

**Description**: Request for AI analysis of prospect or sequence.

---

#### AIAnalysisResponse
```typescript
interface AIAnalysisResponse {
  recommendations: string[];
  confidence_score: number;
  reasoning: string;
  suggested_actions: string[];
  data: Record<string, any>;
}
```

**Description**: AI analysis results.

---

#### EngagementAnalytics
```typescript
interface EngagementAnalytics {
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  average_completion_rate: number;
  top_performing_sequences: Array<{
    sequence_id: number;
    name: string;
    conversion_rate: number;
    engagement_score: number;
  }>;
  engagement_trends: Array<{
    date: string;
    total_engagements: number;
    average_score: number;
  }>;
}
```

**Description**: Engagement analytics across all sequences.

---

#### SequencePerformanceMetrics
```typescript
interface SequencePerformanceMetrics {
  sequence_id: number;
  total_enrollments: number;
  active_enrollments: number;
  completion_rate: number;
  average_engagement_score: number;
  conversion_rate: number;
  step_performance: Array<{
    step_number: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
    engagement_score: number;
  }>;
}
```

**Description**: Performance metrics for a specific sequence.

---

## Payment Types

**File**: `backend/payment/types.ts`

### Interfaces

#### Customer
```typescript
interface Customer {
  id: string;
  stripeCustomerId: string;
  email: string;
  name: string;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Description**: Customer record for billing.

**Fields**:
- `id`: Internal unique identifier (UUID)
- `stripeCustomerId`: Stripe customer ID
- `email`: Customer email
- `name`: Customer name
- `clientId`: Associated client ID (multi-tenancy)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

---

#### Subscription
```typescript
interface Subscription {
  id: string;
  customerId: string;
  stripeSubscriptionId: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  priceId: string;
  planName: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Description**: Subscription record.

**Fields**:
- `id`: Internal unique identifier (UUID)
- `customerId`: Internal customer ID
- `stripeSubscriptionId`: Stripe subscription ID
- `status`: Current subscription status
- `priceId`: Stripe price ID
- `planName`: Human-readable plan name
- `currentPeriodStart`: Current billing period start
- `currentPeriodEnd`: Current billing period end
- `cancelAtPeriodEnd`: Whether subscription will cancel at period end
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

---

#### PaymentMethod
```typescript
interface PaymentMethod {
  id: string;
  customerId: string;
  stripePaymentMethodId: string;
  type: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
}
```

**Description**: Stored payment method.

**Fields**:
- `id`: Internal unique identifier (UUID)
- `customerId`: Internal customer ID
- `stripePaymentMethodId`: Stripe payment method ID
- `type`: Payment method type (e.g., "card", "bank_account")
- `last4`: Last 4 digits (optional, for cards)
- `brand`: Card brand (optional, e.g., "visa", "mastercard")
- `expiryMonth`: Card expiry month (optional, 1-12)
- `expiryYear`: Card expiry year (optional, e.g., 2025)
- `isDefault`: Whether this is the default payment method
- `createdAt`: Creation timestamp

---

#### Invoice
```typescript
interface Invoice {
  id: string;
  customerId: string;
  stripeInvoiceId: string;
  subscriptionId?: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amountDue: number;
  amountPaid: number;
  currency: string;
  dueDate?: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  createdAt: Date;
}
```

**Description**: Invoice record.

**Fields**:
- `id`: Internal unique identifier (UUID)
- `customerId`: Internal customer ID
- `stripeInvoiceId`: Stripe invoice ID
- `subscriptionId`: Associated subscription ID (optional)
- `status`: Invoice status
- `amountDue`: Total amount due (in cents)
- `amountPaid`: Amount paid (in cents)
- `currency`: Currency code (e.g., "usd")
- `dueDate`: Payment due date (optional)
- `paidAt`: Payment timestamp (optional)
- `hostedInvoiceUrl`: Stripe-hosted invoice URL (optional)
- `invoicePdf`: PDF download URL (optional)
- `createdAt`: Creation timestamp

---

#### Plan
```typescript
interface Plan {
  id: string;
  name: string;
  description: string;
  stripePriceId: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  intervalCount: number;
  features: string[];
  isActive: boolean;
}
```

**Description**: Subscription plan definition.

**Fields**:
- `id`: Internal unique identifier (UUID)
- `name`: Plan name
- `description`: Plan description
- `stripePriceId`: Stripe price ID
- `amount`: Price in cents
- `currency`: Currency code
- `interval`: Billing interval
- `intervalCount`: Number of intervals (e.g., 1 = monthly, 3 = quarterly)
- `features`: List of plan features
- `isActive`: Whether plan is available for purchase

---

### Request Types

#### CreateCustomerRequest
```typescript
interface CreateCustomerRequest {
  email: string;
  name: string;
  clientId: string;
}
```

---

#### CreateSubscriptionRequest
```typescript
interface CreateSubscriptionRequest {
  customerId: string;
  priceId: string;
  paymentMethodId?: string;
}
```

---

#### UpdateSubscriptionRequest
```typescript
interface UpdateSubscriptionRequest {
  subscriptionId: string;
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
}
```

---

#### CreatePaymentIntentRequest
```typescript
interface CreatePaymentIntentRequest {
  customerId: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}
```

---

#### StripeWebhookEvent
```typescript
interface StripeWebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}
```

---

## Shared Types

### Error Types

**File**: `backend/shared/errors.ts`

```typescript
class DatabaseError extends Error {
  constructor(
    message: string,
    public operation: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class ResourceNotFoundError extends Error {
  constructor(
    public resourceName: string,
    public identifier?: string | number
  ) {
    super(`${resourceName} not found${identifier ? `: ${identifier}` : ''}`);
    this.name = 'ResourceNotFoundError';
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

### Pagination Types

**File**: `backend/shared/pagination.ts`

```typescript
interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### Query Cache Types

**File**: `backend/shared/query-cache.ts`

```typescript
interface CacheOptions {
  ttl: number;  // Time to live in seconds
  key: string;  // Cache key
  tags?: string[];  // Cache tags for invalidation
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}
```

---

## Type Usage Guidelines

### 1. Null vs Undefined
- Use `null` for database fields that can be empty
- Use `undefined` (via `?`) for optional parameters
- Example:
  ```typescript
  // Database field - use null
  linkedin_profile: string | null;

  // Optional parameter - use ?
  metadata?: Record<string, any>;
  ```

### 2. Date Handling
- All database timestamps are `Date` objects
- Use `Date | null` for optional timestamps
- Frontend receives dates as ISO strings, convert with `new Date()`

### 3. Record Types
- Use `Record<string, any>` for flexible JSON fields
- Consider defining specific interfaces for well-known structures
- Example:
  ```typescript
  // Generic
  metadata: Record<string, any>;

  // Better if structure is known
  interface BehaviorData {
    url?: string;
    duration?: number;
    action?: string;
  }
  ```

### 4. Enum vs Union Types
- Use union types for simple string enums (TypeScript best practice)
- Provides type safety and autocomplete
- Example:
  ```typescript
  // Good
  type Status = 'active' | 'paused' | 'completed';

  // Avoid (unless you need runtime enum object)
  enum Status {
    Active = 'active',
    Paused = 'paused',
    Completed = 'completed'
  }
  ```

### 5. ID Types
- Use `number` for database auto-increment IDs
- Use `string` (UUID) for Stripe/external IDs
- Always mark as required (not optional)

### 6. Timestamps
- Always include `created_at: Date`
- Include `updated_at: Date` for mutable records
- Use optional timestamps for events: `opened_at?: Date`

---

## Type Generation

### From Database Schema
Encore.ts automatically generates types from database schemas. To regenerate:
```bash
encore gen client
```

### For Frontend
Export backend types for frontend use:
```typescript
// backend/agent/types.ts
export type { Agent, Prospect, EmailTemplate };

// frontend usage
import type { Agent } from '~backend/agent/types';
```

---

## Type Safety Best Practices

1. **Never use `any`** - Always define proper types
2. **Use strict null checks** - Enable in tsconfig.json
3. **Prefer interfaces over types** - For object shapes
4. **Use readonly for immutable data** - `readonly field: string`
5. **Type guards for runtime checks**:
   ```typescript
   function isAgent(obj: any): obj is Agent {
     return typeof obj.id === 'number' && typeof obj.name === 'string';
   }
   ```
6. **Generic types for reusable logic**:
   ```typescript
   function getById<T extends { id: number }>(items: T[], id: number): T | null {
     return items.find(item => item.id === id) ?? null;
   }
   ```

---

## Migration Guide

When adding new types:

1. Define types in service's `types.ts` file
2. Export from service module
3. Update API endpoints to use new types
4. Regenerate Encore client: `encore gen client`
5. Update frontend imports
6. Add type to this documentation

When modifying existing types:

1. Check for breaking changes
2. Update database migrations if needed
3. Update all usages
4. Test thoroughly
5. Document migration path for API consumers
