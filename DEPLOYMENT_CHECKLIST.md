# 🚀 AI Prospecting Agent - Production Deployment Checklist

Use this checklist to ensure a smooth production deployment.

---

## Pre-Deployment Checklist

### ✅ Development Testing Complete

- [ ] Application runs successfully locally (`encore run` + `bun run dev`)
- [ ] All critical features tested:
  - [ ] User authentication (Clerk)
  - [ ] Agent creation and control
  - [ ] Prospect scoring with AI
  - [ ] Email campaign creation
  - [ ] Analytics dashboard loading
  - [ ] HubSpot sync (if enabled)
  - [ ] Payment processing (if enabled)
- [ ] No console errors in browser
- [ ] No critical backend errors in `encore logs`

### ✅ Environment Configuration

- [ ] Production `.env` created with real values (not defaults)
- [ ] **CRITICAL** API keys configured:
  - [ ] `OpenAIKey` (starts with `sk-`)
  - [ ] `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
  - [ ] `SMTP_USER` and `SMTP_PASS` (for email sending)
- [ ] **Optional** API keys (if using features):
  - [ ] `HUBSPOT_API_KEY`
  - [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
  - [ ] `SENTRY_DSN` (for error tracking)
- [ ] `JWT_SECRET` is random and secure (32+ characters)
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points to production database
- [ ] `REDIS_URL` points to production Redis

### ✅ Security Audit

- [ ] Hardcoded test keys removed from code
  - [ ] Check `frontend/App.tsx` for Clerk test key
  - [ ] Ensure production Clerk keys are used
- [ ] `.env` file **NOT** committed to git (in `.gitignore`)
- [ ] Secrets stored in secure vault (Encore Secrets, AWS Secrets Manager, etc.)
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled and tested
- [ ] SQL injection protection verified (parameterized queries)
- [ ] XSS protection enabled in React

### ✅ Database & Infrastructure

- [ ] Production PostgreSQL database provisioned
  - [ ] Version 15+ recommended
  - [ ] Backups configured (daily minimum)
  - [ ] Connection pooling enabled
- [ ] Production Redis instance provisioned
  - [ ] Version 7+ recommended
  - [ ] Persistence enabled (AOF + RDB)
  - [ ] Memory limit configured
- [ ] Database migrations tested
  - [ ] Run `encore db migrate` to apply latest migrations
  - [ ] Verify all tables created successfully
- [ ] Monitoring and alerting configured
  - [ ] Database CPU/memory alerts
  - [ ] Redis memory alerts
  - [ ] API error rate alerts

### ✅ Code Quality

- [ ] TypeScript type checking passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Tests pass (if available): `npm test`
- [ ] No `console.log` statements in production code
- [ ] Error handling implemented for all API calls
- [ ] Proper logging configured (use `LOG_LEVEL=info` or `warn`)

---

## Deployment Methods

Choose one of the following deployment methods:

### Option 1: Encore Cloud (Recommended - Easiest)

#### Prerequisites
- [ ] Encore account created at https://app.encore.dev
- [ ] Encore CLI authenticated: `encore auth login`

#### Deployment Steps

1. **Configure Secrets in Encore Cloud**

```bash
# Set secrets via Encore dashboard or CLI
encore secret set OpenAIKey
# Enter your OpenAI key when prompted

encore secret set CLERK_SECRET_KEY
encore secret set SMTP_PASS
# Repeat for all sensitive values
```

2. **Deploy to Encore Cloud**

```bash
# Deploy to production environment
git add .
git commit -m "Production deployment"
git push encore main
```

3. **Verify Deployment**

- [ ] Visit Encore dashboard: https://app.encore.dev
- [ ] Check deployment status (should show "Deployed Successfully")
- [ ] Test API health: `https://your-app.encore.run/health`
- [ ] Access frontend: `https://your-app.encore.run`

4. **Post-Deployment**

- [ ] Run database migrations (auto-run by Encore)
- [ ] Test authentication flow
- [ ] Create test prospect
- [ ] Send test email
- [ ] Monitor logs for errors

#### Checklist

- [ ] Secrets configured in Encore Cloud
- [ ] Git remote added: `git remote add encore encore://your-app-id`
- [ ] Code pushed to Encore
- [ ] Deployment successful (green checkmark in dashboard)
- [ ] Custom domain configured (optional)
- [ ] SSL certificate provisioned (auto by Encore)

---

### Option 2: Docker Deployment (Self-Hosted)

#### Prerequisites

- [ ] Docker and Docker Compose installed
- [ ] Production server/VPS provisioned (2GB RAM minimum, 4GB recommended)
- [ ] Domain name pointed to server IP

#### Deployment Steps

1. **Build Docker Image**

```bash
# Build production image
docker build -t ai-prospecting-agent:latest .

# Or use Docker Compose
docker-compose build
```

2. **Configure Environment**

```bash
# Create .env on server
scp .env your-server:/path/to/app/.env

# Or set environment variables in docker-compose.yml
```

