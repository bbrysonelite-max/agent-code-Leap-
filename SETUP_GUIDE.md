# AI Prospecting Agent - Step-by-Step Setup Guide

**Estimated Time:** 30-45 minutes
**Difficulty:** Beginner-friendly

---

## STEP 1: Install Required Software

### 1.1 Install Encore CLI (REQUIRED)

The backend won't work without this!

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
# Open PowerShell as Administrator
iwr https://encore.dev/install.ps1 | iex
```

### 1.2 Install Bun (Package Manager)

```bash
npm install -g bun
```

*If you don't have npm, install Node.js from https://nodejs.org first*

### 1.3 Verify Installations

```bash
encore version  # Should show version number
bun --version   # Should show version number
```

---

## STEP 2: Get API Keys

### 2.1 OpenAI API Key (CRITICAL ⚠️)

**Required for AI features**

1. Go to: https://platform.openai.com/signup
2. Create an account (or sign in)
3. Click your profile icon → "View API Keys"
4. Click "Create new secret key"
5. **Copy the key** (starts with `sk-proj-` or `sk-`)
6. **SAVE THIS KEY** - you'll need it in Step 3

**Cost:** ~$5-20 for initial testing (very affordable)

### 2.2 Gmail App Password (Required for sending emails)

1. Go to: https://myaccount.google.com
2. Enable **2-Factor Authentication** (if not already enabled)
3. Go to: https://myaccount.google.com/apppasswords
4. Select "Mail" and your device
5. Click "Generate"
6. **Copy the 16-character password** (no spaces)
7. **SAVE THIS PASSWORD** - you'll need it in Step 3

### 2.3 Clerk Authentication (Optional for now)

You can skip this - the app has a test key built-in.

For production later, get keys from: https://dashboard.clerk.com

---

## STEP 3: Configure the Application

### 3.1 Navigate to Project Folder

```bash
cd /path/to/agent-code-Leap-
```

### 3.2 Create Environment File

```bash
cp .env.example .env
```

*On Windows: `copy .env.example .env`*

### 3.3 Edit the .env File

Open `.env` in any text editor (Notepad, VS Code, etc.)

**Update these lines:**

```bash
# Replace this line:
OpenAIKey=your_openai_api_key_starting_with_sk

# With your actual key:
OpenAIKey=sk-proj-YOUR_ACTUAL_KEY_HERE

# Replace this line:
SMTP_USER=your_email@gmail.com

# With your email:
SMTP_USER=youremail@gmail.com

# Replace this line:
SMTP_PASS=your_gmail_app_password

# With your 16-character password:
SMTP_PASS=your16characterpassword
```

**Save the file and close it.**

---

## STEP 4: Validate Your Setup

### 4.1 Run the Setup Checker

```bash
./check-setup.sh
```

*On Windows, you might need Git Bash or WSL*

### 4.2 Review the Results

The script checks:
- ✅ Encore CLI installed
- ✅ Dependencies ready
- ✅ API keys configured
- ✅ Ports available

**If you see RED errors (✗), fix them before continuing.**
Yellow warnings (⚠️) are OK for now.

---

## STEP 5: Start the Backend

### 5.1 Open Terminal Window #1

Keep this terminal open - the backend will run here.

### 5.2 Navigate to Backend

```bash
cd backend
```

### 5.3 Start Encore

```bash
encore run
```

**Wait for:**
- `✔ Running...` message
- `Your API is running at: http://localhost:4000`

This might take 1-2 minutes on first run while it:
- Downloads dependencies
- Starts PostgreSQL database
- Runs database migrations
- Starts all 22 microservices

### 5.4 Verify Backend is Running

You should see:
- `✔ Running...` message
- List of services (agent, prospect, scoring, etc.)
- No red error messages

**✅ Leave this terminal window open and running!**

---

## STEP 6: Start the Frontend

### 6.1 Open NEW Terminal Window #2

Don't close the backend terminal - open a **second** one.

### 6.2 Navigate to Frontend

```bash
cd /path/to/agent-code-Leap-/frontend
```

### 6.3 Install Dependencies (First Time Only)

```bash
bun install
```

This takes 1-2 minutes.

### 6.4 Start Frontend

```bash
bun run dev
```

**Wait for:**
- `VITE v6.x ready in XXX ms`
- `Local: http://localhost:5173/`

### 6.5 Verify Frontend is Running

You should see:
- `Local: http://localhost:5173/` message
- No red error messages

**✅ Leave this terminal window open too!**

---

## STEP 7: Access the Application

### 7.1 Open Your Browser

Go to: **http://localhost:5173**

### 7.2 Sign In

You'll see: **"Welcome to AI CRM Platform"**

1. Click **"Sign in"**
2. Create a new account:
   - Enter your email
   - Create a password
   - OR sign in with Google/GitHub

This uses Clerk authentication (secure and free).

### 7.3 Success! 🎉

After signing in, you'll see the **Dashboard** with:
- Sidebar navigation on the left
- Main dashboard in the center
- Metrics and charts (empty at first)

---

## STEP 8: Create Your First Prospecting Agent

### 8.1 Navigate to Agent Controls

Click **"Agent Controls"** in the left sidebar

### 8.2 Create New Agent

Click **"Create New Agent"** button

