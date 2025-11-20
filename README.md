# 🤖 AI Prospecting Agent Platform

An intelligent AI-powered prospecting and lead generation platform that automates the entire lead lifecycle from discovery to conversion.

## What This Does

This platform helps you **generate and nurture leads automatically** using AI:

- 🎯 **Automated Prospect Discovery** - AI agents find and classify potential customers
- 🧠 **Intelligent Lead Scoring** - ML-powered scoring based on 20+ factors
- 📧 **Personalized Email Outreach** - AI generates customized emails for each prospect
- 📊 **Real-time Analytics** - Track performance, conversion rates, and ROI
- 🔄 **CRM Integration** - Bi-directional sync with HubSpot
- 💰 **Revenue Tracking** - Attribution from first touch to closed deal
- 🤖 **Smart Nurturing** - Behavior-triggered sequences that adapt to prospect engagement

---

## 📚 Documentation

- **[🚀 QUICKSTART.md](./QUICKSTART.md)** - Get up and running in 30 minutes
- **[✅ Setup Validation](./check-setup.sh)** - Run `./check-setup.sh` to verify your environment
- **[📋 DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Production deployment guide
- **[🔧 DEVELOPMENT.md](./DEVELOPMENT.md)** - Development workflow and Encore setup
- **[🤖 AI_SETUP.md](./AI_SETUP.md)** - OpenAI configuration and AI features guide
- **[📱 Component Status Report](./COMPONENT_DISABILITY_REPORT.md)** - UI component restoration roadmap

---

## ✨ Key Features

### Core Prospecting Engine
- 🤖 **AI Prospecting Agents** - Autonomous agents that discover, score, and classify leads
- 🎯 **Multi-factor Scoring** - Position, company size, revenue, engagement, LinkedIn activity
- 🏷️ **Smart Classification** - Business Builder, Product Customer, Nurture, Unqualified
- 📈 **Priority Queue** - Auto-ranked leads by conversion likelihood

### Email & Nurturing
- 📧 **AI Email Generation** - Personalized emails using GPT-4o-mini
- 🔄 **Intelligent Sequences** - Multi-step nurturing with behavior triggers
- 📊 **Engagement Tracking** - Opens, clicks, replies, and conversion tracking
- 🧪 **A/B Testing** - Optimize subject lines and content

### Integrations
- 🔗 **HubSpot CRM** - Bi-directional contact and deal sync with AI automation
- 💳 **Stripe Payments** - Subscription and payment processing
- 📧 **Email Providers** - SMTP integration (Gmail, SendGrid, etc.)
- 🔐 **Clerk Auth** - Secure authentication with social providers

### Analytics & Insights
- 📊 **Real-time Dashboard** - Live metrics and KPIs
- 🎨 **Visual Reports** - Charts, graphs, and trend analysis
- 💰 **Revenue Attribution** - Track deals from first touch to close
- 🔍 **Drill-down Analysis** - Detailed prospect journey insights

### Enterprise Features
- 🏢 **Multi-tenancy** - Isolated client environments
- 🛡️ **GDPR Compliance** - Data export, deletion, and privacy tools
- 🚦 **Rate Limiting** - Protect APIs by user tier
- 🔒 **Audit Logging** - Security and compliance tracking
- 📈 **Database Monitoring** - Query performance and optimization

---

## 🏗️ Tech Stack

### Backend (22 Microservices)
- **Framework**: Encore.ts (TypeScript microservices framework)
- **Language**: TypeScript 5.9
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **AI**: OpenAI GPT-4o-mini
- **Auth**: Clerk
- **Integrations**: HubSpot API, Stripe API
- **Package Manager**: Bun

### Frontend
- **Framework**: React 19.1
- **Build Tool**: Vite 6
- **Routing**: React Router 7
- **State Management**: TanStack Query (React Query) 5.89
- **UI Library**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS 4.1
- **Charts**: Recharts 2.15
- **Icons**: Lucide React

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Deployment**: Encore Cloud, Docker, GitHub Actions
- **Testing**: Vitest
- **Code Quality**: ESLint

---

## 🚀 Quick Start (30 Minutes)

### Prerequisites

Install these tools first:

```bash
# Encore CLI (REQUIRED for backend)
# macOS:
brew install encoredev/tap/encore

# Linux:
curl -L https://encore.dev/install.sh | bash

# Windows:
iwr https://encore.dev/install.ps1 | iex

# Bun (package manager - recommended)
npm install -g bun
```

### Step 1: Clone and Configure

```bash
git clone <repository-url>
cd agent-code-Leap-

# Create environment file
cp .env.example .env
```

### Step 2: Configure API Keys

Edit `.env` and add these **REQUIRED** values:

```bash
# CRITICAL: Get from https://platform.openai.com/api-keys
OpenAIKey=sk-proj-xxxxx

# REQUIRED: For sending emails (Gmail example)
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_gmail_app_password

# OPTIONAL: Use test key in App.tsx for now, or get from clerk.com
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

### Step 3: Validate Setup

```bash
# Run the setup checker
./check-setup.sh
```

This will verify:
- ✅ All required tools installed
- ✅ Environment variables configured
- ✅ Dependencies ready
- ✅ Ports available

### Step 4: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
encore run
# Backend runs on http://localhost:4000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
bun install
bun run dev
# Frontend runs on http://localhost:5173
```

### Step 5: Access the Application

Open your browser to:
```
http://localhost:5173
```

Sign in with Clerk authentication and start creating prospecting agents!

---

## 📖 Detailed Setup

For comprehensive step-by-step instructions with screenshots and troubleshooting, see:

➡️ **[QUICKSTART.md](./QUICKSTART.md)**

---

## 🐳 Deployment

### Option 1: Encore Cloud (Easiest)

```bash
# Authenticate
encore auth login

# Deploy to production
git push encore main
```

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for production setup.

### Option 2: Docker

```bash
# Development
docker-compose --profile dev up

# Production
docker-compose up -d
```

### Option 3: Self-Hosted

See full deployment guide in [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

---

## 📊 Application Architecture

### Backend Microservices (22 Services)

| Service | Purpose |
|---------|---------|
| `agent` | Prospecting agent management and control |
| `prospect` | Prospect CRUD operations and search |
| `scoring` | AI-powered lead scoring algorithm |
| `email` | Email campaigns and tracking |
| `nurturing` | Intelligent nurturing sequences |
| `ai_crm` | Core CRM with leads, deals, activities |
| `ai` | OpenAI integration and content generation |
| `analytics` | Business intelligence and metrics |
| `hubspot` | HubSpot sync and automation |
| `payment` | Stripe integration and billing |
| `auth` | User authentication and authorization |
| `client` | Multi-tenant client management |
| `realtime` | WebSocket real-time features |
| `rate_limiting` | API throttling by user tier |
| `audit` | Security audit logging |
| `gdpr` | Data privacy compliance |
| `db_performance` | Database query monitoring |
| `system` | Health checks and maintenance |
| `shared` | Common utilities and helpers |

### Frontend Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard` | Dashboard | Overview and metrics |
| `/clients` | ClientManagement | Multi-tenant client admin |
| `/prospects` | ProspectManagement | All prospects list |
| `/priority` | PriorityProspects | High-score leads |
| `/campaigns` | EmailCampaigns | Email campaign manager |
| `/analytics` | Analytics | Performance dashboards |
| `/agent` | AgentControls | Agent configuration |
| `/ai-crm` | AICRMDashboard | AI CRM overview |
| `/ai-crm/leads` | LeadsManagement | Lead management |
| `/ai-crm/deals` | DealsManagement | Deal pipeline |
| `/ai-crm/integration` | CRMIntegration | Integration settings |
| `/hubspot` | HubSpotIntegration | HubSpot sync |
| `/payments` | PaymentDashboard | Billing and subscriptions |

---

## 🔑 Environment Variables

See `.env.example` for complete configuration. Key variables:

### Required
- `OpenAIKey` - OpenAI API key (for AI features)
- `SMTP_USER`, `SMTP_PASS` - Email sending credentials
- `DATABASE_URL` - PostgreSQL connection (auto-configured by Encore)
- `REDIS_URL` - Redis connection (auto-configured by Encore)

### Optional
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` - Authentication (has test key fallback)
- `HUBSPOT_API_KEY` - HubSpot integration
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payment processing
- `SENTRY_DSN` - Error tracking

---

## 🧪 API Documentation

When the backend is running, access API documentation at:

```
http://localhost:4000/docs
```

Or view in the Encore dashboard:

```
http://localhost:9400
```

### Key API Endpoints

- **Agent**: `/agent/*` - Create, start, stop agents
- **Prospects**: `/prospect/*` - CRUD operations, search, scoring
- **Email**: `/email/*` - Campaigns, templates, tracking
- **Analytics**: `/analytics/*` - Metrics, reports, insights
- **Scoring**: `/scoring/*` - Score prospects, get priorities

---

## 🛠️ Development

### Project Structure

```
/
├── backend/              # Encore.ts microservices
│   ├── agent/           # Agent service
│   ├── prospect/        # Prospect service
│   ├── scoring/         # Scoring service
│   ├── email/           # Email service
│   ├── nurturing/       # Nurturing service
│   ├── ai/              # AI service
│   ├── ai_crm/          # AI CRM service
│   └── ... (15 more services)
├── frontend/            # React application
│   ├── components/      # React components (50+)
│   ├── hooks/          # Custom React hooks (18)
│   ├── lib/            # Utilities
│   └── main.tsx        # Entry point
├── .env.example        # Environment template
├── check-setup.sh      # Setup validation script
├── QUICKSTART.md       # Setup guide
└── DEPLOYMENT_CHECKLIST.md  # Production deployment
```

### Common Commands

```bash
# Backend development
cd backend
encore run              # Start backend with hot reload
encore db shell agent   # Open database shell
encore logs            # View logs

# Frontend development
cd frontend
bun run dev            # Start frontend dev server
bun run build          # Build for production
bun run lint           # Lint code

# Full stack
./check-setup.sh       # Validate environment
```

### Generate Frontend API Client

```bash
cd backend
encore gen client --target leap --output ../frontend/client.ts
```

---

## 📈 Scaling & Performance

### Database
- PostgreSQL 15 with automatic migrations
- Connection pooling via PgBouncer (production)
- Read replicas for analytics (production)
- Indexed on frequently queried columns

### Caching
- Redis for session storage
- React Query for client-side caching
- Query result caching for expensive operations

### Rate Limiting
- Tiered limits by user subscription
- Endpoint-specific limits
- Intelligent backoff on failures

---

## 🔒 Security

- HTTPS enforced in production
- JWT token authentication
- CSRF protection enabled
- SQL injection prevention (parameterized queries)
- XSS protection in React
- Rate limiting on auth endpoints
- Audit logging for compliance
- GDPR-compliant data handling

---

## 💰 Cost Estimation

Monthly costs for moderate usage (1000 prospects/month):

| Service | Cost |
|---------|------|
| Hosting (Encore Cloud) | $29 |
| Database (PostgreSQL) | $15 |
| Redis | $10 |
| OpenAI API | $10-20 |
| Email (SMTP) | $15 |
| Clerk Auth (free tier) | $0 |
| **Total** | **~$79-94/month** |

Self-hosted Docker deployment can reduce costs to $40-60/month.

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Encore version
encore version

# Update Encore
brew upgrade encore  # macOS
curl -L https://encore.dev/install.sh | bash  # Linux

# View logs
encore logs
```

### Frontend can't connect to backend
```bash
# Verify backend is running
curl http://localhost:4000

# Check for CORS issues in browser console
```

### AI features not working
```bash
# Verify OpenAI key in .env
grep OpenAIKey .env

# Check backend logs for AI errors
encore logs | grep ai
```

See [QUICKSTART.md](./QUICKSTART.md#troubleshooting) for comprehensive troubleshooting.

---

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests (if applicable)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🤝 Support

- **Documentation**: See documentation links at top of README
- **Issues**: Create a GitHub issue
- **Encore Docs**: https://encore.dev/docs
- **API Reference**: http://localhost:4000/docs (when running)

---

**Ready to automate your lead generation?** Follow the [QUICKSTART.md](./QUICKSTART.md) guide! 🚀
