/**
 * SQLite Database Manager for Design Patterns MCP Server
 * Handles database connections, transactions, and basic operations
 * Uses sql.js for pure JavaScript SQLite implementation
 */
import initSqlJs, { Database, Statement, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';
import { StatementPool, SqlValue, SqlParams } from './statement-pool.js';

// sql.js type imports are available from @types/sql.js

export interface DatabaseConfig {
  filename: string;
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string, ...additionalArgs: string[]) => void;
  };
}

// Type definitions for database operations
interface DatabaseResult {
  insertId?: number;
  changes?: number;
}

export class DatabaseManager {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private config: DatabaseConfig;
  private statementPool: StatementPool;
  private queryMetrics = new Map<string, { count: number; totalTime: number; avgTime: number }>();

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.statementPool = new StatementPool({ maxSize: 100, enableMetrics: true });
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize sql.js
      this.SQL = await initSqlJs();

      // Ensure database directory exists
      const dbDir = path.dirname(this.config.filename);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Try to load existing database file
      let dbData: Uint8Array | undefined;
      if (fs.existsSync(this.config.filename)) {
        dbData = new Uint8Array(fs.readFileSync(this.config.filename));
      }

      // Create database connection
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.db = new this.SQL.Database(dbData);

      // Enable foreign keys
      if (this.db) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.db.run('PRAGMA foreign_keys = ON');

