# 👽 ALIEN PROBE AI LEAD OS

## The Operating System for Lead Generation

*Built by the AI Operating System Guy*

---

## 🎯 WHAT THIS IS

AI Lead OS is a **complete, functional lead generation operating system** that:

1. **PROBES** - Finds prospects using Apollo.io
2. **QUALIFIES** - AI-powered lead scoring
3. **TRANSMITS** - Multi-channel outreach (Email + SMS)
4. **INTERCEPTS** - Response detection & intent classification
5. **DOCKS** - Meeting scheduling via Calendly

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    AI LEAD OS KERNEL                        │
├─────────────────────────────────────────────────────────────┤
│  PIPELINE ORCHESTRATOR  │  CRON SCHEDULER  │  DASHBOARD    │
└─────────────┬───────────┴────────┬─────────┴───────────────┘
              │                    │
    ┌─────────┴─────────┐    ┌────┴────┐
    │                   │    │         │
┌───┴───┐ ┌─────┐ ┌────┴┐ ┌─┴──┐ ┌───┴────┐
│ PROBE │ │BRAIN│ │TRANS│ │DOCK│ │INTERCPT│
│Apollo │ │Score│ │ MIT │ │Caly│ │Webhooks│
└───────┘ └─────┘ └─────┘ └────┘ └────────┘
```

---

## 📁 FILE STRUCTURE

```
backend/
├── pipeline/                 # 🎛️ MASTER ORCHESTRATOR
│   ├── orchestrator.ts       # Main pipeline: Prospect → Qualify → Sequence → Meeting
│   ├── cron.ts               # Automated scheduled tasks
│   └── encore.service.ts
│
├── integrations/             # 🔌 EXTERNAL SERVICES
│   ├── apollo/               # PROBE MODULE - Find prospects
│   │   ├── types.ts
│   │   ├── client.ts
│   │   └── search.ts
│   ├── brevo/                # TRANSMIT MODULE - Email
│   │   ├── client.ts
│   │   ├── webhooks.ts       # INTERCEPT - Delivery/open tracking
│   │   └── intent.ts         # BRAIN - Intent classification
│   ├── twilio/               # TRANSMIT MODULE - SMS
│   │   ├── client.ts
│   │   └── webhooks.ts       # INTERCEPT - SMS responses
│   ├── calendly/             # DOCK MODULE - Meetings
│   │   ├── client.ts
│   │   └── webhooks.ts       # Meeting booked notifications
│   ├── api.ts                # Consolidated API endpoints
│   └── encore.service.ts
│
├── sequences/                # 📤 SEQUENCE ENGINE
│   ├── types.ts              # Sequence data structures
│   ├── engine.ts             # Multi-channel automation
│   ├── db.ts                 # Database connection
│   ├── migrations/           # SQL migrations
│   └── encore.service.ts
│
├── qualification/            # 🧠 BRAIN MODULE
│   ├── scorer.ts             # AI lead qualification
│   └── encore.service.ts
│
└── ai_crm/                   # 📊 CRM DATA LAYER
    ├── leads.ts
    ├── deals.ts
    └── ...
```

---

## 🚀 API ENDPOINTS

### Pipeline (Master Control)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pipeline/prospect` | POST | **FULL PIPELINE**: Search → Import → Qualify → Enroll |
| `/pipeline/process-sends` | POST | Process all scheduled sends |
| `/pipeline/status` | GET | Get pipeline health/metrics |
| `/pipeline/dashboard` | GET | Complete dashboard overview |
| `/pipeline/quick-start` | POST | Create & start a sequence in one call |

### Sequences

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sequences` | GET | List all sequences |
| `/sequences` | POST | Create new sequence |
| `/sequences/:id` | GET | Get sequence details |
| `/sequences/:id/activate` | POST | Activate a sequence |
| `/sequences/:id/pause` | POST | Pause a sequence |
| `/sequences/enroll` | POST | Enroll a lead |
| `/sequences/bulk-enroll` | POST | Enroll multiple leads |
| `/sequences/process` | POST | Process pending sends |

### Qualification

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/qualification/score/:leadId` | POST | Score a single lead |
| `/qualification/bulk-score` | POST | Score multiple leads |
| `/qualification/ai-score/:leadId` | POST | AI-powered scoring (OpenAI) |
| `/qualification/insights` | GET | Scoring analytics |

### Integrations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/integrations/apollo/search` | POST | Search Apollo prospects |
| `/integrations/apollo/search-and-import` | POST | Search + import to CRM |
| `/integrations/brevo/send` | POST | Send email |
| `/integrations/brevo/stats` | GET | Email statistics |
| `/integrations/twilio/send` | POST | Send SMS |
| `/integrations/twilio/status/:sid` | GET | SMS delivery status |
| `/integrations/calendly/link` | GET | Get booking link |
| `/integrations/calendly/meetings` | GET | Get upcoming meetings |
| `/integrations/health` | GET | Check all integrations |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks/brevo` | POST | Email events (open, click, etc.) |
| `/webhooks/brevo/inbound` | POST | Inbound email replies |
| `/webhooks/twilio/status` | POST | SMS delivery status |
| `/webhooks/twilio/inbound` | POST | Inbound SMS replies |
| `/webhooks/calendly` | POST | Meeting booked/canceled |

---

## 🔧 SETUP

### 1. Set API Keys

```bash
cd backend

