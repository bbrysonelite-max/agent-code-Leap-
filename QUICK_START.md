# Quick Start Guide - Get Your AI CRM Running

## 🚀 Get It Running in 5 Minutes

### Step 1: Start the Backend (Choose One Option)

#### Option A: Using Encore CLI (Recommended for Development)
```bash
# Add Encore to PATH if not already done
export PATH="/root/.encore/bin:$PATH"

# Start the backend
cd /home/user/agent-code-Leap-/backend
encore run
```

The backend will be available at `http://localhost:4000`

#### Option B: Using Docker Compose (Full Stack with Database)
```bash
cd /home/user/agent-code-Leap-
docker-compose --profile dev up
```

### Step 2: Start the Frontend
```bash
# In a new terminal
cd /home/user/agent-code-Leap-/frontend
npx vite dev
```

The frontend will be available at `http://localhost:5173`

---

## 🎯 Test the System End-to-End

### 1. Create Your First Client Configuration

```bash
curl -X POST http://localhost:4000/clients \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "HealthFirst Nutrition",
    "business_type": "network_marketing",
    "business_description": "Health and wellness products distributor",
    "enabled_prospect_types": ["customer", "distributor", "business_builder"],
    "search_config": {
      "target_industries": ["Health & Wellness", "Fitness", "Nutrition"],
      "target_positions": ["Health Coach", "Personal Trainer", "Wellness Consultant"],
      "company_size_range": {
        "min": 1,
        "max": 500
      },
      "include_keywords": ["wellness", "health", "entrepreneur"]
    },
    "messaging_config": {
      "brand_name": "HealthFirst Nutrition",
      "value_proposition": "Help people achieve optimal health while building financial freedom",
      "tone": "friendly",
      "primary_goal": "recruit health-conscious entrepreneurs"
    },
    "daily_limits": {
      "max_prospects_per_day": 50,
      "max_emails_per_day": 100
    }
  }'
```

**Expected Response:**
```json
{
  "id": 1,
  "client_name": "HealthFirst Nutrition",
  "business_type": "network_marketing",
  ...
}
```

### 2. Create an AI Agent

```bash
curl -X POST http://localhost:4000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "name": "Distributor Finder",
    "auto_start": false
  }'
```

**Expected Response:**
```json
{
  "id": 1,
  "client_id": 1,
  "name": "Distributor Finder",
  "status": "stopped",
  "prospects_found_today": 0
}
```

### 3. Find Your First Prospects (Simulated)

```bash
curl -X POST http://localhost:4000/prospects/simulate-search \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": 1,
    "count": 5
  }'
```

**Expected Response:**
```json
{
  "prospects": [
    {
      "id": 1,
      "name": "Sarah Johnson",
      "email": "sarah.johnson@techcorp.com",
      "company": "TechCorp Solutions",
      "position": "Marketing Director",
      "prospect_type": "customer",
      "status": "new"
    },
    ...
  ],
  "message": "Found 5 new recruit health-conscious entrepreneurs prospects for HealthFirst Nutrition"
}
```

### 4. View All Your Prospects

```bash
curl http://localhost:4000/prospects?agent_id=1
```

### 5. Score a Prospect with AI

```bash
curl -X POST http://localhost:4000/scoring/score-prospect \
  -H "Content-Type: application/json" \
  -d '{
    "prospectId": "1",
    "factors": {
      "companySize": 250,
      "position": "VP of Sales",
      "linkedinConnections": 500,
      "linkedinActivity": 8
    }
  }'
```

**Expected Response:**
```json
{
  "prospectId": "1",
  "totalScore": 85,
  "companyScore": 70,
  "positionScore": 85,
  "linkedinScore": 70,
  "emailEngagementScore": 0,
  "priority": "high",
  "reasons": [
    "High-value company profile",
    "Senior decision-maker position",
    "Strong LinkedIn presence",
    "Top-tier prospect for immediate outreach"
  ]
}
```

### 6. Get Priority Prospects (High Scores)

```bash
curl http://localhost:4000/scoring/priority-prospects?limit=10&minScore=70
```

### 7. Generate AI Content for a Prospect

```bash
curl -X POST http://localhost:4000/ai/generate-content \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "classification": "hot",
    "stage": "intent",
    "prospectData": {
      "name": "Sarah Johnson",
      "company": "TechCorp Solutions",
      "position": "Marketing Director",
      "industry": "Technology"
    },
    "context": {
      "brand_name": "HealthFirst Nutrition",
      "value_proposition": "Help people achieve optimal health while building financial freedom"
    }
  }'
```

**Expected Response:**
```json
{
  "subject": "Quick question about your wellness journey, Sarah",
  "content": "Hi Sarah,\n\nI noticed your work at TechCorp Solutions...",
  "reasoning": "Personalized for tech industry professional, warm tone, focus on health-conscious messaging"
}
```

### 8. Start Your Agent

```bash
curl -X PUT http://localhost:4000/agents/1/control \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start"
  }'
```

### 9. Check Agent Status

```bash
curl http://localhost:4000/agents/1/status
```

---

## 📊 Access the Web Dashboard

