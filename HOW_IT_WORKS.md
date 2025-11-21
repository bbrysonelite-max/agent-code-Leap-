# How Your AI CRM Works - Complete Guide

## 🎯 What This System Does

This is an **AI-Powered Prospect Finding & Qualification System** that:

1. **Finds prospects** based on YOUR ideal customer criteria
2. **Scores & qualifies** them automatically using AI
3. **Generates personalized content** for outreach (emails, messages, etc.)
4. **Tracks engagement** and adjusts scores in real-time
5. **Automates follow-up** sequences based on prospect behavior

---

## 🏢 Business Types Supported

The system works for multiple business models:

- **Network Marketing** - Find distributors, business builders, recruits
- **Direct Sales** - Find customers, leads, referrals
- **Real Estate** - Find buyers, sellers, partners
- **Insurance** - Find clients, leads
- **Consulting** - Find clients, partners
- **Coaching** - Find clients, students
- **E-commerce** - Find customers, affiliates
- **SaaS** - Find customers, partners
- **Recruitment** - Find candidates, clients
- **Custom** - Define your own business model

---

## 👥 Prospect Types You Can Find

Depending on your business, you can search for:

- **Customers** - People who buy your product/service
- **Distributors** - People who sell your products
- **Business Builders** - People who build teams
- **Recruits** - People joining your team
- **Leads** - Potential customers
- **Referrals** - Referred prospects
- **Partners** - Strategic partners
- **Clients** - Service clients
- **Custom Types** - Define your own

---

## ⚙️ Step 1: Configure Your Ideal Customer Profile

When you create a **Client Configuration**, you define:

### 1. Business Information
```json
{
  "client_name": "My Business",
  "business_type": "network_marketing",
  "business_description": "Health & wellness products"
}
```

### 2. Prospect Types to Find
```json
{
  "enabled_prospect_types": [
    "customer",
    "distributor",
    "business_builder"
  ]
}
```

### 3. Search Criteria (Your Ideal Customer)
```json
{
  "search_config": {
    "target_industries": [
      "Health & Wellness",
      "Fitness",
      "Nutrition"
    ],
    "target_positions": [
      "Health Coach",
      "Personal Trainer",
      "Nutritionist",
      "Wellness Consultant",
      "Entrepreneur"
    ],
    "company_size_range": {
      "min": 1,
      "max": 500
    },
    "location_preferences": [
      "United States",
      "Canada"
    ],
    "include_keywords": [
      "wellness",
      "health",
      "entrepreneur",
      "side hustle",
      "passive income"
    ],
    "exclude_keywords": [
      "not interested",
      "MLM hater"
    ]
  }
}
```

### 4. Messaging & Branding
```json
{
  "messaging_config": {
    "brand_name": "HealthFirst Nutrition",
    "value_proposition": "Help people achieve optimal health while building financial freedom",
    "tone": "friendly",
    "primary_goal": "recruit health-conscious entrepreneurs"
  }
}
```

### 5. Daily Limits
```json
{
  "daily_limits": {
    "max_prospects_per_day": 50,
    "max_emails_per_day": 100
  }
}
```

---

## 🔍 Step 2: How Prospects Are Found

### Automatic Search
When your **Agent** is running, it searches for prospects based on your configuration:

1. Searches LinkedIn, databases, and other sources
2. Filters by your target industries, positions, keywords
3. Checks against exclude keywords
4. Verifies company size and location preferences
5. Creates prospect records in your CRM

### Manual/Simulated Search
You can also:
- Import prospects manually
- Use "Simulate Search" to generate test prospects
- Import from CSV/spreadsheets

---

## 🎯 Step 3: How AI Scoring Works

Every prospect gets scored on a **0-100 scale** based on:

### Company Score (20% weight)
- **Company Size**
  - 1000+ employees = 100 points
  - 500-999 = 85 points
  - 100-499 = 70 points
  - 50-99 = 55 points
  - 10-49 = 40 points
  - <10 = 20 points
- **Company Revenue**
  - $100M+ = Bonus points
  - $10M-$100M = Moderate bonus

### Position Score (40% weight)
Based on seniority and decision-making power:
- **C-Level** (CEO, CTO, CFO) = 95-100 points
- **President/Founder/Owner** = 85-90 points
- **VP/Director** = 80-85 points
- **Manager** = 70 points
- **Senior/Lead** = 60-65 points
- **Specialist** = 50 points
- **Associate/Coordinator** = 35-40 points

Keywords add bonus points:
- Decision-making authority (+15)
- Business/strategy focus (+10)

