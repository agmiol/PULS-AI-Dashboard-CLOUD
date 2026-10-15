import { Injectable } from '@nestjs/common';
import { DashboardData, DashboardFilters, FeedbackComment, RegionMapPoint, HromadaStatItem, GeneralIssueFullItem, DetailedIssueFullItem } from '../types';
import type { IDashboardRepository } from './dashboard.repository';
import { defaultDashboardRepository } from './dashboard.repository';
import { DashboardCacheService, globalDashboardCache } from './dashboard.cache';
import {
  getDashboardDataFromPostgres,
  getRegionalStatsFromPostgres,
  getIssueCommentsFromPostgres,
  getAllCommentsFromPostgres,
  searchIssuesFromPostgres,
  testPostgresConnection,
  getActiveDbConfig,
  updateDbConfig,
  DbConfig
} from './postgresDb';

/**
 * Service Layer for Dashboard Calculations & Cross-Filtering with direct PostgreSQL queries on PULS_COPY.
 */
@Injectable()
export class DashboardService {
  private readonly repository: IDashboardRepository = defaultDashboardRepository;

  constructor(
    private readonly cache: DashboardCacheService
  ) {}

  /**
   * Main method to fetch calculated dashboard payload according to cross-filters.
   */
  public async getDashboard(filters: DashboardFilters, bypassCache = false): Promise<{ data: DashboardData; etag: string; cached: boolean }> {
    const cacheKey = this.cache.generateFilterKey(filters);

    if (!bypassCache) {
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry && cachedEntry.data?.dbInfo?.connected) {
        return {
          data: cachedEntry.data,
          etag: cachedEntry.etag,
          cached: true
        };
      }
    }

    // Direct PostgreSQL queries on PULS_COPY (via live tunnel or production pool)
    const data = await getDashboardDataFromPostgres(filters);

    if (data.dbInfo && data.dbInfo.connected) {
      const savedEntry = this.cache.set(cacheKey, data);
      return {
        data: savedEntry.data,
        etag: savedEntry.etag,
        cached: false
      };
    } else {
      // Do NOT store disconnected DB state in cache. Clear stale cache so next request retries live DB
      this.cache.clear();
      const etag = this.cache.generateETag(data);
      return {
        data,
        etag,
        cached: false
      };
    }
  }

  /**
   * Regional / Hromada statistics endpoint query with granularity support
   */
  public async getRegionalStats(
    filters: DashboardFilters,
    bypassCache = false
  ): Promise<{ granularity: 'oblast' | 'hromada'; items: RegionMapPoint[] | HromadaStatItem[]; etag: string; cached: boolean }> {
    const cacheKey = `regional_stats_${this.cache.generateFilterKey(filters)}`;

    if (!bypassCache) {
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry) {
        return {
          granularity: filters.granularity || 'oblast',
          items: (cachedEntry.data as any).items || [],
          etag: cachedEntry.etag,
          cached: true
        };
      }
    }

    const res = await getRegionalStatsFromPostgres(filters);
    const savedEntry = this.cache.set(cacheKey, { items: res.items } as any);

    return {
      granularity: res.granularity,
      items: res.items,
      etag: savedEntry.etag,
      cached: false
    };
  }

  /**
   * Get all comments with server-side pagination, full-text search across all feedback comments
   */
  public async getAllComments(
    filters: DashboardFilters,
    searchQuery: string = '',
    page: number = 1,
    pageSize: number = 50,
    personTypeFilter?: string
  ): Promise<{
    comments: FeedbackComment[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      return await getAllCommentsFromPostgres(filters, searchQuery, page, pageSize, personTypeFilter);
    } catch (err) {
      console.error('[DashboardService Error] getAllComments failed:', err);
      return {
        comments: [],
        totalCount: 0,
        page: 1,
        pageSize,
        totalPages: 1
      };
    }
  }

  /**
   * Get all comments for a specific issue from PostgreSQL
   */
  public async getIssueComments(type: 'general' | 'detailed', issueId: number, filters?: DashboardFilters): Promise<FeedbackComment[]> {
    try {
      return await getIssueCommentsFromPostgres(type, issueId, filters);
    } catch (err) {
      console.error('[DashboardService Error] getIssueComments failed:', err);
      return [];
    }
  }

  /**
   * Dedicated Full-Text Search on general_issues and detailed_issues search_vector
   */
  public async searchIssues(query: string): Promise<{ generalIssues: GeneralIssueFullItem[]; detailedIssues: DetailedIssueFullItem[] }> {
    try {
      return await searchIssuesFromPostgres(query);
    } catch (err) {
      console.error('[DashboardService Error] searchIssues failed:', err);
      return { generalIssues: [], detailedIssues: [] };
    }
  }

  /**
   * Health Check
   */
  public async getHealth(): Promise<{ status: string; dbConnected: boolean; timestamp: string }> {
    const pgIsLive = await testPostgresConnection();
    return {
      status: pgIsLive ? 'ok' : 'degraded',
      dbConnected: pgIsLive,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get Catalogs metadata
   */
  public async getCatalogs(): Promise<any> {
    const meta = this.repository.getMetadata();
    return {
      regions: meta.regions,
      generalIssuesCount: 30,
      detailedIssuesCount: 330,
      database: 'PostgreSQL PULS_COPY',
      url: meta.url
    };
  }

  /**
   * Get dynamic DB configuration
   */
  public getDbConfig(): any {
    return getActiveDbConfig();
  }

  /**
   * Update dynamic DB configuration and clear cache
   */
  public async updateDbConfig(newConfig: Partial<DbConfig>): Promise<{ success: boolean; message: string; config?: any; error?: string }> {
    const res = await updateDbConfig(newConfig);
    if (res.success) {
      this.clearCache();
    }
    return res;
  }

  /**
   * Invalidate cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const defaultDashboardService = new DashboardService(globalDashboardCache);