# Apollo.io (prospect finding)
encore secret set ApolloApiKey

# Brevo (email)
encore secret set BrevoApiKey

# Twilio (SMS)
encore secret set TwilioAccountSid
encore secret set TwilioAuthToken
encore secret set TwilioPhoneNumber

# Calendly (scheduling)
encore secret set CalendlyApiKey
encore secret set CalendlyLink

# OpenAI (AI scoring)
encore secret set OpenAIKey
```

### 2. Configure Webhooks

Set these URLs in each service's dashboard:

- **Brevo**: `https://your-app.encr.app/webhooks/brevo`
- **Twilio**: `https://your-app.encr.app/webhooks/twilio/status`
- **Calendly**: `https://your-app.encr.app/webhooks/calendly`

### 3. Run the System

```bash
cd backend
encore run
```

---

## 💡 USAGE EXAMPLES

### Run Full Pipeline

```bash
curl -X POST http://localhost:4000/pipeline/prospect \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": "marketing",
    "titles": ["CEO", "CMO", "VP Marketing"],
    "employeeCounts": ["11-50", "51-200"],
    "autoQualify": true,
    "autoEnrollSequence": "seq_abc123",
    "minQualificationScore": 60,
    "limit": 25
  }'
```

### Quick Start Sequence

```bash
curl -X POST http://localhost:4000/pipeline/quick-start \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Prospect Outreach",
    "steps": [
      { "channel": "email", "delay_days": 0, "subject": "Quick question {{firstName}}", "content": "..." },
      { "channel": "sms", "delay_days": 2, "content": "Hi {{firstName}}, following up..." },
      { "channel": "email", "delay_days": 4, "subject": "One more thing...", "content": "..." }
    ],
    "leadIds": ["lead_1", "lead_2", "lead_3"]
  }'
```

### Score a Lead

```bash
curl -X POST http://localhost:4000/qualification/score/lead_123
```

### Check Pipeline Status

```bash
curl http://localhost:4000/pipeline/status
```

---

## 🔄 AUTOMATED PROCESSES

| Process | Schedule | Description |
|---------|----------|-------------|
| Process Sends | Every 5 min | Sends scheduled emails/SMS |
| Sync Calendly | Every hour | Syncs meeting data to CRM |

---

## 📊 LEAD SCORING

Leads are scored 0-100 based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Title | 25% | Decision-maker titles (CEO, VP, etc.) |
| Company Size | 15% | Within target range |
| Industry | 15% | Matches target industries |
| Phone | 15% | Has phone (for SMS) |
| LinkedIn | 10% | Has LinkedIn profile |
| Source | 10% | From preferred sources |
| Email Domain | 10% | Business email (not Gmail) |

**Qualifications:**
- 🔥 Hot (70+): Immediate priority
- 🟡 Warm (50-69): Standard sequence
- 🔵 Cold (30-49): Nurture sequence
- ⚪ Unqualified (<30): Archive

---

## 🎯 THE FLOW

```
1. PROSPECT enters system (Apollo import or manual)
         ↓
2. AI QUALIFIES the lead (score 0-100)
         ↓
3. AUTO-ENROLL if qualified (into appropriate sequence)
         ↓
4. SEQUENCE executes (Email day 0, SMS day 2, Email day 4...)
         ↓
5. RESPONSE detected (webhook from Brevo/Twilio)
         ↓
6. INTENT classified (interested/question/not-now/etc)
         ↓
7. ROUTING based on intent:
   - Interested → Send Calendly link
   - Question → Flag for response
   - Not now → Move to nurture
   - Unsubscribe → Remove from all
         ↓
8. MEETING BOOKED → Update CRM, create deal
         ↓
9. 💰 CLOSE THE DEAL
```

---

## 🛡️ COMPLIANCE

- **CAN-SPAM**: Unsubscribe link in all emails
- **TCPA**: STOP opt-out for all SMS
- Auto-pause on bounce/complaint
- Intent detection respects "not interested"

---

## 🚀 BUILT WITH

- **Encore.ts** - Backend framework
- **PostgreSQL** - Database
- **Apollo.io** - Prospect data
- **Brevo** - Email sending
- **Twilio** - SMS sending
- **Calendly** - Meeting scheduling
- **OpenAI** - AI scoring (optional)

---

*"The best lead system isn't the most complex—it's the one that actually runs."*

— AI Lead OS v1.0
