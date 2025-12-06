import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { ApolloClient } from './integrations/apollo.js';
import { BrevoClient } from './integrations/brevo.js';
import { TwilioClient } from './integrations/twilio.js';
import { CalendlyClient } from './integrations/calendly.js';

const app = express();
const port = process.env.PORT || 4000;

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/test',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Auto-create database table on startup
async function initDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        company TEXT,
        website TEXT,
        notes TEXT,
        source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        priority TEXT NOT NULL DEFAULT 'medium',
        ai_score INTEGER NOT NULL DEFAULT 0,
        linkedin_profile TEXT,
        position TEXT,
        assigned_to TEXT,
        ai_qualification TEXT,
        next_best_action TEXT,
        last_activity_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database table ready');
  } catch (error) {
    console.error('Database init error:', error);
  }
}

initDatabase();

// Initialize clients
const apollo = new ApolloClient(process.env.APOLLO_API_KEY!);
const brevo = new BrevoClient(process.env.BREVO_API_KEY!);
const twilio = new TwilioClient(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
  process.env.TWILIO_PHONE_NUMBER!
);
const calendly = new CalendlyClient(process.env.CALENDLY_API_KEY!, process.env.CALENDLY_LINK!);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== LEADS API ====================
app.post('/ai-crm/leads', async (req, res) => {
  try {
    const { name, email, phone, company, website, notes, source } = req.body;
    
    const result = await db.query(
      `INSERT INTO leads (name, email, phone, company, website, notes, source, status, priority, ai_score, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [name, email, phone || null, company || null, website || null, notes || null, source, 'new', 'medium', 0]
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Create lead error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: 'A lead with this email already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// ==================== INTEGRATIONS API ====================

// Apollo - Search prospects
app.post('/integrations/apollo/search', async (req, res) => {
  try {
    const result = await apollo.searchPeople(req.body);
    res.json({
      people: result.people,
      total: result.pagination.total_entries,
    });
  } catch (error: any) {
    console.error('Apollo search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Brevo - Send email
app.post('/integrations/brevo/send', async (req, res) => {
  try {
    const result = await brevo.sendEmail(req.body);
    res.json({ messageId: result.messageId });
  } catch (error: any) {
    console.error('Brevo send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Brevo - Get stats
app.get('/integrations/brevo/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const stats = await brevo.getStatistics(days);
    res.json({ stats });
  } catch (error: any) {
    console.error('Brevo stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Twilio - Send SMS
app.post('/integrations/twilio/send', async (req, res) => {
  try {
    const result = await twilio.sendSMS(req.body);
    res.json({ sid: result.sid, status: result.status });
  } catch (error: any) {
    console.error('Twilio send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Calendly - Get link
app.get('/integrations/calendly/link', async (req, res) => {
  try {
    res.json({ link: calendly.getBookingLink() });
  } catch (error: any) {
    console.error('Calendly link error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Integrations health check
app.get('/integrations/health', async (req, res) => {
  const integrations: Record<string, any> = {};

  try {
    await apollo.searchPeople({ per_page: 1 });
    integrations.apollo = { status: 'connected' };
  } catch (error: any) {
    integrations.apollo = { status: 'error', message: error.message };
  }

  try {
    await brevo.getStatistics(1);
    integrations.brevo = { status: 'connected' };
  } catch (error: any) {
    integrations.brevo = { status: 'error', message: error.message };
  }

  try {
    await twilio.getRecentMessages(1);
    integrations.twilio = { status: 'connected' };
  } catch (error: any) {
    integrations.twilio = { status: 'error', message: error.message };
  }

  try {
    await calendly.getCurrentUser();
    integrations.calendly = { status: 'connected' };
  } catch (error: any) {
    integrations.calendly = { status: 'error', message: error.message };
  }

  res.json({ integrations });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 AI Lead OS Backend running on port ${port}`);
  console.log(`📍 Health: http://localhost:${port}/health`);
  console.log(`📍 Integrations: http://localhost:${port}/integrations/health`);
});

