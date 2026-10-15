import { Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DashboardService, defaultDashboardService } from './dashboard.service';
import { DashboardFilters } from '../types';

/**
 * NestJS Controller providing route handling, parameter validation, and HTTP headers.
 */
@Controller('api')
export class DashboardController {
  constructor(private readonly service: DashboardService) {
    this.getData = this.getData.bind(this);
    this.postData = this.postData.bind(this);
    this.getRegionalStatsGet = this.getRegionalStatsGet.bind(this);
    this.getRegionalStatsPost = this.getRegionalStatsPost.bind(this);
    this.getRegionalStats = this.getRegionalStats.bind(this);
    this.getAllCommentsGet = this.getAllCommentsGet.bind(this);
    this.getAllCommentsPost = this.getAllCommentsPost.bind(this);
    this.getAllComments = this.getAllComments.bind(this);
    this.getIssueComments = this.getIssueComments.bind(this);
    this.searchIssues = this.searchIssues.bind(this);
    this.getHealth = this.getHealth.bind(this);
    this.getCatalogs = this.getCatalogs.bind(this);
    this.testDb = this.testDb.bind(this);
    this.getDbConfig = this.getDbConfig.bind(this);
    this.updateDbConfig = this.updateDbConfig.bind(this);
    this.loginPost = this.loginPost.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.login = this.login.bind(this);
  }

  /**
   * Parse and sanitize query parameters into typed DashboardFilters DTO
   */
  private parseFilters(req: Request): DashboardFilters {
    const q = req.query;
    
    // Parse single or multi-regions
    let regions: string[] | undefined;
    if (q.regions) {
      regions = typeof q.regions === 'string' ? q.regions.split(',') : (q.regions as string[]);
    }

    // Safe string sanitization
    const sanitizeStr = (val: any): string => (typeof val === 'string' ? val.trim().slice(0, 100) : '');

    const granularityRaw = sanitizeStr(q.granularity);
    const granularity: 'oblast' | 'hromada' = granularityRaw === 'hromada' ? 'hromada' : 'oblast';

    return {
      month: sanitizeStr(q.month) || 'all',
      startDate: sanitizeStr(q.startDate),
      endDate: sanitizeStr(q.endDate),
      region: sanitizeStr(q.region) || 'all',
      regions,
      selectedRegion: sanitizeStr(q.selectedRegion),
      selectedHromada: sanitizeStr(q.selectedHromada || q.hromada),
      granularity,
      persontype: sanitizeStr(q.persontype) || 'all',
      sentiment: sanitizeStr(q.sentiment) || 'all',
      scoreCategory: sanitizeStr(q.scoreCategory) || 'all',
      generalIssueId: q.generalIssueId ? parseInt(q.generalIssueId as string, 10) : null,
      detailedIssueId: q.detailedIssueId ? parseInt(q.detailedIssueId as string, 10) : null,
      search: sanitizeStr(q.search),
      hasCommentOnly: String(q.hasCommentOnly) === 'true'
    };
  }