### LinkedIn Activity (10% weight)
- **500+ connections** = 40 points
- **200-499 connections** = 30 points
- **50-199 connections** = 20 points
- **<50 connections** = 10 points

Activity level:
- **Highly active** (10+ posts/month) = 40 points
- **Moderately active** (5-9 posts/month) = 30 points
- **Some activity** (1-4 posts/month) = 20 points

### Email Engagement (30% weight)
- **Open rate** × 40% of score
- **Click rate** × 60% of score
- **Replies** = +30 points
- **Recent engagement** (<7 days) = +20 points
- **Monthly engagement** (<30 days) = +10 points

---

## 📊 Step 4: Prospect Classification

Based on total score, prospects are classified:

### Priority Levels
- **80-100 points** = HIGH priority (hot leads)
  - "Top-tier prospect for immediate outreach"
  - Contact within 24 hours

- **60-79 points** = MEDIUM priority (warm leads)
  - "Good prospect worth pursuing"
  - Contact within 3-5 days

- **0-59 points** = LOW priority (cold leads)
  - "Lower priority, consider nurturing"
  - Add to nurturing sequence

### AI Classification Categories
If OpenAI is configured, prospects are also classified as:

- **HOT** - Ready to buy/join now
- **WARM** - Interested, needs nurturing
- **COLD** - Needs significant warming up
- **NURTURE** - Long-term follow-up needed
- **UNQUALIFIED** - Not a good fit

### Customer Journey Stage
- **Awareness** - Just learning about you
- **Interest** - Showing interest
- **Consideration** - Evaluating options
- **Intent** - Ready to move forward
- **Evaluation** - Final decision stage
- **Purchase** - Ready to buy/join

---

## 🤖 Step 5: AI-Generated Content

The system generates personalized content for each prospect:

### Email Templates
Based on prospect's:
- Classification (hot/warm/cold)
- Stage (awareness/interest/consideration)
- Position and company
- Industry

Example for a HOT prospect in INTENT stage:
```
Subject: Quick question about your wellness coaching business

Hi [Name],

I noticed your work at [Company] and your focus on [Industry].
I'm reaching out because I think you'd be perfect for what we're
building at [Brand Name].

[Value Proposition tailored to their role and interests]

Are you open to a quick 15-minute call this week?

Best,
[Your Name]
```

### SMS Messages
Short, friendly, direct messages

### LinkedIn Messages
Professional, relationship-building

### Phone Scripts
Conversation starters and talking points

---

## 📈 Step 6: Engagement Tracking

The system tracks every interaction:

### Email Opens
- Increases engagement score
- Triggers follow-up sequences
- Updates prospect priority

### Link Clicks
- Higher engagement score boost
- Indicates strong interest
- May upgrade to HOT classification

### Replies
- Significant score boost
- Triggers immediate notification
- Prioritizes for quick response

### Time-Based Updates
- Recent engagement = higher scores
- No engagement = score decay
- Automatic re-engagement sequences

---

## 🎬 Step 7: Automated Sequences

Create multi-step nurturing sequences:

### Example Distributor Recruitment Sequence
```
Day 1: Initial email (introduction)
Day 3: Follow-up email (value proposition)
Day 5: LinkedIn connection request
Day 7: Video message (testimonial)
Day 10: SMS (limited-time opportunity)
Day 14: Phone call (if opened emails)
Day 21: Final email (last chance)
```

Each step adapts based on:
- Previous engagement
- Current score
- Classification changes

---

## 💡 How to Use the System

### 1. Create Your Client Configuration
```bash
POST /clients
{
  # Your ideal customer profile (see Step 1 above)
}
```

### 2. Create an Agent
```bash
POST /agents
{
  "client_id": 1,
  "name": "Distributor Finder",
  "status": "running"
}
```

### 3. Start Finding Prospects

#### Option A: Automated Search
Agent automatically finds prospects based on your configuration

#### Option B: Manual Search
```bash
POST /prospects/simulate-search
{
  "agent_id": 1,
  "count": 10
}
```

### 4. View & Score Prospects
```bash
# Get all prospects
GET /prospects?agent_id=1

# Get priority prospects (high scores)
GET /scoring/priority-prospects?limit=20&minScore=70

# Score individual prospect
POST /scoring/score-prospect
{
  "prospectId": "123",
  "factors": {
    "companySize": 250,
    "position": "VP of Sales",
    "linkedinConnections": 500
  }
}
```

### 5. Generate Content
```bash
POST /ai/generate-content
{
  "type": "email",
  "classification": "hot",
  "stage": "intent",
  "prospectData": {
    "name": "John Doe",
    "company": "TechCorp",
    "position": "VP Sales"
  }
}
```

