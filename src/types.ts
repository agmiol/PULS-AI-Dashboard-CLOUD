export interface DashboardFilters {
  month?: string; // e.g. "2025-05" or "all"
  startDate?: string; // ISO / YYYY-MM-DD
  endDate?: string;   // ISO / YYYY-MM-DD
  region?: string; // e.g. "Київська" or "Київська,Львівська" or "all"
  regions?: string[]; // array of selected region names
  selectedRegion?: string;
  selectedHromada?: string | null;
  selectedHromadaName?: string | null;
  granularity?: 'oblast' | 'hromada';
  persontype?: string; // "1" = ЮО / "LEGAL", "2" = ФОП / "FOP", "all"
  sentiment?: string; // "позитивна", "нейтральна", "негативна", "all"
  scoreCategory?: string; // "positive", "neutral", "negative", "all"
  generalIssueId?: number | null;
  detailedIssueId?: number | null;
  search?: string;
  trendDirection?: string; // "all" | "зростаючий" | "спадаючий" | "без тренду" | "недостатньо даних"
  trendStrength?: string; // "all" | "сильний" | "помірний" | "слабкий"
  hasRisingSignal?: string; // "all" | "yes" | "no"
  risingSignalIntensity?: string; // "all" | "сильний" | "помірний" | "слабкий"
  hasCommentOnly?: boolean;
}

export interface KPIStats {
  averageScore: number;
  averageScorePrev30d?: number;
  averageScoreGrowth30d?: number;
  totalScores: number;
  totalScores30d: number;
  totalScoresPrev30d: number;
  totalScoresGrowth30d: number;
  
  fopScores: number;
  fopScores30d: number;
  fopScoresPrev30d: number;
  fopScoresGrowth30d: number;
  
  legalScores: number;
  legalScores30d: number;
  legalScoresPrev30d: number;
  legalScoresGrowth30d: number;

  unknownScores: number;
  
  npsScoreBalance: number;
  npsScoreBalance30d?: number;
  npsScoreBalancePrev30d?: number;
  npsScoreBalanceGrowth30d?: number;
  totalComments: number;
  comments30d: number;
  commentsPrev30d: number;
  commentsGrowth30d: number;
}

export interface MonthlyScorePoint {
  month: string; // "03-25"
  monthFull: string; // "Березень 2025"
  monthRaw: string; // "2025-03-01"
  avgScore: number;
  totalScores: number;
  fopScores?: number;
  legalScores?: number;
  npsBalance?: number;
  totalComments: number;
}

export interface MonthlyDistributionPoint {
  month: string; // "03-25"
  monthRaw: string;
  positiveCount: number; // score >= 9
  neutralCount: number;  // 7-8
  negativeCount: number; // <= 6
}

export interface RegionMapPoint {
  oblast: string; // "Київська"
  fullName: string; // "Київська область"
  iso?: string; // "UA-32" (опціонально)
  count: number;
  avgScore: number;
  commentsCount: number;
  npsBalance?: number;
}

export interface HromadaStatItem {
  katottg_short: string;
  count: number;
  avg_score: number;
  comments_count: number;
  fop_count: number;
  legal_count: number;
  nps_balance?: number;
}

export interface MonthlyCommentPoint {
  month: string; // "03-25"
  monthRaw: string;
  totalComments: number;
  fopComments: number;
  legalComments: number;
}

export interface LegalFormDistributionPoint {
  persontype: string; // "1" | "2"
  label: string; // "Юридична особа" | "ФОП"
  count: number;
  percentage: number;
}

export interface NewSignalItem {
  detailedIssueId: number;
  issueTitle: string;
  generalIssueTitle: string;
  mechanism: string;
  mentionsCount: number;
  isNewIssue: string; // "Так" | "Ні"
  firstSeenAt: string;
  scopeTags?: string[];
  trendDirection?: string;
  trendStrength?: string | null;
  trendSlope?: number | null;
  risingSignal?: string;
  activitySpike?: boolean;
  hasActivitySpike?: boolean;
}