3. **Deploy with Docker Compose**

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

4. **Setup Reverse Proxy (Nginx/Caddy)**

Example Nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

5. **Setup SSL with Let's Encrypt**

```bash
sudo certbot --nginx -d yourdomain.com
```

#### Checklist

- [ ] Docker image built successfully
- [ ] All containers running: `docker-compose ps`
- [ ] PostgreSQL accessible (test connection)
- [ ] Redis accessible (test connection)
- [ ] Nginx/reverse proxy configured
- [ ] SSL certificate installed
- [ ] Domain resolves to server
- [ ] Health check endpoint responding: `curl https://yourdomain.com/api/health`

---

### Option 3: Manual Deployment (Advanced)

#### Prerequisites

- [ ] Node.js 18+ installed on server
- [ ] PostgreSQL 15+ database setup
- [ ] Redis 7+ server setup
- [ ] Process manager (PM2) installed

#### Deployment Steps

1. **Clone Repository**

```bash
git clone <your-repo-url>
cd ai-prospecting-agent
```

2. **Install Dependencies**

```bash
cd backend && bun install
cd ../frontend && bun install
```

3. **Build Frontend**

```bash
cd frontend
bun run build
```

4. **Start Backend with PM2**

```bash
cd backend
pm2 start "encore run --env production" --name prospecting-backend
pm2 save
pm2 startup  # Configure auto-start on reboot
```

5. **Serve Frontend with Nginx**

Configure Nginx to serve `frontend/dist` folder.

#### Checklist

- [ ] Dependencies installed
- [ ] Frontend built (`frontend/dist` exists)
- [ ] Backend running with PM2
- [ ] Frontend served by Nginx
- [ ] Database migrations applied
- [ ] SSL configured
- [ ] PM2 configured to restart on reboot

---

## Post-Deployment Verification

### ✅ Functional Testing

Test these critical flows in production:

- [ ] **Authentication**
  - [ ] Sign up new user
  - [ ] Sign in existing user
  - [ ] Sign out
  - [ ] OAuth providers work (if configured)

- [ ] **Prospect Management**
  - [ ] Create new prospect manually
  - [ ] AI scoring runs automatically
  - [ ] Prospect appears in dashboard
  - [ ] Search/filter works

- [ ] **Agent System**
  - [ ] Create new agent
  - [ ] Start agent
  - [ ] Agent discovers prospects (simulated)
  - [ ] Stop/pause agent

- [ ] **Email Campaigns**
  - [ ] Create campaign
  - [ ] Add prospects to campaign
  - [ ] Send test email
  - [ ] Email actually arrives
  - [ ] Tracking works (opens/clicks)

- [ ] **Analytics**
  - [ ] Dashboard loads
  - [ ] Metrics display correctly
  - [ ] Real-time updates work

- [ ] **Integrations** (if enabled)
  - [ ] HubSpot sync works
  - [ ] Stripe payment works
  - [ ] Webhook endpoints accessible

### ✅ Performance Testing

- [ ] Page load times acceptable (<3s)
- [ ] API response times fast (<500ms for most endpoints)
- [ ] Database queries optimized (check slow query log)
- [ ] Frontend bundle size reasonable (<2MB)
- [ ] Images/assets optimized

### ✅ Monitoring Setup

- [ ] **Error Tracking** (Sentry or similar)
  - [ ] Frontend errors captured
  - [ ] Backend errors captured
  - [ ] Alerts configured for critical errors

- [ ] **Application Monitoring**
  - [ ] Uptime monitoring (UptimeRobot, Pingdom)
  - [ ] API endpoint monitoring
  - [ ] Database connection monitoring

- [ ] **Infrastructure Monitoring**
  - [ ] Server CPU/memory/disk alerts
  - [ ] Database performance monitoring
  - [ ] Redis memory monitoring

- [ ] **Logs**
  - [ ] Centralized logging (CloudWatch, Papertrail, etc.)
  - [ ] Log retention policy (30-90 days)
  - [ ] Log alerts for errors

### ✅ Backup & Recovery

