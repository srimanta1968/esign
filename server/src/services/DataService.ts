import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { databaseConfig } from '../config/database';

/**
 * DataService provides a centralized interface for all database operations.
 * This is the ONLY module that should interact with the database pool directly.
 * All other services MUST use DataService methods for database access.
 */

interface DataServicePool {
  connect(): Promise<PoolClient>;
  query(text: string, params?: any[]): Promise<QueryResult>;
  end(): Promise<void>;
}

const pool: DataServicePool = new Pool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,
  user: databaseConfig.user,
  password: databaseConfig.password,
  ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : false,
  min: databaseConfig.pool.min,
  max: databaseConfig.pool.max,
});

(pool as Pool).on('error', (err: Error) => {
  console.error('Unexpected database pool error:', err);
});

export class DataService {
  /**
   * Execute a parameterized SQL query.
   */
  static async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const client: PoolClient = await pool.connect();
    try {
      const result: QueryResult<T> = await client.query<T>(text, params);
      return result;
    } catch (error: unknown) {
      throw new Error(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query and return the first row, or null if no rows.
   */
  static async queryOne<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> {
    const result: QueryResult<T> = await DataService.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows.
   */
  static async queryAll<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
    const result: QueryResult<T> = await DataService.query<T>(text, params);
    return result.rows;
  }

  /**
   * Check database connectivity.
   */
  static async healthCheck(): Promise<boolean> {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

export default DataService;
