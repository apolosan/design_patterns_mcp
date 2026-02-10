import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  QueryTimeoutHandler,
  QueryTimeoutError
} from '../../src/utils/query-timeout.js';

describe('QueryTimeoutHandler', () => {
  let handler: QueryTimeoutHandler;

  beforeEach(() => {
    handler = new QueryTimeoutHandler({
      defaultTimeout: 100,
      slowQueryThreshold: 50,
      logSlowQueries: false,
      maxConcurrentQueries: 5
    });
  });

  describe('execute', () => {
    test('should execute query successfully', async () => {
      const result = await handler.execute(
        'SELECT * FROM users',
        async () => [{ id: 1, name: 'John' }]
      );

      expect(result.rows).toEqual([{ id: 1, name: 'John' }]);
      expect(result.timedOut).toBe(false);
      expect(result.query).toBe('SELECT * FROM users');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('should timeout slow queries', async () => {
      await expect(
        handler.execute(
          'SELECT * FROM large_table',
          async () => new Promise(resolve => setTimeout(resolve, 200)),
          50
        )
      ).rejects.toThrow(QueryTimeoutError);
    });

    test('should throw QueryTimeoutError with query info', async () => {
      try {
        await handler.execute(
          'DELETE FROM critical_table',
          async () => new Promise(resolve => setTimeout(resolve, 200)),
          50
        );
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(QueryTimeoutError);
        const qte = error as QueryTimeoutError;
        expect(qte.query).toBe('DELETE FROM critical_table');
        expect(qte.timeout).toBe(50);
        expect(qte.duration).toBeGreaterThanOrEqual(50);
      }
    });

    test('should respect max concurrent queries limit', async () => {
      const handler2 = new QueryTimeoutHandler({
        defaultTimeout: 5000,
        slowQueryThreshold: 1000,
        logSlowQueries: false,
        maxConcurrentQueries: 2
      });

      const promises = [
        handler2.execute('q1', async () => new Promise(r => setTimeout(r, 100))),
        handler2.execute('q2', async () => new Promise(r => setTimeout(r, 100)))
      ];

      await expect(
        handler2.execute('q3', async () => 'result')
      ).rejects.toThrow('Maximum concurrent queries exceeded');
    });
  });

  describe('executeWithTimeout', () => {
    test('should execute with default timeout', async () => {
      const result = await handler.executeWithTimeout(async () => 'test');
      expect(result.rows).toEqual(['test']);
      expect(result.timedOut).toBe(false);
    });

    test('should timeout when exceeding default', async () => {
      await expect(
        handler.executeWithTimeout(
          async () => new Promise(resolve => setTimeout(resolve, 200)),
          50
        )
      ).rejects.toThrow(QueryTimeoutError);
    });
  });

  describe('active queries tracking', () => {
    test('should track active queries', async () => {
      const slowQuery = handler.execute(
        'slow_query',
        async () => new Promise(resolve => setTimeout(resolve, 50)),
        100
      );

      const activeQueries = handler.getActiveQueries();
      expect(activeQueries.length).toBe(1);
      expect(activeQueries[0].query).toBe('slow_query');

      await slowQuery;
    });

    test('should clear active queries after completion', async () => {
      await handler.execute('q1', async () => 'result');

      const activeQueries = handler.getActiveQueries();
      expect(activeQueries.length).toBe(0);
    });
  });

  describe('slow query detection', () => {
    test('should record slow queries', async () => {
      const handler2 = new QueryTimeoutHandler({
        defaultTimeout: 200,
        slowQueryThreshold: 30,
        logSlowQueries: true,
        maxConcurrentQueries: 10
      });

      await handler2.execute(
        'slow_query',
        async () => new Promise(resolve => setTimeout(resolve, 50)),
        200
      );

      const slowQueries = handler2.getSlowQueries();
      expect(slowQueries.length).toBe(1);
      expect(slowQueries[0].query).toBe('slow_query');
    });

    test('should limit slow query history', async () => {
      const handler3 = new QueryTimeoutHandler({
        defaultTimeout: 500,
        slowQueryThreshold: 20,
        logSlowQueries: true,
        maxConcurrentQueries: 50
      });

      for (let i = 0; i < 110; i++) {
        await handler3.execute(
          `slow_${i}`,
          async () => new Promise(resolve => setTimeout(resolve, 30)),
          200
        );
      }

      const slowQueries = handler3.getSlowQueries();
      expect(slowQueries.length).toBeLessThanOrEqual(100);
    });

    test('should clear slow queries', async () => {
      await handler.execute('slow', async () => new Promise(r => setTimeout(r, 60)), 100);

      handler.clearSlowQueries();

      const slowQueries = handler.getSlowQueries();
      expect(slowQueries.length).toBe(0);
    });
  });

  describe('statistics', () => {
    test('should track query statistics', async () => {
      const handler2 = new QueryTimeoutHandler({
        defaultTimeout: 200,
        slowQueryThreshold: 1000,
        logSlowQueries: false,
        maxConcurrentQueries: 10
      });

      await handler2.execute('q1', async () => 'result');
      await handler2.execute('q2', async () => 'result');

      try {
        await handler2.executeWithTimeout(
          async () => new Promise(r => setTimeout(r, 200)),
          50
        );
      } catch {
        // Expected - query timed out
      }

      const stats = handler2.getStats();
      expect(stats.totalQueries).toBe(3);
      expect(stats.timedOutQueries).toBe(1);
    });

    test('should return zero average for no queries', () => {
      const stats = handler.getStats();
      expect(stats.totalQueries).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });
  });

  describe('reset', () => {
    test('should reset all state', async () => {
      await handler.execute('q1', async () => 'result');

      handler.reset();

      const stats = handler.getStats();
      expect(stats.totalQueries).toBe(0);
      expect(handler.getActiveQueries().length).toBe(0);
    });
  });
});
