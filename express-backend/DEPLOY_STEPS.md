# Express Backend - Deployment Steps

## What's Working Locally (Port 4002)
- ✅ Health check: http://localhost:4002/health
- ✅ Brevo (Email): CONNECTED
- ✅ Twilio (SMS): CONNECTED  
- ✅ Calendly: CONNECTED
- ✅ Lead creation: Proxies to Encore (port 4000)
- ❌ Apollo: Needs API key

## Railway Deployment

### Option 1: Via Web UI (Recommended)
1. Go to https://railway.app/new
2. Click "Login" → "Continue with GitHub"
3. Click "GitHub Repository"
4. Select `bbrysonelite-max/agent-code-Leap-`
5. In "Root Directory" enter: `express-backend`
6. Click "Add Variables":
   - BREVO_API_KEY=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
   - TWILIO_ACCOUNT_SID=AC2f4ff5f248a5994d423aeb45f148de68
   - TWILIO_AUTH_TOKEN=f685c7b0aa3c6bb0b6c71e057a2c54fc
   - TWILIO_PHONE_NUMBER=+14174203825
   - CALENDLY_API_KEY=(the long JWT from .env)
   - CALENDLY_LINK=https://calendly.com/bbrysonelite/30min
   - OPENAI_API_KEY=sk-proj-oLuurUXqa2T_Z95N5t7GCwfjYccp78BqSO4dHkXWaHBP8D6EzGMSjy_2
   - APOLLO_API_KEY=(need from user)
   - PORT=4000
7. Add PostgreSQL database (click "+ New" → "Database" → "Add PostgreSQL")
8. Wait for deploy (~2 minutes)
9. Copy the public URL (will be like: https://something.up.railway.app)

### Option 2: Via CLI
```bash
cd express-backend
railway login
railway init
railway up
```

## After Deployment

### Update Netlify Landing Page
Edit `tiiny-upload/script.js`:
```javascript
const API_URL = 'https://YOUR-RAILWAY-URL.up.railway.app/ai-crm/leads';
```

Re-upload to Netlify.

## Testing Production
```bash
curl https://YOUR-URL.up.railway.app/health
curl https://YOUR-URL.up.railway.app/integrations/health
```

Should return all integrations connected.