  /**
   * GET /api/dashboard/data
   */
  @Get('dashboard/data')
  public async getData(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const filters = this.parseFilters(req);
      const bypassCache = req.query.refresh === 'true';
      const { data, etag, cached } = await this.service.getDashboard(filters, bypassCache);

      // Support ETag conditional requests (304 Not Modified)
      const clientETag = req.headers['if-none-match'];
      if (clientETag && clientETag === etag) {
        res.status(304).end();
        return;
      }

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.setHeader('ETag', etag);
      res.setHeader('X-Cache-Status', cached ? 'HIT' : 'MISS');

      res.json(data);
    } catch (error: any) {
      console.error('[DashboardController Error]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * POST /api/dashboard/data
   */
  @Post('dashboard/data')
  public async postData(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const filters: DashboardFilters = {
        ...this.parseFilters(req),
        ...(req.body || {})
      };
      const bypassCache = req.body?.refresh === true || req.query.refresh === 'true';
      const { data, etag, cached } = await this.service.getDashboard(filters, bypassCache);

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.setHeader('ETag', etag);
      res.setHeader('X-Cache-Status', cached ? 'HIT' : 'MISS');

      res.json(data);
    } catch (error: any) {
      console.error('[DashboardController Error]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /api/dashboard/regional-stats
   */
  @Get('dashboard/regional-stats')
  public async getRegionalStatsGet(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handleRegionalStats(req, res);
  }

  /**
   * POST /api/dashboard/regional-stats
   */
  @Post('dashboard/regional-stats')
  public async getRegionalStatsPost(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handleRegionalStats(req, res);
  }

  public getRegionalStats = (req: Request, res: Response): Promise<void> => {
    return this.handleRegionalStats(req, res);
  };

  private async handleRegionalStats(req: Request, res: Response): Promise<void> {
    try {
      const filters: DashboardFilters = req.method === 'POST'
        ? { ...this.parseFilters(req), ...(req.body || {}) }
        : this.parseFilters(req);
      const bypassCache = req.query.refresh === 'true' || req.body?.refresh === true;

      const { granularity, items, etag, cached } = await this.service.getRegionalStats(filters, bypassCache);

      const clientETag = req.headers['if-none-match'];
      if (clientETag && clientETag === etag) {
        res.status(304).end();
        return;
      }

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.setHeader('ETag', etag);
      res.setHeader('X-Cache-Status', cached ? 'HIT' : 'MISS');

      res.json({ granularity, items });
    } catch (error: any) {
      console.error('[DashboardController Error - getRegionalStats]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /api/dashboard/all-comments
   */
  @Get('dashboard/all-comments')
  public async getAllCommentsGet(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handleAllComments(req, res);
  }

  /**
   * POST /api/dashboard/all-comments
   */
  @Post('dashboard/all-comments')
  public async getAllCommentsPost(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handleAllComments(req, res);
  }

  public getAllComments = (req: Request, res: Response): Promise<void> => {
    return this.handleAllComments(req, res);
  };

  private async handleAllComments(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.method === 'POST' ? (req.body?.filters || this.parseFilters(req)) : this.parseFilters(req);
      const search = (req.query.search as string) || req.body?.search || '';
      const rawPage = parseInt((req.query.page as string) || req.body?.page || '1', 10);
      const rawPageSize = parseInt((req.query.pageSize as string) || req.body?.pageSize || '50', 10);
      const personTypeFilter = (req.query.personTypeFilter as string) || req.body?.personTypeFilter;

      // Safe bounds validation
      const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
      const pageSize = Math.min(100, Math.max(10, isNaN(rawPageSize) ? 50 : rawPageSize));

      const result = await this.service.getAllComments(
        filters,
        search.slice(0, 100),
        page,
        pageSize,
        personTypeFilter
      );

      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json(result);
    } catch (error: any) {
      console.error('[DashboardController Error - getAllComments]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /api/dashboard/issue-comments
   */
  @Get('dashboard/issue-comments')
  public async getIssueComments(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const type = req.query.type === 'detailed' ? 'detailed' : 'general';
      const id = parseInt(req.query.id as string, 10);
      if (isNaN(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid issue id' });
        return;
      }
      const filters = this.parseFilters(req);
      const comments = await this.service.getIssueComments(type, id, filters);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({ comments, count: comments.length });
    } catch (error: any) {
      console.error('[DashboardController Error]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /api/dashboard/search-issues
   * Performs PostgreSQL Full-Text Search on search_vector with 'ukrainian' regconfig
   */
  @Get('dashboard/search-issues')
  public async searchIssues(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const q = (req.query.q as string) || (req.query.search as string) || '';
      const result = await this.service.searchIssues(q.slice(0, 100));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(result);
    } catch (error: any) {
      console.error('[DashboardController Error - searchIssues]', error);
      res.status(500).json({ error: 'Failed to search issues' });
    }
  }

  /**
   * POST /api/auth/login
   */
  @Post('auth/login')
  public async loginPost(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handleLogin(req, res);
  }

  public login = (req: Request, res: Response): Promise<void> => {
    return this.handleLogin(req, res);
  };

  private async handleLogin(req: Request, res: Response): Promise<void> {
    try {
      const username = (req.body?.username || req.body?.login || '').trim();
      const password = (req.body?.password || '').trim();

      const validLogin = 'pulsadmin';
      const validPasswords = ['jC&T–F)]CX@?8hh', 'jC&T-F)]CX@?8hh'];

      if (username === validLogin && validPasswords.includes(password)) {
        res.json({
          success: true,
          token: 'puls_session_valid_2026',
          user: { login: 'pulsadmin', name: 'Адміністратор ПУЛЬС' }
        });
      } else {
        res.status(401).json({ success: false, error: 'Невірний логін або пароль' });
      }
    } catch (error) {
      console.error('[DashboardController Error - login]', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }

  /**
   * GET /api/health
   */
  @Get('health')
  public async getHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    const result = await this.service.getHealth();
    res.json(result);
  }

  /**
   * GET /api/dashboard/catalogs
   */
  @Get('dashboard/catalogs')
  public async getCatalogs(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const result = await this.service.getCatalogs();
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch catalogs' });
    }
  }

  /**
   * GET /api/dashboard/test-db
   */
  @Get('dashboard/test-db')
  public async testDb(@Req() req: Request, @Res() res: Response): Promise<void> {
    const health = await this.service.getHealth();
    res.json({
      connected: health.dbConnected,
      message: health.dbConnected
        ? 'Успішно підключено до бази даних PULS_COPY'
        : 'Джерело даних (PostgreSQL) тимчасово недоступне.'
    });
  }

  /**
   * GET /api/db-config
   */
  @Get('db-config')
  public async getDbConfig(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const config = this.service.getDbConfig();
      const health = await this.service.getHealth();
      res.json({
        connected: health.dbConnected,
        config
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve DB config' });
    }
  }

  /**
   * POST /api/db-config
   * Protected with Admin Token check to prevent unauthorized remote DB configuration changes.
   */
  @Post('db-config')
  public async updateDbConfig(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      // Authorization Guard for DB Config updates
      const adminToken = (req.headers['x-admin-token'] as string) || req.body?.adminToken || (req.query.token as string);
      const requiredToken = process.env.ADMIN_CONFIG_TOKEN;

      if (requiredToken && adminToken !== requiredToken) {
        res.status(403).json({
          success: false,
          error: 'Доступ заборонено: Необхідний дійсний X-Admin-Token для зміни налаштувань бази даних.'
        });
        return;
      }

      const { host, port, user, password, database, ssl } = req.body || {};
      const result = await this.service.updateDbConfig({
        host,
        port: port ? Number(port) : undefined,
        user,
        password,
        database,
        ssl: ssl !== undefined ? Boolean(ssl) : undefined
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update DB config' });
    }
  }
}

export const defaultDashboardController = new DashboardController(defaultDashboardService);