**Fill in:**
- **Agent Name:** "My First Agent"
- **Description:** "Testing the prospecting system"
- **Target Industry:** "Technology"
- **Company Size:** "10-500 employees"

### 8.3 Start the Agent

1. Click **"Save"**
2. Click **"Start Agent"**

**The agent will:**
- ✅ Simulate prospect discovery
- ✅ Score prospects using AI
- ✅ Classify leads automatically
- ✅ Populate your prospects list

### 8.4 View Prospects

Click **"Prospects"** in the left sidebar

**You'll see:**
- List of discovered prospects
- AI-generated scores (0-100)
- Classification badges (Business Builder, Product Customer, etc.)
- Contact information

---

## STEP 9: Create an Email Campaign

### 9.1 Navigate to Campaigns

Click **"Campaigns"** in the left sidebar

### 9.2 Create New Campaign

Click **"New Campaign"**

**Fill in:**
- **Campaign Name:** "First Outreach"
- **Email Subject:** "Quick question about {{company}}"
- **Email Body:** Use the template or let AI generate content

### 9.3 Add Prospects

- Select prospects to include
- Filter by score (e.g., score > 70)
- Click to add to campaign

### 9.4 Launch Campaign

Click **"Launch Campaign"**

**Results:**
- Emails queued and sent
- Track opens, clicks, replies in real-time
- View analytics in the dashboard

---

## STEP 10: Explore the Platform

### Navigation Menu

| Section | What It Does |
|---------|-------------|
| **Dashboard** | Overview of all activity and metrics |
| **Prospects** | Full prospect database with search/filter |
| **Priority Leads** | Highest-scored prospects |
| **Campaigns** | Email campaign management |
| **Analytics** | Performance charts and reports |
| **AI CRM** | Additional CRM features |
| → Leads | Lead management |
| → Deals | Sales pipeline |
| → Integration | CRM settings |
| **HubSpot** | Sync with HubSpot CRM (optional) |
| **Payments** | Billing management (optional) |

---

## Troubleshooting

### Problem: Backend won't start

**Solution:**
```bash
# Check Encore is installed
encore version

# Update Encore
brew upgrade encore  # macOS
curl -L https://encore.dev/install.sh | bash  # Linux

# Check logs
encore logs

# Make sure port 4000 is free
lsof -ti:4000 | xargs kill -9
```

### Problem: Frontend shows "Cannot connect to backend"

**Solution:**
1. Make sure backend is running (Step 5)
2. Check: http://localhost:4000
3. Look for CORS errors in browser console (press F12)

### Problem: AI features not working

**Solution:**
```bash
# Verify OpenAI key in .env
grep OpenAIKey .env

# Make sure key starts with "sk-"
# Check backend logs
encore logs | grep ai

# Ensure you have OpenAI credits
```

### Problem: Emails not sending

**Solution:**
1. Verify Gmail app password in .env
2. Check 2FA is enabled on Gmail
3. Look for SMTP errors in backend logs

### Problem: Authentication fails

**Solution:**
1. Clear browser cookies/cache
2. Try incognito/private browsing
3. Check Clerk status: https://status.clerk.com

### Problem: Port already in use

**Solution:**
```bash
# Free backend port
lsof -ti:4000 | xargs kill -9

# Free frontend port
lsof -ti:5173 | xargs kill -9
```

---

## What to Do Next

Now that you're up and running:

1. ✅ Create multiple prospecting agents for different segments
2. ✅ Build email nurturing sequences
3. ✅ Connect HubSpot if you use it (optional)
4. ✅ Analyze which email templates perform best
5. ✅ Fine-tune lead scoring criteria
6. ✅ Export high-value prospects to your CRM

---

## Shutting Down

When you're done for the day:

1. **Stop Frontend:** Go to frontend terminal, press `Ctrl+C`
2. **Stop Backend:** Go to backend terminal, press `Ctrl+C`

**To start again later:** Just repeat Steps 5 and 6.

---

## Getting Help

**Documentation:**
- Full guide: `QUICKSTART.md`
- Deployment: `DEPLOYMENT_CHECKLIST.md`
- Architecture: `README.md`
- Component status: `COMPONENT_DISABILITY_REPORT.md`

**External Resources:**
- Encore Docs: https://encore.dev/docs
- Clerk Docs: https://clerk.com/docs
- OpenAI Docs: https://platform.openai.com/docs

---

## Cost Breakdown

**Monthly costs for moderate usage (1,000 prospects/month):**

| Service | Cost |
|---------|------|
| OpenAI API | $10-20/month |
| Email sending | $15/month (or free with Gmail) |
| Clerk Auth | Free (up to 5,000 users) |
| Database | Free (local) or $15/month (hosted) |
| Hosting | Free (local) or $29/month (Encore Cloud) |
| **Total Local** | **$10-35/month** |
| **Total Hosted** | **$69-94/month** |

---

## Production Deployment

Once you've tested locally and are ready to deploy for real use:

**See `DEPLOYMENT_CHECKLIST.md` for:**
- ☁️ Deploying to Encore Cloud (easiest)
- 🐳 Deploying with Docker (self-hosted)
- 🔒 Security hardening
- 💾 Backup configuration
- 📊 Monitoring setup

---

## You're All Set! 🚀

**Start prospecting with AI!**

Questions? Check the documentation files or create a GitHub issue.

---

**Happy Prospecting!** 🎯
