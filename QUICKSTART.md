# 🚀 AI Prospecting Agent - Quick Start Guide

Get your AI-powered prospecting agent up and running in **30 minutes**!

## What You're Building

An intelligent prospecting system that:
- 🤖 Automatically scores and classifies leads using AI
- 📧 Generates personalized outreach emails
- 🎯 Tracks engagement and prioritizes hot prospects
- 📊 Provides real-time analytics and insights
- 🔄 Syncs with HubSpot CRM (optional)
- 💰 Manages payment processing (optional)

---

## Prerequisites

Before you begin, install these tools:

### 1. Encore CLI (Required for Backend)

**macOS:**
```bash
brew install encoredev/tap/encore
```

**Linux:**
```bash
curl -L https://encore.dev/install.sh | bash
```

**Windows:**
```powershell
iwr https://encore.dev/install.ps1 | iex
```

### 2. Bun (Package Manager)

```bash
# All platforms
npm install -g bun
```

### 3. Verify Installations

```bash
encore version  # Should show Encore CLI version
bun --version   # Should show Bun version
```

---

## Step 1: Environment Setup (5 minutes)

### Create Your Environment File

```bash
# Copy the example environment file
cp .env.example .env
```

### Configure Required Settings

Open `.env` in your text editor and fill in these **CRITICAL** values:

#### 1. OpenAI API Key (REQUIRED)
Without this, AI features won't work!

```bash
# Get your key from: https://platform.openai.com/api-keys
OpenAIKey=sk-proj-xxxxxxxxxxxxxxxxxxxx
```

**Cost**: ~$5-20 for initial testing (very affordable - $0.001 per lead scoring)

#### 2. Email Configuration (REQUIRED)
For sending emails to prospects:

```bash
# For Gmail (easiest option):
# 1. Enable 2FA on your Gmail account
# 2. Generate app password: https://myaccount.google.com/apppasswords

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_16_character_app_password
```

#### 3. Authentication (Use Test Key for Now)

The app has a test Clerk key built-in for quick testing. For production, get keys from:
- https://dashboard.clerk.com/ (free tier available)

```bash
# Optional - only for production deployment
CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
```

#### 4. Optional Integrations

Only configure if you need these features:

```bash
# HubSpot CRM Integration (optional)
HUBSPOT_API_KEY=your_hubspot_token

# Stripe Payment Processing (optional - for SaaS monetization)
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

### Quick Validation

```bash
# Check your .env file has the essentials
grep "OpenAIKey" .env  # Should show your OpenAI key
grep "SMTP_USER" .env  # Should show your email
```

---

## Step 2: Start the Backend (5 minutes)

### Navigate to Backend Directory

```bash
cd backend
```

### Install Dependencies (if needed)

```bash
bun install
```

### Start Encore Development Server

```bash
encore run
```

**Expected Output:**
```
✔ Building application... done
✔ Running database migrations... done
✔ Starting services... done

Your API is running at: http://localhost:4000

Dashboard: http://localhost:9400

Services:
  ✔ agent
  ✔ prospect
  ✔ scoring
  ✔ email
  ✔ nurturing
  ✔ ai_crm
  ✔ analytics
  ... (18 total services)
```

### Troubleshooting

**Problem**: Database connection error
```bash
# Encore will auto-start PostgreSQL, but if you see errors:
# Make sure Docker is running (Encore uses it for local database)
docker ps
```

**Problem**: Port already in use
```bash
# Kill existing process on port 4000
lsof -ti:4000 | xargs kill -9
```

**Keep this terminal running!** The backend must stay active.

---

## Step 3: Start the Frontend (5 minutes)

### Open a New Terminal

Keep the backend terminal running, open a **new terminal window**.

### Navigate to Frontend Directory

```bash
cd frontend
```

### Install Dependencies

```bash
bun install
```

### Start Vite Development Server

```bash
bun run dev
```

**Expected Output:**
```
  VITE v6.3.6  ready in 432 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

## Step 4: Access the Application (2 minutes)

### Open Your Browser

```
http://localhost:5173
```

### Sign In