- [ ] **Database Backups**
  - [ ] Automated daily backups configured
  - [ ] Backup retention policy (7 daily, 4 weekly, 12 monthly)
  - [ ] Test restore procedure
  - [ ] Backup verification (ensure backups aren't corrupt)

- [ ] **Code Backups**
  - [ ] Code in version control (GitHub/GitLab)
  - [ ] Tagged release version
  - [ ] Environment config documented

- [ ] **Disaster Recovery Plan**
  - [ ] Recovery time objective (RTO) defined
  - [ ] Recovery point objective (RPO) defined
  - [ ] Runbook for common failures
  - [ ] Emergency contact list

---

## Scaling Checklist (For High Traffic)

### When to Scale

Scale when you see:
- API response times > 1s consistently
- Database CPU > 70% sustained
- Redis memory > 80%
- Error rate > 1%

### Horizontal Scaling

- [ ] Load balancer configured (ALB, NGINX)
- [ ] Multiple backend instances running
- [ ] Session storage in Redis (not in-memory)
- [ ] Database connection pooling configured
- [ ] CDN for frontend assets (CloudFlare, CloudFront)

### Database Scaling

- [ ] Read replicas for analytics queries
- [ ] Database connection pooling (PgBouncer)
- [ ] Indexes on frequently queried columns
- [ ] Query optimization (check EXPLAIN plans)
- [ ] Partitioning for large tables (if needed)

### Caching

- [ ] Redis caching for expensive queries
- [ ] API response caching (React Query handles this)
- [ ] CDN caching for static assets
- [ ] Database query result caching

---

## Security Hardening

### ✅ Pre-Production Security

- [ ] **Secrets Management**
  - [ ] No secrets in code or git history
  - [ ] Secrets rotated regularly (quarterly minimum)
  - [ ] Access to secrets limited (principle of least privilege)

- [ ] **Network Security**
  - [ ] Firewall configured (allow only necessary ports)
  - [ ] Database not publicly accessible
  - [ ] Redis not publicly accessible
  - [ ] VPC/private network configured

- [ ] **Application Security**
  - [ ] HTTPS enforced (redirect HTTP → HTTPS)
  - [ ] HSTS headers enabled
  - [ ] CSP headers configured
  - [ ] Rate limiting on auth endpoints
  - [ ] CSRF protection enabled
  - [ ] Input validation on all endpoints

- [ ] **Compliance**
  - [ ] GDPR data export/deletion working
  - [ ] Privacy policy updated
  - [ ] Terms of service updated
  - [ ] Cookie consent banner (if required)
  - [ ] Audit logging enabled

---

## Rollback Plan

### If Deployment Fails

1. **Identify Issue**
   - Check logs: `encore logs` or `docker-compose logs`
   - Check health endpoint: `/api/health`
   - Check database connectivity

2. **Quick Rollback**

   **Encore Cloud:**
   ```bash
   encore deploy rollback
   ```

   **Docker:**
   ```bash
   docker-compose down
   docker-compose up -d --build <previous-tag>
   ```

   **Manual:**
   ```bash
   git checkout <previous-release-tag>
   pm2 restart all
   ```

3. **Verify Rollback**
   - [ ] Application accessible
   - [ ] Authentication works
   - [ ] Critical features operational

4. **Post-Mortem**
   - Document what went wrong
   - Add test to prevent regression
   - Update deployment checklist

---

## Cost Optimization

### Monthly Cost Breakdown (Estimated)

| Service | Usage | Cost (est.) |
|---------|-------|-------------|
| **Hosting** (Encore/AWS/Docker) | 1 app | $25-50 |
| **Database** (PostgreSQL) | Small instance | $15-30 |
| **Redis** | Small instance | $10-20 |
| **OpenAI API** | 1000 prospects/month | $10-20 |
| **Email Sending** (SendGrid) | 5000 emails/month | $15 |
| **Clerk Auth** | <5000 users | Free |
| **Monitoring** (Sentry) | <5k events | Free |
| **Total** | | **$75-150/month** |

### Optimization Tips

- [ ] Use reserved instances for database (40-60% savings)
- [ ] Enable database auto-scaling (scale down at night)
- [ ] Compress frontend assets (reduce bandwidth)
- [ ] Use CloudFlare free tier for CDN/DDoS protection
- [ ] Optimize OpenAI usage (batch requests, cache results)
- [ ] Set up budget alerts in cloud provider

---

## Final Pre-Launch Checklist

- [ ] All environment variables set correctly
- [ ] Database backups configured and tested
- [ ] Monitoring and alerts configured
- [ ] SSL certificate installed and verified
- [ ] Domain DNS configured correctly
- [ ] All API keys valid and tested
- [ ] Error tracking (Sentry) working
- [ ] Performance acceptable (<3s page loads)
- [ ] Mobile responsiveness tested
- [ ] Cross-browser testing complete (Chrome, Firefox, Safari)
- [ ] Security scan completed (no critical vulnerabilities)
- [ ] Load testing completed (if expecting high traffic)
- [ ] Documentation updated (README, API docs)
- [ ] Team trained on deployment process
- [ ] Rollback plan tested
- [ ] On-call rotation scheduled (if applicable)

---

## 🚀 Ready to Launch!

Once all items are checked:

1. **Announce Maintenance Window** (if replacing existing system)
2. **Final Backup** of current system
3. **Deploy** using chosen method above
4. **Verify** all critical features work
5. **Monitor** closely for first 24-48 hours
6. **Celebrate** 🎉

---

## Support & Resources

- **Documentation**: See `README.md`, `QUICKSTART.md`
- **API Reference**: http://localhost:4000/docs (or production URL)
- **Encore Docs**: https://encore.dev/docs
- **Component Status**: See `COMPONENT_DISABILITY_REPORT.md`

---

**Questions during deployment?** Check logs first, then review this checklist step-by-step.

Good luck with your deployment! 🚀