export interface GeneralIssueTrendItem {
  generalIssueId: number;
  issueTitle: string;
  mechanism: string;
  trendDirection: string; // "зростаючий" | "спадаючий" | "без тренду" | "недостатньо даних"
  trendStrength?: string | null;
  trendSlope?: number | null; // e.g. +1.4 в.п.
  risingSignal?: string; // "немає" | "слабкий" | "помірний" | "сильний"
  currentMentions: number;
  prevMentions: number;
  currentShare: number; // % від усіх коментарів за останні 30 днів
  prevShare: number; // % від усіх коментарів за передостанні 30 днів
  shareDiffPp: number; // Різниця частки у відсоткових пунктах (в.п.)
  totalMentions: number;
  shareRatio: number;
  sparkline: number[];
  monthsCount?: number;
  delta6?: number | null;
  robustNoise?: number | null;
  sTrend?: number | null;
  sRecent?: number | null;
  sigmaB?: number | null;
  deltaRecent?: number | null;
  activitySpike?: boolean;
  hasActivitySpike?: boolean;
}

export interface GeneralIssueFullItem {
  generalIssueId: number;
  issueTitle: string;
  mechanism: string;
  totalMentions: number;
  shareRatio: number;
  trendDirection: string;
  trendStrength?: string | null;
  trendSlope?: number | null;
  risingSignal?: string;
  activitySpike?: boolean;
  scopeTags?: string[];
  monthsCount?: number;
  delta6?: number | null;
  robustNoise?: number | null;
  sTrend?: number | null;
  sRecent?: number | null;
  sigmaB?: number | null;
  deltaRecent?: number | null;
  hasActivitySpike?: boolean;
}

export interface DetailedIssueFullItem {
  detailedIssueId: number;
  parentGeneralIssueId: number;
  generalIssueTitle?: string;
  signalName: string; // "Title | Mechanism"
  issueTitle: string;
  mechanism: string;
  totalMentions: number;
  totalAllTime: number;
  shareRatio?: number;
  trendType: string;
  trendPower?: string | null;
  slope?: number | null;
  risingSignal?: string;
  activitySpike?: boolean;
  hasActivitySpike?: boolean;
  isNewIssue: string; // "Так" | "Ні"
  scopeTags?: string[];
  oblast?: string;
  persontype?: string;
  monthsCount?: number;
  delta6?: number | null;
  robustNoise?: number | null;
  sTrend?: number | null;
  sRecent?: number | null;
  sigmaB?: number | null;
  deltaRecent?: number | null;
}

export interface FeedbackComment {
  id: number;
  score: number;
  persontype: string;
  personTypeLabel: string;
  created_at: string;
  oblast: string;
  comment: string;
  processed_comment: string;
  comment_quality: string;
  sentiment: string;
  general_issue_id?: number;
  general_issue_title?: string;
  detailed_issue_id?: number;
  detailed_issue_title?: string;
}

export interface DashboardData {
  kpis: KPIStats;
  monthlyScores: MonthlyScorePoint[];
  monthlyDistribution: MonthlyDistributionPoint[];
  regionsMap: RegionMapPoint[];
  hromadaStats?: HromadaStatItem[];
  monthlyComments: MonthlyCommentPoint[];
  legalFormDistribution: LegalFormDistributionPoint[];
  newSignals: NewSignalItem[];
  growingIssues: GeneralIssueTrendItem[];
  decliningIssues: GeneralIssueTrendItem[];
  fullGeneralIssues: GeneralIssueFullItem[];
  fullDetailedIssues: DetailedIssueFullItem[];
  sampleComments: FeedbackComment[];
  totalSampleCommentsCount: number;
  dbInfo: {
    connected: boolean;
    dbUrl: string;
    mode: 'google_sheets' | 'postgresql' | 'mock_simulation';
    totalFeedbackRows: number;
    lastRefreshed: string;
    lastError?: string;
    tables: {
      feedback_e: number;
      general_issues: number;
      detailed_issues: number;
      general_issue_comment: number;
      detailed_issue_comment: number;
      regions?: number;
    };
  };
}
