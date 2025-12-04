# AI Lead OS Test Suite

Comprehensive test suite for the AI Lead OS platform covering CRM, qualification, sequences, pipeline, integrations, and payments.

## Quick Start

```bash
# Run all tests
npm test

# Run specific test file
npm test -- backend/ai_crm/crm.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Test Structure

```
backend/
├── ai_crm/
│   └── crm.test.ts              # CRM service tests (Lead, Contact, Deal)
├── qualification/
│   └── qualification.test.ts     # Lead scoring and qualification tests
├── sequences/
│   └── sequences.test.ts         # Email/SMS sequence automation tests
├── pipeline/
│   └── pipeline.test.ts          # Pipeline orchestration tests
├── integrations/
│   └── integrations.test.ts      # Apollo, Brevo, Twilio, Calendly tests
├── payment/
│   └── payment.test.ts           # Stripe subscription and billing tests
└── agent/
    └── agent.test.ts             # Agent management tests
```

## Test Categories

### 1. CRM Tests (`ai_crm/crm.test.ts`)
Tests for Lead, Contact, and Deal management:
- **Lead Management**: Creation, retrieval, update, deletion, search
- **Contact Management**: Customer contacts, linking to leads, tags
- **Deal Management**: Pipeline stages, win probability, analytics
- **Validation**: Email, name, phone validation

```bash
npm test -- backend/ai_crm/crm.test.ts
```

### 2. Qualification Tests (`qualification/qualification.test.ts`)
Tests for AI lead scoring:
- **Score Calculation**: Title, company size, contact info, source
- **Grade Assignment**: A-F grading based on score
- **Qualification Levels**: Hot, warm, cold, unqualified
- **Custom Criteria**: Configurable scoring rules
- **Bulk Scoring**: Multiple lead scoring

```bash
npm test -- backend/qualification/qualification.test.ts
```

### 3. Sequence Tests (`sequences/sequences.test.ts`)
Tests for email/SMS automation:
- **Sequence CRUD**: Create, activate, pause sequences
- **Enrollment**: Single and bulk enrollment
- **Send Processing**: Email/SMS sending, failures
- **Reply Handling**: Stop on reply, stats tracking
- **Settings**: Send windows, rate limits, stop conditions

```bash
npm test -- backend/sequences/sequences.test.ts
```

### 4. Pipeline Tests (`pipeline/pipeline.test.ts`)
Tests for the full prospect pipeline:
- **Prospect Search**: Apollo API integration
- **Lead Import**: CRM import, deduplication
- **Auto Qualification**: Score-based qualification
- **Auto Enrollment**: Sequence enrollment
- **Pipeline Status**: Dashboard and analytics

```bash
npm test -- backend/pipeline/pipeline.test.ts
```

### 5. Integration Tests (`integrations/integrations.test.ts`)
Tests for third-party integrations:
- **Apollo**: People search, enrichment, data conversion
- **Brevo**: Email sending, personalization, unsubscribe
- **Twilio**: SMS sending, phone validation, opt-out
- **Calendly**: Booking link retrieval

```bash
npm test -- backend/integrations/integrations.test.ts
```

### 6. Payment Tests (`payment/payment.test.ts`)
Tests for Stripe billing:
- **Customers**: Creation, retrieval, deletion
- **Subscriptions**: Create, upgrade, downgrade, cancel
- **Plans**: Starter, Pro, Enterprise tiers
- **Webhooks**: Subscription updates, invoice events
- **Billing Workflows**: Complete signup, cancellation

```bash
npm test -- backend/payment/payment.test.ts
```

## Running Tests

### All Tests
```bash
npm test
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Specific Service
```bash
# CRM only
npm test -- backend/ai_crm/

# Qualification only
npm test -- backend/qualification/

# Sequences only
npm test -- backend/sequences/

# Pipeline only
npm test -- backend/pipeline/

# Integrations only
npm test -- backend/integrations/

# Payment only
npm test -- backend/payment/
```

### Pattern Matching
```bash
# Run tests matching "Lead"
npm test -- -t "Lead"

# Run tests matching "subscription"
npm test -- -t "subscription"
```

## Test Configuration

Tests use Vitest with the following configuration in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
    },
  },
});
```

## Writing New Tests

### Test File Template
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ServiceName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Feature', () => {
    it('should do something', () => {
      // Test
      expect(result).toBe(expected);
    });
  });
});
```

### Mock Pattern
```typescript
// Create mock data
let mockDB: MockDB;

function resetMocks() {
  mockDB = { items: [] };
}

// Use in tests
beforeEach(() => {
  resetMocks();
});
```

## Test Coverage Targets

| Service | Target |
|---------|--------|
| CRM | 90%+ |
| Qualification | 90%+ |
| Sequences | 85%+ |
| Pipeline | 85%+ |
| Integrations | 80%+ |
| Payment | 90%+ |

## Performance Benchmarks

Each test file includes performance tests:
- Create 1000 records: < 1 second
- Search 1000 records: < 100ms
- Bulk operations: < 500ms

## CI/CD Integration

```yaml
# GitHub Actions
- name: Run Tests
  run: npm test

- name: Run Tests with Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests Failing
1. Ensure dependencies are installed: `npm install`
2. Check TypeScript compilation: `npm run typecheck`
3. Run single test file to isolate issue

### Mock Issues
- Ensure `resetMocks()` is called in `beforeEach`
- Check mock data is properly initialized

### Timeout Issues
- Increase timeout in `vitest.config.ts`
- Check for async issues in tests

## Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Encore.ts Testing](https://encore.dev/docs/develop/testing)
- [AI Lead OS Architecture](../docs/architecture.md)