        // Set cache size for better performance
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.db.run('PRAGMA cache_size = 1000');
      }

      logger.info('database-manager', `Database initialized: ${this.config.filename}`);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        // Clear statement pool FIRST to prevent memory leaks
        this.statementPool.clear();
        logger.info('database-manager', 'Statement pool cleared');

        // Export database to file before closing (only if not readonly and path exists)
        if (this.config.filename && !(this.config.options?.readonly ?? false)) {
          const dbDir = path.dirname(this.config.filename);
          if (!fs.existsSync(dbDir)) {
            await fs.promises.mkdir(dbDir, { recursive: true });
          }
          const data = this.db.export();
          const buffer = Buffer.from(data);
          await fs.promises.writeFile(this.config.filename, buffer);
          logger.info('database-manager', `Database exported to ${this.config.filename}`);
        }

        // Close database connection
        this.db.close();
        this.db = null;
        logger.info('database-manager', 'Database connection closed successfully');
      } catch (error) {
        logger.error(
          'database-manager',
          'Failed to close database properly',
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    }
  }

  /**
   * Execute a SQL query with prepared statement optimization and caching
   */
  execute(sql: string, params: readonly SqlValue[] = []): DatabaseResult {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const startTime = Date.now();

    try {
      // Get or create prepared statement using Object Pool
      const stmt = this.statementPool.getOrCreate(sql, () => {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare(sql);
      });

      stmt.run([...params]);
      const executionTime = Date.now() - startTime;

      // Update query metrics
      this.updateQueryMetrics(sql, executionTime);

      // sql.js run() returns void, so we construct the result manually
      return { changes: 0 };
    } catch (error) {
      logger.error('database-manager', `Execute failed: ${sql}`, error as Error);
      throw error;
    }
  }

  /**
   * Execute a SELECT query and return all rows with prepared statement caching
   */
  query<T>(sql: string, params: readonly SqlValue[] = []): T[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const startTime = Date.now();

    try {
      // Get or create prepared statement using Object Pool
      const stmt = this.statementPool.getOrCreate(sql, () => {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare(sql);
      });

      // Bind parameters if provided
      if (params && params.length > 0) {
        stmt.bind([...params]);
      }

      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }

      // Reset statement for reuse
      stmt.reset();

      const executionTime = Date.now() - startTime;
      this.updateQueryMetrics(sql, executionTime);

      return results;
    } catch (error) {
      console.error('Query failed:', sql, error);
      throw error;
    }
  }

  /**
   * Execute a SELECT query and return first row with prepared statement caching
   */
  queryOne<T>(sql: string, params: readonly SqlValue[] = []): T | null {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const startTime = Date.now();

    try {
      // Get or create prepared statement using Object Pool
      const stmt = this.statementPool.getOrCreate(sql, () => {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare(sql);
      });

      // Bind parameters if provided
      if (params && params.length > 0) {
        stmt.bind([...params]);
      }

      const result = stmt.step() ? (stmt.getAsObject() as T) : null;

      // Reset statement for reuse
      stmt.reset();

      const executionTime = Date.now() - startTime;
      this.updateQueryMetrics(sql, executionTime);

      return result;
    } catch (error) {
      console.error('Query failed:', sql, error);
      throw error;
    }
  }

  /**
   * Execute multiple SQL statements in a transaction (with retry logic)
   * Retries on transient errors (SQLITE_BUSY, SQLITE_LOCKED)
   */
  transaction<T>(callback: () => T, maxRetries: number = 3, retryDelay: number = 100): T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.db.run('BEGIN TRANSACTION');
        const result = callback();
        this.db.run('COMMIT');
        return result;
      } catch (error) {
        this.db.run('ROLLBACK');

        const errorMsg = error instanceof Error ? error.message : String(error);
        const isTransient =
          errorMsg.includes('BUSY') ||
          errorMsg.includes('LOCKED') ||
          errorMsg.includes('database is locked');

        if (isTransient && attempt < maxRetries - 1) {
          // Transient error - wait and retry with exponential backoff
          const waitTime = retryDelay * Math.pow(2, attempt);
          logger.warn(
            'database-manager',
            `Transaction failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${waitTime}ms...`
          );

          // Synchronous sleep for retry delay
          const start = Date.now();
          while (Date.now() - start < waitTime) {
            // Busy wait (not ideal but works for small delays)
          }

          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }

        // Non-transient error or max retries exceeded
        throw error;
      }
    }

    throw lastError ?? new Error('Transaction failed after all retries');
  }

  /**
   * Optimize database for better query performance
   */
  optimize(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Run ANALYZE to update query planner statistics
      this.db.run('ANALYZE');

      // Run REINDEX to rebuild indexes
      this.db.run('REINDEX');

      // Vacuum to reclaim space and optimize storage
      this.db.run('VACUUM');

      logger.info('database-manager', 'Database optimized');
    } catch (error) {
      console.error('Database optimization failed:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    if (!this.db) {
      return {
        filename: this.config.filename,
        pageCount: 0,
        pageSize: 0,
        databaseSize: 0,
        cacheSize: 0,
        journalMode: 'UNKNOWN',
        tableCount: 0,
        indexCount: 0,
        tables: [],
        indexes: [],
        error: 'Database not initialized'
      };
    }

    try {
      // Get basic database info
      const pageCountResult = this.db.exec('PRAGMA page_count');
      const pageSizeResult = this.db.exec('PRAGMA page_size');
      const pageCount = (pageCountResult[0]?.values[0]?.[0] as number) ?? 0;
      const pageSize = (pageSizeResult[0]?.values[0]?.[0] as number) ?? 4096;
      const databaseSize = pageCount * pageSize;

      // Get table count
      const tables = this.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      const tableCount = tables.length;

      // Get index count
      const indexes = this.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
      );
      const indexCount = indexes.length;

      return {
        filename: this.config.filename,
        pageCount,
        pageSize,
        databaseSize,
        cacheSize: 0,
        journalMode: 'MEMORY', // sql.js default
        tableCount,
        indexCount,
        tables: tables.map(t => t.name),
        indexes: indexes.map(i => i.name),
      };
    } catch (error) {
      return {
        filename: this.config.filename,
        pageCount: 0,
        pageSize: 0,
        databaseSize: 0,
        cacheSize: 0,
        journalMode: 'UNKNOWN',
        tableCount: 0,
        indexCount: 0,
        tables: [],
        indexes: [],
        error: `Failed to get stats: ${String(error)}`
      };
    }
  }

  healthCheck(): HealthCheckResult {
    if (!this.db) {
      return {
        healthy: false,
        error: 'Database not initialized',
        lastCheck: new Date(),
      };
    }

    try {
      // Simple query to test connectivity
      this.queryOne('SELECT 1 as test');
      const stats = this.getStats();

      return {
        healthy: true,
        stats,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Get the underlying database instance (use with caution)
   */
  getDatabase(): Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Update query performance metrics
   */
  private updateQueryMetrics(sql: string, executionTime: number): void {
    const metrics = this.queryMetrics.get(sql) ?? { count: 0, totalTime: 0, avgTime: 0 };
    metrics.count++;
    metrics.totalTime += executionTime;
    metrics.avgTime = metrics.totalTime / metrics.count;
    this.queryMetrics.set(sql, metrics);
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(): Array<{
    sql: string;
    metrics: { count: number; totalTime: number; avgTime: number };
  }> {
    return Array.from(this.queryMetrics.entries()).map(([sql, metrics]) => ({
      sql,
      metrics,
    }));
  }

  /**
   * Clear prepared statement cache
   */
  clearPreparedStatements(): void {
    this.statementPool.clear();
  }

  /**
   * Get statement pool metrics
   */
  getPoolMetrics() {
    return this.statementPool.getMetrics();
  }

  /**
   * Alias methods for compatibility with sqlite3-style API
   */
  get<T>(sql: string, params: readonly SqlValue[] = []): T | undefined {
    return this.queryOne<T>(sql, params) ?? undefined;
  }

  all<T>(sql: string, params: readonly SqlValue[] = []): T[] {
    return this.query<T>(sql, params);
  }

  run(sql: string, params: readonly SqlValue[] = []): DatabaseResult {
    return this.execute(sql, params);
  }

  prepare(sql: string): Statement {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.prepare(sql);
  }

  /**
   * Execute DDL statements (CREATE, ALTER, DROP) directly without prepared statements
   * DDL statements cannot be prepared and reused like DML statements
   */
  execDDL(sql: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const startTime = Date.now();

    try {
      // Execute DDL directly - split into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        if (statement.length > 0) {
          this.db.exec(statement);
        }
      }

      const executionTime = Date.now() - startTime;
      this.updateQueryMetrics(sql, executionTime);
    } catch (error) {
      console.error('DDL execution failed:', sql, error);
      throw error;
    }
  }
}

interface DatabaseStats {
  filename: string;
  pageCount: number;
  pageSize: number;
  databaseSize: number;
  cacheSize: number;
  journalMode: string;
  tableCount: number;
  indexCount: number;
  tables: string[];
  indexes: string[];
  error?: string;
}

interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  stats?: DatabaseStats;
  lastCheck: Date;
}