1. You'll see the Clerk authentication screen
2. Click **"Sign in"**
3. Create a new account using:
   - Email + Password
   - OR Google/GitHub OAuth

### First Login

After signing in, you'll land on the **Dashboard** which shows:
- Agent overview (no agents yet)
- Recent prospects
- Performance metrics

---

## Step 5: Create Your First Prospecting Agent (10 minutes)

### Navigate to Agent Controls

Click **"Agent Controls"** in the left sidebar

### Create Agent

Click **"Create New Agent"** and fill in:

```
Agent Name: Tech Startup Hunter
Description: Finding tech startups for our SaaS product
Target Criteria:
  - Company size: 10-500 employees
  - Industry: Technology, Software
  - Location: United States
```

### Configure Agent Settings

```yaml
Classification Rules:
  Business Builder: C-level executives, Founders
  Product Customer: Directors, Managers

Scoring Weights:
  - Position Seniority: High
  - Company Revenue: Medium
  - LinkedIn Activity: Medium
  - Email Engagement: High
```

### Start the Agent

1. Click **"Start Agent"**
2. Watch real-time updates in the activity feed
3. The agent will:
   - Simulate prospect discovery
   - Score each prospect using AI
   - Classify leads automatically
   - Generate personalized email content

---

## Step 6: View Your Prospects (5 minutes)

### Navigate to Prospects

Click **"Prospects"** in the left sidebar

### What You'll See

- **Full prospect list** with scores
- **Search and filter** capabilities
- **Classification badges** (Business Builder, Product Customer, etc.)
- **Action buttons** (View details, Send email, Add to sequence)

### Check Priority Leads

Click **"Priority Leads"** to see:
- Highest-scored prospects at the top
- AI-generated insights for each lead
- Recommended next actions

---

## Step 7: Create Email Campaign (5 minutes)

### Navigate to Campaigns

Click **"Campaigns"** in the left sidebar

### Create Campaign

1. Click **"New Campaign"**
2. Fill in:
   ```
   Campaign Name: Product Launch Outreach
   Subject Line: {{firstName}}, revolutionary CRM for {{company}}

   Template:
   Hi {{firstName}},

   I noticed {{company}} is growing fast in the {{industry}} space.

   [Let AI generate the rest - click "Generate with AI"]
   ```

3. Select prospects:
   - Filter by classification: "Business Builder"
   - Minimum score: 75
   - Add to campaign

4. Configure sequence:
   ```
   Email 1: Day 0 (immediately)
   Follow-up 1: Day 3 (if no reply)
   Follow-up 2: Day 7 (if no reply)
   ```

### Launch Campaign

1. Preview emails (AI-personalized for each prospect)
2. Click **"Launch Campaign"**
3. Monitor engagement in real-time

---

## Step 8: Monitor Analytics (2 minutes)

### Navigate to Analytics

Click **"Analytics"** in the left sidebar

### Key Metrics

- **Prospect Pipeline**: New → Contacted → Responded → Qualified → Converted
- **Email Performance**: Open rates, click rates, reply rates
- **Agent Performance**: Prospects per day, scoring accuracy
- **Revenue Attribution**: Deals closed from each campaign

### Real-time Updates

All metrics update automatically via React Query polling.

---

## Advanced Features

### AI CRM Integration

Navigate to **"AI CRM Dashboard"** for:
- Lead management with AI recommendations
- Deal pipeline with stage predictions
- Activity tracking
- Automated follow-up suggestions

### HubSpot Sync (if configured)

Navigate to **"HubSpot AI CRM"** for:
- Bi-directional contact sync
- Deal synchronization
- Automation rules
- AI-powered HubSpot actions

### Payment Dashboard (if configured)

Navigate to **"Payment Management"** for:
- Customer subscriptions
- Invoice management
- Payment plans
- Usage tracking

---

## Common Tasks

### Add a New Prospect Manually

```
1. Go to "Prospects"
2. Click "Add Prospect"
3. Fill in: Name, Email, Company, Position
4. Click "Save" - AI will auto-score!
```

### Import Prospects in Bulk

```
1. Go to "Prospects"
2. Click "Import CSV"
3. Upload file with columns: name, email, company, position
4. Map columns
5. Click "Import & Score" - AI processes all!
```