### 6. Track Engagement
```bash
POST /nurturing/email-interaction
{
  "prospect_id": 123,
  "interaction_type": "open",
  "communication_id": 456
}
```

---

## 📊 What You Get: The Dashboard

Your dashboard shows:

### Today's Activity
- Prospects found today
- Emails sent
- Responses received
- Conversion rate

### Priority Prospects
- High-score prospects requiring immediate attention
- Warm prospects for follow-up
- Prospects with recent engagement

### AI Insights
- "High engagement from healthcare industry"
- "VP-level prospects responding well to value proposition"
- "Best outreach time: Tuesday 10am"

### Performance Metrics
- Total prospects in pipeline
- Average score by type
- Conversion rates by classification
- ROI tracking

---

## 🔑 Key Configuration Examples

### Network Marketing - Finding Distributors
```json
{
  "business_type": "network_marketing",
  "enabled_prospect_types": ["distributor", "business_builder"],
  "search_config": {
    "target_industries": ["Health", "Wellness", "Fitness"],
    "target_positions": ["Entrepreneur", "Coach", "Trainer"],
    "include_keywords": ["side hustle", "passive income", "network marketing"]
  },
  "messaging_config": {
    "tone": "friendly",
    "primary_goal": "recruit motivated entrepreneurs"
  }
}
```

### Real Estate - Finding Buyers
```json
{
  "business_type": "real_estate",
  "enabled_prospect_types": ["customer"],
  "search_config": {
    "location_preferences": ["Los Angeles", "San Diego"],
    "include_keywords": ["house hunting", "first-time buyer", "relocating"],
    "company_size_range": { "min": 50, "max": 5000 }
  },
  "messaging_config": {
    "tone": "professional",
    "primary_goal": "find qualified home buyers"
  }
}
```

### SaaS - Finding Enterprise Clients
```json
{
  "business_type": "saas",
  "enabled_prospect_types": ["leads", "clients"],
  "search_config": {
    "target_industries": ["Technology", "Finance", "Healthcare"],
    "target_positions": ["CTO", "VP Engineering", "Director IT"],
    "company_size_range": { "min": 500, "max": 10000 }
  },
  "messaging_config": {
    "tone": "professional",
    "primary_goal": "find enterprise software buyers"
  }
}
```

---

## 🎓 Best Practices

### 1. Define Clear Criteria
- Be specific about your ideal customer
- Include 5-10 target industries
- List 10-15 target positions
- Use relevant keywords

### 2. Start Small
- Begin with 10-20 prospects per day
- Test your messaging
- Refine based on engagement

### 3. Monitor & Adjust
- Track which positions respond best
- Refine your target criteria
- Adjust messaging tone

### 4. Use AI Wisely
- Configure OpenAI key for best results
- Review AI-generated content before sending
- Use AI insights to improve targeting

### 5. Follow Up Consistently
- Create multi-touch sequences
- Don't give up after one email
- Use multiple channels (email, LinkedIn, phone)

---

## 🚀 Quick Start Checklist

- [ ] Create client configuration with ideal customer profile
- [ ] Create agent to start finding prospects
- [ ] Configure OpenAI key (optional but recommended)
- [ ] Start with simulated search to test
- [ ] Review and score first batch of prospects
- [ ] Generate and customize content templates
- [ ] Set up nurturing sequences
- [ ] Monitor dashboard daily
- [ ] Adjust criteria based on results

---

## ❓ Common Questions

**Q: How many prospects will I get?**
A: Depends on your daily limits and how specific your criteria are. Start with 10-20/day.

**Q: Do I need OpenAI?**
A: No! The system has smart fallbacks. But OpenAI gives you better content and insights.

**Q: Can I import existing prospects?**
A: Yes! You can manually create prospects or import from CSV.

**Q: How accurate is the scoring?**
A: Very accurate for standard B2B. Improves with engagement data over time.

**Q: Can I customize the scoring?**
A: Yes! You can adjust weights for different factors.

**Q: What if my business is unique?**
A: Use "custom" business type and define your own prospect types!

---

## 🎯 Success Metrics to Track

1. **Prospect Quality Score** - Average score of found prospects
2. **Engagement Rate** - % who open/click emails
3. **Response Rate** - % who reply
4. **Conversion Rate** - % who become customers/distributors
5. **Time to Convert** - Days from prospect to conversion
6. **ROI** - Revenue vs. system cost

---

**Ready to find your ideal customers? Start with Step 1: Configure Your Client!** 🚀
