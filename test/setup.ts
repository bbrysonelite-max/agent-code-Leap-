import { beforeAll, afterAll, beforeEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Setup test database, mock services, etc.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
});

afterAll(async () => {
  // Cleanup after all tests
});

beforeEach(async () => {
  // Reset state before each test
});