Open your browser and go to:
```
http://localhost:5173
```

You'll see:
- **Dashboard** - Overview of all activity
- **Prospects** - List of all prospects with scores
- **Priority** - High-priority prospects
- **Analytics** - Performance metrics
- **Agent Controls** - Start/stop your agents
- **Client Management** - Configure your ideal customer

---

## 🎯 Different Business Examples

### Example 1: Real Estate Agent Finding Buyers

```bash
curl -X POST http://localhost:4000/clients \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Premier Realty Group",
    "business_type": "real_estate",
    "enabled_prospect_types": ["customer"],
    "search_config": {
      "target_industries": ["Technology", "Finance", "Healthcare"],
      "target_positions": ["Executive", "Manager", "Professional"],
      "location_preferences": ["Los Angeles", "Orange County"],
      "include_keywords": ["relocating", "house hunting", "buying home"],
      "company_size_range": { "min": 100, "max": 5000 }
    },
    "messaging_config": {
      "brand_name": "Premier Realty Group",
      "value_proposition": "Find your dream home with expert guidance",
      "tone": "professional",
      "primary_goal": "find qualified home buyers"
    }
  }'
```

### Example 2: SaaS Company Finding Enterprise Clients

```bash
curl -X POST http://localhost:4000/clients \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "CloudSoft Solutions",
    "business_type": "saas",
    "enabled_prospect_types": ["leads", "clients"],
    "search_config": {
      "target_industries": ["Technology", "Finance", "Healthcare"],
      "target_positions": ["CTO", "VP Engineering", "Director IT", "Head of Technology"],
      "company_size_range": { "min": 500, "max": 10000 },
      "include_keywords": ["digital transformation", "cloud migration", "automation"]
    },
    "messaging_config": {
      "brand_name": "CloudSoft",
      "value_proposition": "Transform your business with enterprise-grade cloud solutions",
      "tone": "professional",
      "primary_goal": "find enterprise software buyers"
    }
  }'
```

### Example 3: Insurance Agent Finding Leads

```bash
curl -X POST http://localhost:4000/clients \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "SecureLife Insurance",
    "business_type": "insurance",
    "enabled_prospect_types": ["leads", "referrals"],
    "search_config": {
      "target_positions": ["Business Owner", "Executive", "Professional"],
      "company_size_range": { "min": 10, "max": 500 },
      "include_keywords": ["family", "retirement", "protection", "estate planning"]
    },
    "messaging_config": {
      "brand_name": "SecureLife",
      "value_proposition": "Protect what matters most",
      "tone": "friendly",
      "primary_goal": "find insurance prospects"
    }
  }'
```

---

## 🔧 Configuration Options

### Environment Setup (Optional)

Create a `.env` file for additional features:

```bash
# Database (if using Docker)
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_crm
REDIS_URL=redis://localhost:6379

# OpenAI for AI Features (Optional - has fallbacks)
OPENAI_API_KEY=sk-your-key-here

# Stripe for Payments (Optional)
STRIPE_SECRET_KEY=sk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-secret

# HubSpot Integration (Optional)
HUBSPOT_API_KEY=your-hubspot-key

# Clerk Authentication (Optional)
CLERK_SECRET_KEY=sk_test_your-key
```

---

## 🎓 What to Test

### ✅ Basic Functionality
- [ ] Create a client configuration
- [ ] Create an agent
- [ ] Simulate prospect search
- [ ] View prospects in the dashboard
- [ ] Score a prospect
- [ ] View priority prospects

### ✅ AI Features (if OpenAI configured)
- [ ] Generate email content
- [ ] Generate LinkedIn message
- [ ] Get AI insights
- [ ] Auto-classify prospects

### ✅ Automation
- [ ] Start an agent
- [ ] Let it find prospects automatically
- [ ] Check engagement tracking
- [ ] View analytics

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check if port 4000 is already in use
lsof -i :4000

# Kill the process if needed
kill -9 <PID>

# Or use a different port
encore run --port=4001
```

### Frontend Build Errors
```bash
cd /home/user/agent-code-Leap-/frontend
rm -rf node_modules dist
bun install
npx vite dev
```

### Database Connection Issues
```bash
# Make sure PostgreSQL is running
docker-compose --profile dev up postgres

# Or configure local database
# Edit .env with your database URL
```

### OpenAI Not Working
- Make sure OpenAI key is configured in Encore Cloud: `encore auth login`
- Or the system will use smart fallbacks (template-based content)

---

## 📈 Next Steps

1. **Customize Your Configuration** - Fine-tune your ideal customer profile
2. **Test Messaging** - Generate content and refine your value proposition
3. **Set Up Sequences** - Create multi-step nurturing campaigns
4. **Monitor Performance** - Track metrics and adjust strategy
5. **Scale Up** - Increase daily limits as you validate the system

---

## 🆘 Need Help?

- **Documentation**: See `HOW_IT_WORKS.md` for detailed explanations
- **API Reference**: Visit `http://localhost:4000` when backend is running
- **Setup Status**: Check `SETUP_STATUS.md` for current system state

---

**You're all set! Start finding your ideal customers! 🚀**
