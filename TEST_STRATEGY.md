# 🧪 Test Strategy - AI Prospecting Agent Platform

**Version**: 1.0.0
**Last Updated**: 2025-11-22

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Test Pyramid](#test-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Compatibility Testing](#compatibility-testing)
9. [Test Environment Setup](#test-environment-setup)
10. [CI/CD Integration](#cicd-integration)
11. [Test Coverage Goals](#test-coverage-goals)
12. [Test Execution Plan](#test-execution-plan)

---

## Testing Overview

### Objectives

1. **Quality Assurance**: Ensure all features work as specified
2. **Regression Prevention**: Catch breaking changes before production
3. **Performance Validation**: Meet performance targets (<500ms API response)
4. **Security Compliance**: Pass OWASP Top 10 security checks
5. **User Experience**: Ensure smooth, bug-free user experience

### Testing Principles

- **Shift Left**: Test early and often in development cycle
- **Automated First**: Automate repetitive tests
- **Test Data Management**: Use realistic test data
- **Continuous Testing**: Run tests on every commit
- **Fail Fast**: Identify issues quickly

---

## Test Pyramid

```
                    ▲
                   ╱ ╲
                  ╱   ╲
                 ╱ E2E ╲          10%    Slow, Expensive
                ╱───────╲
               ╱         ╲
              ╱Integration╲       30%    Medium Speed/Cost
             ╱─────────────╲
            ╱               ╲
           ╱   Unit Tests    ╲    60%    Fast, Cheap
          ╱─────────────────── ╲
         └─────────────────────┘
```

### Test Distribution

| Test Type | Percentage | Count (Estimated) | Execution Time |
|-----------|------------|-------------------|----------------|
| **Unit Tests** | 60% | ~600 tests | <5 minutes |
| **Integration Tests** | 30% | ~300 tests | ~15 minutes |
| **E2E Tests** | 10% | ~100 tests | ~30 minutes |

---

## Unit Testing

### Technology Stack

- **Framework**: Vitest (for both frontend and backend)
- **Assertion Library**: Built-in Vitest assertions
- **Mocking**: Vitest mocks
- **Coverage**: c8 (built-in with Vitest)

### What to Test

**Backend (Encore.ts Services)**:
- Business logic functions
- Data validation
- Scoring algorithms
- Email generation
- Utility functions

**Frontend (React Components)**:
- Component rendering
- User interactions
- State management
- Form validation
- Utility functions

### Coverage Goals

| Component | Coverage Target |
|-----------|----------------|
| **Business Logic** | 90%+ |
| **API Endpoints** | 80%+ |
| **React Components** | 70%+ |
| **Utility Functions** | 90%+ |
| **Overall** | 80%+ |

### Example Unit Tests

#### Backend: Scoring Algorithm

```typescript
// backend/scoring/algorithm.test.ts
import { describe, it, expect } from 'vitest';
import { calculateProspectScore } from './algorithm';

describe('Prospect Scoring Algorithm', () => {
  it('should score C-level executive at large company as high priority', () => {
    const factors = {
      company_size: 500,
      company_revenue: 50000000,
      position: 'CEO',
      seniority: 'c_level',
      linkedin_connections: 500,
      linkedin_activity: 10,
      email_open_rate: 50,
      email_click_rate: 20,
    };

    const score = calculateProspectScore(factors);

    expect(score.total_score).toBeGreaterThan(80);
    expect(score.priority).toBe('high');
    expect(score.reasons).toContain('C-level position');
  });

  it('should score individual contributor at small company as low priority', () => {
    const factors = {
      company_size: 10,
      company_revenue: 1000000,
      position: 'Junior Developer',
      seniority: 'individual_contributor',
      linkedin_connections: 50,
      linkedin_activity: 1,
    };

    const score = calculateProspectScore(factors);

    expect(score.total_score).toBeLessThan(60);
    expect(score.priority).toBe('low');
  });

  it('should handle missing factors gracefully', () => {
    const factors = {
      position: 'Manager',
    };

    const score = calculateProspectScore(factors);

    expect(score.total_score).toBeGreaterThan(0);
    expect(score).toHaveProperty('company_score');
    expect(score).toHaveProperty('position_score');
  });
});
```

#### Frontend: Prospect Management Component

```typescript
// frontend/components/ProspectManagement.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProspectManagement } from './ProspectManagement';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('ProspectManagement Component', () => {
  it('should render prospect list', async () => {
    render(<ProspectManagement />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Prospect Management')).toBeInTheDocument();
    });
  });

  it('should filter prospects by search query', async () => {
    render(<ProspectManagement />, { wrapper });

    const searchInput = screen.getByPlaceholderText('Search prospects...');
    fireEvent.change(searchInput, { target: { value: 'John Doe' } });

    await waitFor(() => {
      // Verify filtered results
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should open create prospect modal on button click', () => {
    render(<ProspectManagement />, { wrapper });

    const createButton = screen.getByText('Create Prospect');
    fireEvent.click(createButton);

    expect(screen.getByText('Create New Prospect')).toBeInTheDocument();
  });
});
```

---

## Integration Testing

### What to Test

- API endpoint functionality
- Database operations
- External API integrations
- Service-to-service communication
- Authentication & authorization

### Technology Stack

- **Framework**: Vitest + Supertest (API testing)
- **Database**: Test database (PostgreSQL)
- **Mocking**: Mock external APIs (OpenAI, HubSpot, Stripe)

### Example Integration Tests

#### API Endpoint Testing

```typescript
// backend/prospect/create.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { testAPI } from '~encore/internal/testing';
import { prospect } from './create';
import { db } from './db';

describe('Prospect API', () => {
  beforeEach(async () => {
    // Setup test database
    await db.exec('BEGIN');
  });

  afterEach(async () => {
    // Rollback test database
    await db.exec('ROLLBACK');
  });

  describe('POST /prospect/create', () => {
    it('should create a prospect with valid data', async () => {
      const req = {
        client_id: 1,
        agent_id: 1,
        name: 'John Doe',
        email: 'john.doe@example.com',
        company: 'Acme Inc',
        position: 'VP of Sales',
        prospect_type: 'customer',
      };

      const response = await testAPI(prospect.create, req);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('John Doe');
      expect(response.body.email).toBe('john.doe@example.com');
    });

    it('should reject prospect with invalid email', async () => {
      const req = {
        client_id: 1,
        agent_id: 1,
        name: 'John Doe',
        email: 'invalid-email',
        prospect_type: 'customer',
      };

      const response = await testAPI(prospect.create, req);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email');
    });

    it('should respect daily prospect limits', async () => {
      // Create 50 prospects (daily limit)
      for (let i = 0; i < 50; i++) {
        await testAPI(prospect.create, {
          client_id: 1,
          agent_id: 1,
          name: `Prospect ${i}`,
          email: `prospect${i}@example.com`,
          prospect_type: 'customer',
        });
      }

      // 51st prospect should be rejected
      const response = await testAPI(prospect.create, {
        client_id: 1,
        agent_id: 1,
        name: 'Prospect 51',
        email: 'prospect51@example.com',
        prospect_type: 'customer',
      });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Daily limit exceeded');
    });

    it('should enforce multi-tenant isolation', async () => {
      // Create prospect for client 1
      await testAPI(prospect.create, {
        client_id: 1,
        agent_id: 1,
        name: 'Client 1 Prospect',
        email: 'client1@example.com',
        prospect_type: 'customer',
      });

      // Try to access as client 2
      const response = await testAPI(prospect.list, {
        client_id: 2,
      });

      expect(response.body.prospects).not.toContainEqual(
        expect.objectContaining({ email: 'client1@example.com' })
      );
    });
  });
});
```

#### Email Service Integration

```typescript
// backend/email/send.test.ts
import { describe, it, expect, vi } from 'vitest';
import { testAPI } from '~encore/internal/testing';
import { email } from './send';
import * as smtpTransport from './smtp';

describe('Email Service', () => {
  it('should send email successfully', async () => {
    // Mock SMTP transport
    const sendMailMock = vi.spyOn(smtpTransport, 'sendMail').mockResolvedValue({
      messageId: 'test-message-id',
      accepted: ['prospect@example.com'],
      rejected: [],
    });

    const req = {
      client_id: 1,
      prospect_id: 1,
      subject: 'Test Email',
      body: 'Hello {{name}}!',
    };

    const response = await testAPI(email.send, req);

    expect(response.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'prospect@example.com',
        subject: 'Test Email',
      })
    );
  });

  it('should retry failed email sends', async () => {
    const sendMailMock = vi
      .spyOn(smtpTransport, 'sendMail')
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce({
        messageId: 'test-message-id',
        accepted: ['prospect@example.com'],
        rejected: [],
      });

    const req = {
      client_id: 1,
      prospect_id: 1,
      subject: 'Test Email',
      body: 'Hello!',
    };

    const response = await testAPI(email.send, req);

    expect(response.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });
});
```

---

## End-to-End Testing

### Technology Stack

- **Framework**: Playwright
- **Browsers**: Chromium, Firefox, WebKit (Safari)
- **Parallelization**: Yes (4 workers)

### Critical User Flows

1. **User Registration & Login**
2. **Create Client Configuration**
3. **Create & Start Agent**
4. **Create Prospect Manually**
5. **Create & Send Email Campaign**
6. **View Analytics Dashboard**
7. **Manage Subscription (Stripe)**

### Example E2E Tests

```typescript
// frontend/e2e/prospect-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Prospect Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should create a new prospect', async ({ page }) => {
    // Navigate to prospects page
    await page.click('text=Prospects');
    await page.waitForURL('**/prospects');

    // Click create button
    await page.click('text=Create Prospect');

    // Fill form
    await page.fill('[name="name"]', 'Jane Smith');
    await page.fill('[name="email"]', 'jane.smith@example.com');
    await page.fill('[name="company"]', 'Tech Corp');
    await page.fill('[name="position"]', 'Director of Marketing');
    await page.selectOption('[name="prospect_type"]', 'customer');

    // Submit
    await page.click('button:has-text("Create")');

    // Verify success
    await expect(page.locator('text=Prospect created successfully')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).toBeVisible();
  });

  test('should score prospect automatically', async ({ page }) => {
    // Create prospect
    await page.click('text=Prospects');
    await page.click('text=Create Prospect');
    await page.fill('[name="name"]', 'John CEO');
    await page.fill('[name="email"]', 'ceo@bigcorp.com');
    await page.fill('[name="company"]', 'Big Corp');
    await page.fill('[name="position"]', 'CEO');
    await page.selectOption('[name="prospect_type"]', 'customer');
    await page.click('button:has-text("Create")');

    // Verify score appears
    await page.click('text=John CEO');
    await expect(page.locator('text=AI Score')).toBeVisible();
    await expect(page.locator('text=High Priority')).toBeVisible();
  });

  test('should send email campaign', async ({ page }) => {
    // Navigate to campaigns
    await page.click('text=Campaigns');
    await page.click('text=Create Campaign');

    // Fill campaign details
    await page.fill('[name="name"]', 'Q1 Outreach');
    await page.fill('[name="subject"]', 'Exclusive Offer for {{company}}');
    await page.fill('[name="body"]', 'Hi {{name}},\n\nWe have an exclusive offer...');

    // Select prospects
    await page.click('text=Select Prospects');
    await page.click('[data-prospect-id="1"]');
    await page.click('[data-prospect-id="2"]');

    // Send campaign
    await page.click('button:has-text("Send Campaign")');

    // Verify success
    await expect(page.locator('text=Campaign sent successfully')).toBeVisible();
    await expect(page.locator('text=2 emails sent')).toBeVisible();
  });
});
```

### Visual Regression Testing

```typescript
// frontend/e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('dashboard should match snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixels: 100,
    });
  });

  test('prospect list should match snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/prospects');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('prospects.png', {
      maxDiffPixels: 100,
    });
  });
});
```

---

## Performance Testing

### Technology Stack

- **Framework**: k6 (Grafana k6)
- **Reporting**: k6 HTML report, InfluxDB + Grafana (optional)

### Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **API Response Time (P95)** | <500ms | <1s |
| **API Response Time (P99)** | <1s | <2s |
| **Throughput** | 1,000 req/s | 500 req/s |
| **Error Rate** | <0.5% | <2% |
| **Concurrent Users** | 10,000 | 5,000 |

### Load Test Scenarios

#### Scenario 1: Normal Load

```javascript
// tests/performance/normal-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp-up
    { duration: '5m', target: 100 }, // Steady state
    { duration: '2m', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Test prospect list endpoint
  const response = http.get('http://localhost:4000/prospect/list', {
    headers: {
      Authorization: `Bearer ${__ENV.AUTH_TOKEN}`,
    },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

#### Scenario 2: Spike Test

```javascript
// tests/performance/spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 1000 },  // Spike
    { duration: '30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const response = http.post(
    'http://localhost:4000/prospect/create',
    JSON.stringify({
      client_id: 1,
      agent_id: 1,
      name: `Prospect ${__VU}-${__ITER}`,
      email: `prospect-${__VU}-${__ITER}@example.com`,
      prospect_type: 'customer',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${__ENV.AUTH_TOKEN}`,
      },
    }
  );

  check(response, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  sleep(1);
}
```

#### Scenario 3: Stress Test

```javascript
// tests/performance/stress-test.js
export const options = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 1500 },
    { duration: '5m', target: 2000 }, // Beyond expected capacity
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  // Test multiple endpoints
  const endpoints = [
    '/prospect/list',
    '/agent/list',
    '/analytics/dashboard',
    '/email/campaigns/list',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const response = http.get(`http://localhost:4000${endpoint}`, {
    headers: {
      Authorization: `Bearer ${__ENV.AUTH_TOKEN}`,
    },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 3);
}
```

---

## Security Testing

### OWASP Top 10 Testing

| Vulnerability | Test Method | Tool |
|---------------|-------------|------|
| **Injection (SQL, NoSQL)** | Automated scan | sqlmap, Burp Suite |
| **Broken Authentication** | Manual testing | Burp Suite |
| **Sensitive Data Exposure** | SSL/TLS check, manual review | SSL Labs, Burp Suite |
| **XML External Entities (XXE)** | Automated scan | OWASP ZAP |
| **Broken Access Control** | Manual testing | Custom scripts |
| **Security Misconfiguration** | Automated scan | Nessus, OpenVAS |
| **XSS** | Automated + manual | OWASP ZAP, Burp Suite |
| **Insecure Deserialization** | Code review | Manual |
| **Using Components with Known Vulnerabilities** | Dependency scan | npm audit, Snyk |
| **Insufficient Logging & Monitoring** | Manual review | Custom scripts |

### Security Test Cases

```bash
# 1. SQL Injection Test
sqlmap -u "http://localhost:4000/prospect/search?query=test" \
  --cookie="auth_token=..." \
  --batch

# 2. XSS Test (Manual)
# Test inputs: <script>alert('XSS')</script>
# Verify output is sanitized

# 3. CSRF Test
# Attempt state-changing request without CSRF token
curl -X POST http://localhost:4000/prospect/delete/123 \
  -H "Authorization: Bearer $TOKEN"
# Should fail without CSRF token

# 4. Authentication Bypass
# Attempt to access protected endpoints without token
curl http://localhost:4000/prospect/list
# Should return 401 Unauthorized

# 5. Rate Limiting Test
for i in {1..100}; do
  curl -X POST http://localhost:4000/prospect/create \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@example.com"}' &
done
# Should trigger rate limiting (429)

# 6. Dependency Vulnerability Scan
npm audit
npm audit fix

# 7. SSL/TLS Test
nmap --script ssl-enum-ciphers -p 443 yourdomain.com
```

---

## Compatibility Testing

### Browser Testing

| Browser | Versions | Priority |
|---------|----------|----------|
| **Chrome** | Latest, Latest-1 | P0 |
| **Firefox** | Latest, Latest-1 | P0 |
| **Safari** | Latest, Latest-1 | P1 |
| **Edge** | Latest | P1 |
| **Mobile Safari (iOS)** | Latest | P2 |
| **Mobile Chrome (Android)** | Latest | P2 |

### Device Testing

| Device Type | Resolutions | Testing Method |
|-------------|-------------|----------------|
| **Desktop** | 1920x1080, 1366x768 | Real browsers |
| **Tablet** | 1024x768, 768x1024 | BrowserStack |
| **Mobile** | 375x667, 414x896 | BrowserStack, Real devices |

---

## Test Environment Setup

### Local Development

```bash
# Backend tests
cd backend
bun test               # Run all tests
bun test:unit          # Unit tests only
bun test:integration   # Integration tests only
bun test:coverage      # With coverage report

# Frontend tests
cd frontend
bun test               # Run all tests
bun test:e2e           # E2E tests (Playwright)
bun test:coverage      # With coverage report
```

### CI Environment (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: npx playwright install --with-deps
      - run: bun test:e2e

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3
      - uses: grafana/setup-k6-action@v1
      - run: k6 run tests/performance/normal-load.js
```

---

## Test Coverage Goals

### Code Coverage Targets

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        '*.config.js',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
});
```

### Coverage Enforcement

- **Pull Request Requirement**: 80% coverage
- **Decrease Prevention**: Coverage must not decrease
- **Critical Paths**: 90%+ coverage required

---

## Test Execution Plan

### Pre-Commit (Developer Machine)

```bash
# Run before every commit
npm run test:changed  # Test changed files only
npm run lint          # ESLint
npm run type-check    # TypeScript
```

### Pre-Push (Developer Machine)

```bash
# Run before pushing to remote
npm run test:all      # All unit + integration tests
npm run build         # Ensure build succeeds
```

### Continuous Integration (Every Push)

```bash
# Automated on GitHub Actions
1. Lint & type check
2. Unit tests
3. Integration tests
4. Build verification
5. Code coverage report
```

### Pre-Release (Before Deployment)

```bash
# Manual/automated before production deployment
1. Full test suite (unit + integration + E2E)
2. Performance tests (load, stress, spike)
3. Security scan (OWASP ZAP, npm audit)
4. Browser compatibility tests
5. Visual regression tests
6. Manual exploratory testing
```

### Production Monitoring

```bash
# Continuous in production
1. Synthetic monitoring (ping tests)
2. Real user monitoring (RUM)
3. Error tracking (Sentry)
4. Performance monitoring (API response times)
5. Security monitoring (intrusion detection)
```

---

## Success Criteria

### Definition of Done (DoD)

A feature is considered "done" when:

- ✅ All unit tests pass (80%+ coverage)
- ✅ All integration tests pass
- ✅ E2E tests for critical paths pass
- ✅ No P0/P1 bugs
- ✅ Code review approved
- ✅ Performance benchmarks met
- ✅ Security scan passes
- ✅ Documentation updated

### Test Exit Criteria

Testing is complete when:

- ✅ 95%+ tests passing
- ✅ Zero P0 bugs
- ✅ < 5 P1 bugs
- ✅ Performance targets met
- ✅ Security vulnerabilities addressed
- ✅ Browser compatibility verified
- ✅ Production deployment successful

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-22
**Next Review**: After Phase 2 (Week 4)
