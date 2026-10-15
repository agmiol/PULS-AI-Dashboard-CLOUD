import { REGIONS_LIST, POSTGRES_URL_MASKED } from './postgresDb';

export interface RawCatalogData {
  generalIssuesRows: string[][];
  detailedIssuesRows: string[][];
  regionsRows: string[][];
  generalIssueCommentRows: string[][];
  detailedIssueCommentRows: string[][];
  feedbackSampleRows: string[][];
}

/**
 * Abstraction Repository Interface for PostgreSQL Dashboard Data.
 */
export interface IDashboardRepository {
  checkHealth(): Promise<boolean>;
  getMetadata(): { database: string; url: string; regions: typeof REGIONS_LIST };
}

/**
 * PostgreSQL Implementation of IDashboardRepository
 */
export class PostgresDashboardRepository implements IDashboardRepository {
  public async checkHealth(): Promise<boolean> {
    return true;
  }

  public getMetadata() {
    return {
      database: process.env.DB_NAME || 'PULS_COPY',
      url: POSTGRES_URL_MASKED,
      regions: REGIONS_LIST
    };
  }
}

export const defaultDashboardRepository: IDashboardRepository = new PostgresDashboardRepository();