/**
 * Singleton pattern consolidated - use DI Container instead
 * These functions are deprecated and kept for backward compatibility
 * @deprecated Use DI Container with TOKENS.DATABASE_MANAGER instead
 */
let databaseManager: DatabaseManager | null = null;

/**
 * @deprecated Use container.get(TOKENS.DATABASE_MANAGER) instead
 */
export function getDatabaseManager(): DatabaseManager {
  if (!databaseManager) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager() first.');
  }
  return databaseManager;
}

/**
 * @deprecated Use container.registerSingleton(TOKENS.DATABASE_MANAGER, ...) instead
 */
export async function initializeDatabaseManager(config: DatabaseConfig): Promise<DatabaseManager> {
  if (databaseManager) {
    await databaseManager.close();
  }

  // Retry pattern for database corruption recovery
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      databaseManager = new DatabaseManager(config);
      await databaseManager.initialize();
      break; // Success, exit retry loop
    } catch (error) {
      retryCount++;
      if (databaseManager) {
        try {
          await databaseManager.close();
        } catch (closeError) {
          // Ignore close errors during retry
        }
        databaseManager = null;
      }

      if (retryCount >= maxRetries) {
        throw error; // Max retries reached, rethrow
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
    }
  }

  if (!databaseManager) {
    throw new Error('Failed to initialize database manager after all retries');
  }
  return databaseManager;
}

/**
 * @deprecated Managed by DI Container lifecycle
 */
export async function closeDatabaseManager(): Promise<void> {
  if (databaseManager) {
    await databaseManager.close();
    databaseManager = null;
  }
}
