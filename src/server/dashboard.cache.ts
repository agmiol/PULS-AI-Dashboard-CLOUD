import crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { DashboardData, DashboardFilters } from '../types';

interface CacheEntry {
  data: DashboardData;
  etag: string;
  createdAt: number;
}

/**
 * High-Performance In-Memory LRU/TTL Cache for Sub-Millisecond (<5ms) Dashboard Serving.
 * Designed to handle high-concurrency spikes on public portals by serving pre-computed snapshots.
 * Easily migratable to Redis in NestJS architecture.
 */
@Injectable()
export class DashboardCacheService {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs: number;
  private maxEntries: number;

  constructor(ttlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || '120', 10), maxEntries = 500) {
    this.defaultTtlMs = ttlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  /**
   * Generates a deterministic normalized hash key based on the filter query parameters.
   */
  public generateFilterKey(filters: DashboardFilters): string {
    const sortedRegions = Array.isArray(filters.regions) ? [...filters.regions].sort().join(',') : (filters.region || 'all');

    const normalized = {
      m: filters.month || 'all',
      sd: filters.startDate || '',
      ed: filters.endDate || '',
      g: filters.granularity || 'oblast',
      sh: filters.selectedHromada || '',
      sr: filters.selectedRegion || '',
      r: sortedRegions,
      pt: filters.persontype || 'all',
      s: filters.sentiment || 'all',
      sc: filters.scoreCategory || 'all',
      gi: filters.generalIssueId ?? 'all',
      di: filters.detailedIssueId ?? 'all',
      q: (filters.search || '').trim().toLowerCase(),
      hc: Boolean(filters.hasCommentOnly)
    };
    return JSON.stringify(normalized);
  }

  /**
   * Compute deterministic MD5 ETag for HTTP 304 Not Modified validation.
   */
  public generateETag(data: DashboardData): string {
    const hash = crypto
      .createHash('md5')
      .update(`${data.kpis?.totalScores || 0}_${data.kpis?.averageScore || 0}_${data.dbInfo?.totalFeedbackRows || 0}`)
      .digest('hex');
    return `W/"${hash}"`;
  }

  public get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > this.defaultTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  public set(key: string, data: DashboardData): CacheEntry {
    const etag = this.generateETag(data);
    const entry: CacheEntry = {
      data,
      etag,
      createdAt: Date.now()
    };

    // Prevent memory leaks via LRU-like eviction
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, entry);
    return entry;
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const globalDashboardCache = new DashboardCacheService();