### Create Nurturing Sequence

```
1. Go to "AI Nurturing"
2. Click "New Sequence"
3. Name: "SaaS Product Education"
4. Add steps:
   - Day 0: Introduction email
   - Day 3: Use case spotlight
   - Day 7: Customer success story
   - Day 14: Demo invitation
5. Let AI generate content for each step
6. Enroll prospects
```

---

## Troubleshooting

### Backend Issues

**Problem**: Encore won't start
```bash
# Check Encore CLI version
encore version

# Update Encore CLI
brew upgrade encore  # macOS
curl -L https://encore.dev/install.sh | bash  # Linux

# Check logs
encore logs
```

**Problem**: Database migration errors
```bash
# Reset database (WARNING: deletes all data)
encore db reset

# Or manually connect
encore db shell agent  # Opens PostgreSQL shell
```

### Frontend Issues

**Problem**: Can't connect to backend
```bash
# Check backend is running
curl http://localhost:4000

# Check frontend environment
cat frontend/.env  # Should have VITE_API_URL if needed
```

**Problem**: Authentication fails
```bash
# Verify Clerk key in frontend/App.tsx
grep "PUBLISHABLE_KEY" frontend/App.tsx

# Should see: pk_test_Y2xlYXItZmluY2gtMS5jbGVyay5hY2NvdW50cy5kZXYk
```

### AI Features Not Working

**Problem**: AI scoring returns errors
```bash
# Verify OpenAI key is set
grep "OpenAIKey" .env

# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Problem**: Email generation fails
```bash
# Check backend logs for AI service errors
encore logs | grep ai

# Verify model is set correctly (should be gpt-4o-mini)
grep "gpt-" backend/ai/*.ts
```

### Email Issues

**Problem**: Emails not sending
```bash
# Test SMTP connection
encore logs | grep smtp

# Verify credentials in .env
grep "SMTP" .env
```

---

## Next Steps

### Production Deployment

Once you've tested locally, deploy to production:

1. **Encore Cloud** (easiest):
   ```bash
   encore auth login
   git push encore main
   ```

2. **Docker** (self-hosted):
   ```bash
   docker-compose up -d
   ```

See `DEPLOYMENT.md` for detailed instructions.

### Scaling Up

- **Add more agents** for different prospect segments
- **A/B test email templates** to optimize conversion
- **Create custom scoring models** for your specific use case
- **Integrate with your CRM** via HubSpot or API

### Get Help

- **Documentation**: See `README.md` and `DEVELOPMENT.md`
- **Component Status**: See `COMPONENT_DISABILITY_REPORT.md`
- **API Docs**: http://localhost:4000/docs (when backend is running)

---

## Checklist: You're Ready When...

- [ ] Backend running on http://localhost:4000
- [ ] Frontend running on http://localhost:5173
- [ ] Signed in with Clerk authentication
- [ ] Created first prospecting agent
- [ ] Agent is scoring prospects
- [ ] Can view prospects in dashboard
- [ ] Can create email campaigns
- [ ] Analytics showing data

**Congratulations!** You now have a fully functional AI prospecting agent. 🎉

---

## Cost Estimation

### Running Locally (Free)
- Encore CLI: Free
- PostgreSQL/Redis: Free (local)
- Frontend: Free

### API Costs (Pay-as-you-go)

| Service | Cost per Operation | Monthly Estimate (1000 prospects) |
|---------|-------------------|----------------------------------|
| OpenAI Lead Scoring | $0.001/prospect | $1 |
| OpenAI Email Generation | $0.01/email | $10 |
| Clerk Authentication | Free (up to 5k users) | $0 |
| SendGrid/SMTP | $0.001/email | $1 |
| **Total** | | **~$12/month** |

### Production Hosting

| Option | Cost | Pros |
|--------|------|------|
| Encore Cloud | $29/month | Managed, auto-scaling, zero-config |
| AWS/Docker | $20-50/month | Full control, more complex |
| Heroku | $25/month | Easy, but limited customization |

---

**Ready to generate leads on autopilot?** Start your first agent now! 🚀
