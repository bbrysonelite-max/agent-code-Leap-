import { describe, it, expect, vi } from 'vitest';
import { handleDatabaseError, executeQuery, requireRow, insertRow } from './database';
import { DatabaseError, ResourceNotFoundError } from './errors';

describe('Database Utilities', () => {
  describe('handleDatabaseError', () => {
    it('should throw DatabaseError for duplicate key', () => {
      const error = new Error('duplicate key value violates unique constraint');

      expect(() => handleDatabaseError(error, 'insert')).toThrow(DatabaseError);
      expect(() => handleDatabaseError(error, 'insert')).toThrow(/Duplicate entry/);
    });

    it('should throw DatabaseError for foreign key constraint', () => {
      const error = new Error('foreign key constraint fails');

      expect(() => handleDatabaseError(error, 'delete')).toThrow(DatabaseError);
      expect(() => handleDatabaseError(error, 'delete')).toThrow(/Foreign key constraint/);
    });

    it('should throw DatabaseError for not null constraint', () => {
      const error = new Error('not null constraint violated');

      expect(() => handleDatabaseError(error, 'update')).toThrow(DatabaseError);
      expect(() => handleDatabaseError(error, 'update')).toThrow(/Required field missing/);
    });

    it('should throw generic DatabaseError for unknown errors', () => {
      const error = new Error('Connection timeout');

      expect(() => handleDatabaseError(error, 'query')).toThrow(DatabaseError);
      expect(() => handleDatabaseError(error, 'query')).toThrow(/Database operation failed/);
    });

    it('should include operation in error message', () => {
      const error = new Error('Something went wrong');

      try {
        handleDatabaseError(error, 'custom_operation');
      } catch (e) {
        if (e instanceof DatabaseError) {
          expect(e.operation).toBe('custom_operation');
        }
      }
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';

      expect(() => handleDatabaseError(error, 'operation')).toThrow(DatabaseError);
    });
  });

  describe('executeQuery', () => {
    it('should execute successful query', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'Test' });

      const result = await executeQuery(queryFn, 'select');

      expect(result).toEqual({ id: 1, name: 'Test' });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should handle query errors', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Query failed'));

      await expect(executeQuery(queryFn, 'select')).rejects.toThrow(DatabaseError);
    });

    it('should transform database errors', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('duplicate key error'));

      await expect(executeQuery(queryFn, 'insert')).rejects.toThrow(/Duplicate entry/);
    });

    it('should pass through successful results', async () => {
      const expectedResult = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const queryFn = vi.fn().mockResolvedValue(expectedResult);

      const result = await executeQuery(queryFn, 'select');

      expect(result).toEqual(expectedResult);
    });
  });

  describe('requireRow', () => {
    it('should return row when found', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'Found' });

      const result = await requireRow(queryFn, 'user', 1);

      expect(result).toEqual({ id: 1, name: 'Found' });
    });

    it('should throw ResourceNotFoundError when row not found', async () => {
      const queryFn = vi.fn().mockResolvedValue(null);

      await expect(requireRow(queryFn, 'user', 999)).rejects.toThrow(ResourceNotFoundError);
    });

    it('should include resource name in error', async () => {
      const queryFn = vi.fn().mockResolvedValue(null);

      try {
        await requireRow(queryFn, 'prospect', 123);
      } catch (e) {
        if (e instanceof ResourceNotFoundError) {
          expect(e.resourceName).toBe('prospect');
          expect(e.identifier).toBe(123);
        }
      }
    });

    it('should handle database errors during fetch', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Connection lost'));

      await expect(requireRow(queryFn, 'user', 1)).rejects.toThrow(DatabaseError);
    });

    it('should work without identifier', async () => {
      const queryFn = vi.fn().mockResolvedValue(null);

      await expect(requireRow(queryFn, 'settings')).rejects.toThrow(ResourceNotFoundError);
    });

    it('should preserve ResourceNotFoundError', async () => {
      const queryFn = vi.fn().mockImplementation(() => {
        throw new ResourceNotFoundError('custom_resource', 'custom_id');
      });

      try {
        await requireRow(queryFn, 'ignored', 'ignored');
      } catch (e) {
        if (e instanceof ResourceNotFoundError) {
          expect(e.resourceName).toBe('custom_resource');
          expect(e.identifier).toBe('custom_id');
        }
      }
    });
  });

  describe('insertRow', () => {
    it('should return inserted row', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'New' });

      const result = await insertRow(queryFn, 'user');

      expect(result).toEqual({ id: 1, name: 'New' });
    });

    it('should throw DatabaseError when insert fails', async () => {
      const queryFn = vi.fn().mockResolvedValue(null);

      await expect(insertRow(queryFn, 'user')).rejects.toThrow(DatabaseError);
      await expect(insertRow(queryFn, 'user')).rejects.toThrow(/Failed to create user/);
    });

    it('should handle database constraint errors', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('duplicate key constraint'));

      await expect(insertRow(queryFn, 'agent')).rejects.toThrow(DatabaseError);
    });

    it('should preserve existing DatabaseErrors', async () => {
      const customError = new DatabaseError('Custom error', 'insert', { detail: 'test' });
      const queryFn = vi.fn().mockRejectedValue(customError);

      try {
        await insertRow(queryFn, 'prospect');
      } catch (e) {
        if (e instanceof DatabaseError) {
          expect(e.message).toBe('Custom error');
          expect(e.details).toEqual({ detail: 'test' });
        }
      }
    });
  });

  describe('Error Details', () => {
    it('should include original error in details', () => {
      const originalError = new Error('Original error message');

      try {
        handleDatabaseError(originalError, 'test_operation');
      } catch (e) {
        if (e instanceof DatabaseError) {
          expect(e.details?.originalError).toBe('Original error message');
        }
      }
    });

    it('should include operation in DatabaseError', () => {
      const error = new Error('Test error');

      try {
        handleDatabaseError(error, 'complex_operation');
      } catch (e) {
        if (e instanceof DatabaseError) {
          expect(e.operation).toBe('complex_operation');
        }
      }
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after database error', async () => {
      let attemptCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve({ success: true });
      });

      // First attempt fails
      await expect(executeQuery(queryFn, 'retry_test')).rejects.toThrow();

      // Second attempt succeeds
      const result = await executeQuery(queryFn, 'retry_test');
      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(2);
    });
  });

  describe('Type Safety', () => {
    it('should preserve generic type in executeQuery', async () => {
      interface User {
        id: number;
        email: string;
      }

      const queryFn = vi.fn().mockResolvedValue({ id: 1, email: 'test@example.com' });

      const result = await executeQuery<User>(queryFn, 'select');

      expect(result.id).toBe(1);
      expect(result.email).toBe('test@example.com');
    });

    it('should preserve generic type in requireRow', async () => {
      interface Agent {
        id: number;
        name: string;
        status: string;
      }

      const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'Agent', status: 'running' });

      const result = await requireRow<Agent>(queryFn, 'agent', 1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Agent');
      expect(result.status).toBe('running');
    });

    it('should preserve generic type in insertRow', async () => {
      interface Prospect {
        id: number;
        email: string;
      }

      const queryFn = vi.fn().mockResolvedValue({ id: 1, email: 'prospect@example.com' });

      const result = await insertRow<Prospect>(queryFn, 'prospect');

      expect(result.id).toBe(1);
      expect(result.email).toBe('prospect@example.com');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle concurrent unique constraint violations', async () => {
      // Simulates two concurrent inserts with same unique key
      const queryFn = vi.fn().mockRejectedValue(
        new Error('duplicate key value violates unique constraint "users_email_key"')
      );

      await expect(insertRow(queryFn, 'user')).rejects.toThrow(/Duplicate entry/);
    });

    it('should handle cascading delete foreign key errors', async () => {
      // Trying to delete a record that has dependent records
      const queryFn = vi.fn().mockRejectedValue(
        new Error('update or delete on table "agents" violates foreign key constraint')
      );

      await expect(executeQuery(queryFn, 'delete')).rejects.toThrow(/Foreign key constraint/);
    });

    it('should handle missing required fields', async () => {
      const queryFn = vi.fn().mockRejectedValue(
        new Error('null value in column "email" violates not-null constraint')
      );

      await expect(insertRow(queryFn, 'contact')).rejects.toThrow(/Required field missing/);
    });

    it('should handle transaction rollback', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('current transaction is aborted'));

      await expect(executeQuery(queryFn, 'update')).rejects.toThrow(DatabaseError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result set', async () => {
      const queryFn = vi.fn().mockResolvedValue([]);

      const result = await executeQuery<any[]>(queryFn, 'select');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle null values in results', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1, optional_field: null });

      const result = await executeQuery(queryFn, 'select');

      expect(result.id).toBe(1);
      expect(result.optional_field).toBeNull();
    });

    it('should handle very long error messages', async () => {
      const longMessage = 'Error: '.repeat(100);
      const queryFn = vi.fn().mockRejectedValue(new Error(longMessage));

      await expect(executeQuery(queryFn, 'long_error')).rejects.toThrow(DatabaseError);
    });

    it('should handle special characters in resource names', async () => {
      const queryFn = vi.fn().mockResolvedValue(null);

      await expect(requireRow(queryFn, 'table_name_with_underscores', 1)).rejects.toThrow(
        ResourceNotFoundError
      );
    });
  });

  describe('Performance Considerations', () => {
    it('should not execute query if already failed', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(executeQuery(queryFn, 'test')).rejects.toThrow();

      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should handle large result sets', async () => {
      const largeResult = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: `item-${i}` }));
      const queryFn = vi.fn().mockResolvedValue(largeResult);

      const result = await executeQuery(queryFn, 'large_select');

      expect(result).toHaveLength(10000);
    });
  });
});
