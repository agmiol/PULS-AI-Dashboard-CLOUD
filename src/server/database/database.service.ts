import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { loadActiveDbConfig, DbConfig, getActiveDbConfig, updateDbConfig as updatePgDbConfig } from '../postgresDb';

/**
 * NestJS Database Service managing TypeORM DataSource and PostgreSQL connection pools.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private dataSource: DataSource | null = null;
  private activeConfig: DbConfig = loadActiveDbConfig();

  async onModuleInit() {
    // Non-blocking initialization so server starts instantly even if DB tunnel is slow or reconnecting
    this.initTypeORM().catch(err => {
      console.warn('[NestJS TypeORM] Background connection init warning:', err?.message || err);
    });
  }

  async onModuleDestroy() {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  /**
   * Initializes or re-initializes TypeORM DataSource with active DB configuration
   */
  public async initTypeORM(): Promise<boolean> {
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }

      this.activeConfig = loadActiveDbConfig();

      this.dataSource = new DataSource({
        type: 'postgres',
        host: this.activeConfig.host,
        port: this.activeConfig.port,
        username: this.activeConfig.user,
        password: this.activeConfig.password,
        database: this.activeConfig.database,
        ssl: this.activeConfig.ssl ? { rejectUnauthorized: false } : false,
        synchronize: false, // Read-only production database - no auto schema migrations
        logging: process.env.NODE_ENV === 'development' ? ['error'] : false,
        extra: {
          max: 15,
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 30000,
        }
      });

      await this.dataSource.initialize();
      console.log(`[NestJS TypeORM] Connected successfully to ${this.activeConfig.host}:${this.activeConfig.port}/${this.activeConfig.database}`);
      return true;
    } catch (err: any) {
      console.warn(`[NestJS TypeORM] Connection warning (fallback to pgPool if needed): ${err.message}`);
      return false;
    }
  }

  public getDataSource(): DataSource | null {
    return this.dataSource;
  }

  public isConnected(): boolean {
    return Boolean(this.dataSource && this.dataSource.isInitialized);
  }

  public async query(queryText: string, parameters?: any[]): Promise<any> {
    if (this.dataSource && this.dataSource.isInitialized) {
      return this.dataSource.query(queryText, parameters);
    }
    // Fallback if needed
    const { pgPool } = await import('../postgresDb');
    const res = await pgPool.query(queryText, parameters);
    return res.rows;
  }

  public getDbConfig() {
    return getActiveDbConfig();
  }

  public async updateDbConfig(newConfig: Partial<DbConfig>) {
    const result = await updatePgDbConfig(newConfig);
    if (result.success) {
      await this.initTypeORM();
    }
    return result;
  }
}
