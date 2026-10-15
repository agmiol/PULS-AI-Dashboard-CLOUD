import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { 
  DashboardData, 
  DashboardFilters, 
  RegionMapPoint, 
  HromadaStatItem,
  MonthlyScorePoint, 
  MonthlyDistributionPoint, 
  MonthlyCommentPoint, 
  LegalFormDistributionPoint, 
  GeneralIssueFullItem, 
  DetailedIssueFullItem, 
  FeedbackComment,
  KPIStats,
  GeneralIssueTrendItem,
  NewSignalItem
} from '../types';

export interface DbConfig {
  user: string;
  password?: string;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

const RUNTIME_CONFIG_PATH = path.join(process.cwd(), 'runtime-db-config.json');

export function loadActiveDbConfig(): DbConfig {
  let fileConfig: Partial<DbConfig> = {};
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const content = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(content);
    }
  } catch (err) {
    console.warn('[PostgreSQL Config] Failed to read runtime-db-config.json:', err);
  }

  const rawUser = fileConfig.user || process.env.POSTGRES_USER || process.env.DB_USER || 'ai_readonly';
  const rawHost = fileConfig.host || process.env.POSTGRES_HOST || process.env.DB_HOST || '127.0.0.1';
  const rawDatabase = fileConfig.database || process.env.POSTGRES_DB || process.env.DB_NAME || 'PULS_2.0';

  return {
    user: String(rawUser).trim(),
    password: fileConfig.password !== undefined 
      ? fileConfig.password 
      : (process.env.POSTGRES_PASSWORD !== undefined ? process.env.POSTGRES_PASSWORD : (process.env.DB_PASSWORD || '#!264dfa330dDD17ga9%$')),
    host: String(rawHost).trim(),
    port: fileConfig.port ? Number(fileConfig.port) : parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10),
    database: String(rawDatabase).trim(),
    ssl: fileConfig.ssl !== undefined 
      ? Boolean(fileConfig.ssl) 
      : (process.env.POSTGRES_SSL === 'true' || process.env.DB_SSL === 'true')
  };
}

let activeConfig: DbConfig = loadActiveDbConfig();

export function getActiveDbConfig(): Omit<DbConfig, 'password'> & { hasPassword: boolean; maskedUrl: string } {
  return {
    user: activeConfig.user,
    host: activeConfig.host,
    port: activeConfig.port,
    database: activeConfig.database,
    ssl: activeConfig.ssl,
    hasPassword: Boolean(activeConfig.password),
    maskedUrl: `postgresql://${activeConfig.user}:***@${activeConfig.host}:${activeConfig.port}/${activeConfig.database}`
  };
}

export function createPgPool(config: DbConfig): Pool {
  return new Pool({
    user: config.user,
    password: config.password,
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    max: 15,
    idleTimeoutMillis: 30000,
  });
}

export let pgPool = createPgPool(activeConfig);

export function getPOSTGRES_URL_MASKED(): string {
  return getActiveDbConfig().maskedUrl;
}

export const POSTGRES_URL_MASKED = getPOSTGRES_URL_MASKED();

export const REGIONS_LIST = [
  "Вінницька", "Волинська", "Дніпропетровська", "Донецька", "Житомирська",
  "Закарпатська", "Запорізька", "Івано-Франківська", "Київська", "м. Київ",
  "Кіровоградська", "Луганська", "Львівська", "Миколаївська", "Одеська",
  "Полтавська", "Рівненська", "Сумська", "Тернопільська", "Харківська",
  "Херсонська", "Хмельницька", "Черкаська", "Чернівецька", "Чернігівська"
];

export function formatPgError(err: any): string {
  const errMsg = String(err?.message || err || '');
  if (errMsg.includes('pg_hba.conf')) {
    const ipMatch = errMsg.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const ip = ipMatch ? ipMatch[0] : '127.242.136.196';
    return `Помилка конфігурації доступу PostgreSQL (pg_hba.conf):\n` +
      `Сервер PostgreSQL на вашому ПК відхилив підключення з IP "${ip}" для користувача "${activeConfig.user}" до бази "${activeConfig.database}".\n\n` +
      `Кроки для вирішення на вашому ПК/сервері PostgreSQL:\n` +
      `1. Відкрийте файл pg_hba.conf (наприклад, C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf або /etc/postgresql/16/main/pg_hba.conf).\n` +
      `2. Додайте новий рядок дозволу для тунелю:\n` +
      `   host    ${activeConfig.database}    ${activeConfig.user}    all    scram-sha-256\n` +
      `   (або замініть scram-sha-256 на md5 або trust залежно від вашого зв'язку)\n` +
      `3. Оновіть конфігурацію PostgreSQL без перезапуску сервісу, виконавши у pgAdmin / psql:\n` +
      `   SELECT pg_reload_conf();`;
  }

  if (errMsg.includes('password authentication failed') || errMsg.includes('пароль')) {
    return `Помилка автентифікації PostgreSQL: Невірний пароль для користувача "${activeConfig.user}". Будь ласка, перевірте пароль у налаштуваннях тунелю.`;
  }

  if (errMsg.includes('does not support SSL') || errMsg.includes('SSL connections')) {
    return `Сервер PostgreSQL не підтримує SSL з'єднання. Спробуйте вимкнути галочку SSL у налаштуваннях.`;
  }

  if (errMsg.includes('no encryption') || errMsg.includes('SSL required')) {
    return `Сервер PostgreSQL вимагає шифрування SSL. Спробуйте увімкнути галочку SSL у налаштуваннях.`;
  }

  if (errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND')) {
    return `Помилка мережі (playit.gg тунель): Не вдалося встановити TCP-з'єднання з хостом ${activeConfig.host}:${activeConfig.port}. Перевірте, чи запущено агент playit.gg на вашому ПК.`;
  }

  return errMsg;
}

export async function updateDbConfig(newConfigPartial: Partial<DbConfig>): Promise<{ success: boolean; message: string; config?: any; error?: string }> {
  const candidateConfig: DbConfig = {
    user: (newConfigPartial.user !== undefined && newConfigPartial.user.trim() !== '' ? newConfigPartial.user : activeConfig.user).trim(),
    password: (newConfigPartial.password !== undefined && newConfigPartial.password.trim() !== '') ? newConfigPartial.password : activeConfig.password,
    host: (newConfigPartial.host !== undefined && newConfigPartial.host.trim() !== '' ? newConfigPartial.host : activeConfig.host).trim(),
    port: newConfigPartial.port ? Number(newConfigPartial.port) : activeConfig.port,
    database: (newConfigPartial.database !== undefined && newConfigPartial.database.trim() !== '' ? newConfigPartial.database : activeConfig.database).trim(),
    ssl: newConfigPartial.ssl !== undefined ? Boolean(newConfigPartial.ssl) : activeConfig.ssl,
  };

  const testPool = createPgPool(candidateConfig);
  try {
    const client = await testPool.connect();
    const res = await client.query('SELECT NOW(), current_database();');
    client.release();
    await testPool.end();

    const oldPool = pgPool;
    activeConfig = candidateConfig;
    pgPool = createPgPool(activeConfig);

    oldPool.end().catch(err => console.warn('[PostgreSQL Pool] Old pool end error:', err));

    try {
      fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(activeConfig, null, 2), 'utf-8');
      console.log('[PostgreSQL Config] Runtime config saved successfully to runtime-db-config.json');
    } catch (fsErr) {
      console.error('[PostgreSQL Config] Failed writing runtime-db-config.json:', fsErr);
    }

    return {
      success: true,
      message: `Успішно підключено до хосту ${activeConfig.host}:${activeConfig.port} (База: ${activeConfig.database})!`,
      config: getActiveDbConfig()
    };
  } catch (err: any) {
    await testPool.end().catch(() => {});
    const formattedErr = formatPgError(err);
    return {
      success: false,
      message: `Не вдалося підключитися до хосту ${candidateConfig.host}:${candidateConfig.port}`,
      error: formattedErr
    };
  }
}

// Helper math functions for Methodology V3 trend & signal calculations
function parseMonthKeyToCalendarIndex(mKey: string): number {
  const parts = mKey.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return y * 12 + m;
}

function mathMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mathMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function sampleStdDev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const avg = mathMean(arr);
  const sumSq = arr.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0);
  return Math.sqrt(sumSq / (arr.length - 1));
}

function calculateMAD(arr: number[]): { mad: number; robustNoise: number } {
  if (arr.length === 0) return { mad: 0, robustNoise: 0 };
  const med = mathMedian(arr);
  const absDevs = arr.map(v => Math.abs(v - med));
  const mad = mathMedian(absDevs);
  let robustNoise = 1.4826 * mad;
  if (mad === 0) {
    const sd = sampleStdDev(arr);
    if (sd > 0) {
      robustNoise = sd;
    }
  }
  return { mad, robustNoise };
}

function calculateTheilSenSlope(x: number[], y: number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < y.length; i++) {
    for (let j = i + 1; j < y.length; j++) {
      const dx = x[j] - x[i];
      if (dx !== 0) {
        slopes.push((y[j] - y[i]) / dx);
      }
    }
  }
  if (slopes.length === 0) return 0;
  return mathMedian(slopes);
}

export function calculateActivitySpikeV3(
  rawShares: number[],
  rawMentions: number[],
  ma3mShares: number[]
): boolean {
  const N = rawShares.length;
  if (N < 9) return false;

  const recentShares = rawShares.slice(-3); // T-2, T-1, T (last 3 complete months)
  const recentMentionsArr = rawMentions.slice(-3);
  const baselineShares = rawShares.slice(-9, -3); // T-8..T-3 (previous 6 complete months)
  const baselineMentionsArr = rawMentions.slice(-9, -3);

  const R = mathMean(recentShares);
  const B = mathMean(baselineShares);

  const aRecent = recentMentionsArr.filter(m => m > 0).length;
  const cRecent = recentMentionsArr.reduce((a, b) => a + b, 0);
  const cBaseline = baselineMentionsArr.reduce((a, b) => a + b, 0);

  // Recency gate: at least 1 mention in T-1 or T (last 2 complete months)
  const recencyGate = (recentMentionsArr[1] + recentMentionsArr[2]) >= 1;

  // top2_MA gate: latest 3M MA is among top 2 3M MAs in historical series
  const latestMA = ma3mShares.length > 0 ? ma3mShares[ma3mShares.length - 1] : R;
  const sortedMAs = ma3mShares.length > 0 ? [...ma3mShares].sort((a, b) => a - b) : [R];
  const top2Threshold = sortedMAs.length >= 2 ? sortedMAs[sortedMAs.length - 2] : sortedMAs[0];
  const isTop2MA = ma3mShares.length > 0 ? latestMA >= (top2Threshold - 1e-9) : true;

  const commonGates = cRecent >= 3 && aRecent >= 2 && recencyGate && isTop2MA;

  if (commonGates) {
    if (B > 0 && cBaseline > 0) {
      const shareLift = R / B;
      const countLift = (2 * cRecent) / cBaseline; // (cRecent / 3) / (cBaseline / 6)

      const standardBranch = (shareLift >= (2.0 - 1e-9)) && (countLift >= (1.5 - 1e-9));
      const highVolumeBranch = (cRecent >= 10) && (shareLift >= (2.0 - 1e-9)) && (countLift >= (1.3 - 1e-9));
      const strongCountBranch = (cRecent >= 4) && (shareLift >= (1.7 - 1e-9)) && (countLift >= (1.5 - 1e-9));

      return standardBranch || highVolumeBranch || strongCountBranch;
    } else if (B <= 1e-12 && cBaseline === 0) {
      return true;
    }
  }

  return false;
}

export async function acquirePgClient(): Promise<any> {
  try {
    return await pgPool.connect();
  } catch (err: any) {
    console.warn('[PostgreSQL Pool] Initial connection acquire failed. Recreating pool with active config...', err?.message || err);
    try {
      await pgPool.end().catch(() => {});
    } catch (_) {}
    pgPool = createPgPool(activeConfig);
    return await pgPool.connect();
  }
}

export async function testPostgresConnection(): Promise<boolean> {
  try {
    const client = await acquirePgClient();
    const res = await client.query('SELECT NOW(), current_database();');
    console.log('[PostgreSQL] Connected successfully to:', res.rows[0]);
    
    const countRes = await client.query('SELECT COUNT(*)::int AS total FROM feedback_e;');
    console.log('[PostgreSQL] Total rows in feedback_e:', countRes.rows[0]?.total);

    client.release();
    return true;
  } catch (err) {
    const formatted = formatPgError(err);
    console.error('[PostgreSQL Connection Error]:', formatted);
    return false;
  }
}

function buildWhereClause(filters: DashboardFilters, params: any[], alias = 'f'): string {
  const conditions: string[] = ['1=1'];

  // Half-open interval for created_at: f.created_at >= $X AND f.created_at < $Y
  if (filters.startDate) {
    params.push(filters.startDate);
    conditions.push(`${alias}.created_at >= $${params.length}`);
  }

  if (filters.endDate) {
    params.push(filters.endDate);
    conditions.push(`${alias}.created_at < $${params.length}`);
  }

  if (filters.month && filters.month !== 'all' && !filters.startDate) {
    const rawMonths = filters.month.split(',').map(s => s.trim().substring(0, 7)).filter(Boolean);
    if (rawMonths.length > 0) {
      params.push(rawMonths);
      conditions.push(`to_char(${alias}.created_at, 'YYYY-MM') = ANY($${params.length})`);
    }
  }

  // Filter by hromada (katottg_short)
  if (filters.selectedHromada && filters.selectedHromada !== 'all' && filters.selectedHromada.trim().length > 0) {
    const hVal = filters.selectedHromada.trim();
    params.push(hVal);
    if (filters.selectedHromadaName && filters.selectedHromadaName.trim().length > 0 && filters.selectedHromadaName.trim() !== hVal) {
      params.push(filters.selectedHromadaName.trim());
      conditions.push(`(${alias}.katottg_short = $${params.length - 1} OR ${alias}.katottg_short ILIKE $${params.length - 1} OR ${alias}.katottg_short = $${params.length} OR ${alias}.katottg_short ILIKE $${params.length})`);
    } else {
      conditions.push(`(${alias}.katottg_short = $${params.length} OR ${alias}.katottg_short ILIKE $${params.length})`);
    }
  }

  // Filter by oblast (selectedRegion or region/regions)
  if (filters.selectedRegion && filters.selectedRegion !== 'all' && filters.selectedRegion.trim().length > 0) {
    params.push(filters.selectedRegion.trim());
    conditions.push(`${alias}.oblast = $${params.length}`);
  } else {
    const rawRegions = (filters.regions && filters.regions.length > 0)
      ? filters.regions
      : (filters.region && filters.region !== 'all' ? filters.region.split(',').map(s => s.trim()).filter(Boolean) : []);

    if (rawRegions.length > 0) {
      const regionSubConditions: string[] = [];
      for (const r of rawRegions) {
        const norm = r.trim();
        if (!norm || norm === 'all') continue;
        if (norm === 'Київ' || norm === 'м. Київ' || norm === 'м.Київ') {
          regionSubConditions.push(`(${alias}.oblast = 'Київ' OR ${alias}.oblast = 'м. Київ' OR ${alias}.oblast = 'м.Київ')`);
        } else if (norm.includes('Київська')) {
          regionSubConditions.push(`(${alias}.oblast = 'Київська' OR ${alias}.oblast = 'Київська область' OR ${alias}.oblast = 'Київська обл.')`);
        } else if (norm.includes('Севастополь')) {
          regionSubConditions.push(`(${alias}.oblast = 'Севастополь' OR ${alias}.oblast = 'м. Севастополь' OR ${alias}.oblast = 'м.Севастополь')`);
        } else if (norm.includes('Крим')) {
          regionSubConditions.push(`(${alias}.oblast = 'Автономна Республіка Крим' OR ${alias}.oblast = 'АР Крим' OR ${alias}.oblast LIKE '%Крим%')`);
        } else {
          const cleanName = norm.replace(/область|обл\.|м\./g, '').trim();
          params.push(cleanName);
          regionSubConditions.push(`(${alias}.oblast = $${params.length} OR ${alias}.oblast LIKE $${params.length} || '%')`);
        }
      }
      if (regionSubConditions.length > 0) {
        conditions.push(`(${regionSubConditions.join(' OR ')})`);
      }
    }
  }

  // Filter by person type: 'FOP' -> persontype::text = '2', 'LEGAL' -> persontype::text = '1'
  if (filters.persontype && filters.persontype !== 'all') {
    const pt = filters.persontype.trim();
    if (pt === 'FOP' || pt === '2') {
      conditions.push(`${alias}.persontype::text = '2'`);
    } else if (pt === 'LEGAL' || pt === '1') {
      conditions.push(`${alias}.persontype::text = '1'`);
    } else if (pt === 'unknown') {
      conditions.push(`(${alias}.persontype IS NULL OR ${alias}.persontype = '' OR ${alias}.persontype = 'unknown')`);
    } else {
      params.push(pt);
      conditions.push(`${alias}.persontype::text = $${params.length}`);
    }
  }

  if (filters.scoreCategory && filters.scoreCategory !== 'all') {
    if (filters.scoreCategory === 'positive') {
      conditions.push(`${alias}.score >= 9`);
    } else if (filters.scoreCategory === 'neutral') {
      conditions.push(`${alias}.score >= 7 AND ${alias}.score <= 8`);
    } else if (filters.scoreCategory === 'negative') {
      conditions.push(`${alias}.score <= 6`);
    }
  }

  if (filters.generalIssueId) {
    params.push(Number(filters.generalIssueId));
    conditions.push(`$${params.length}::int = ANY(${alias}.general_issue_id)`);
  }

  if (filters.detailedIssueId) {
    params.push(Number(filters.detailedIssueId));
    conditions.push(`$${params.length}::int = ANY(${alias}.detailed_issue_id)`);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const qStr = filters.search.trim();
    const cleanId = parseInt(qStr.replace(/^[\s#№]+/, ''), 10);
    const parsedId = !isNaN(cleanId) ? cleanId : -1;

    const cleanWords = qStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const prefixTsQuery = cleanWords
      .map(w => w.replace(/['":&|!()*\\/]/g, '').trim() + ':*')
      .filter(w => w !== ':*')
      .join(' & ');

    params.push(parsedId);
    const idIdx = params.length;

    params.push(qStr);
    const qIdx = params.length;

    params.push(prefixTsQuery);
    const pIdx = params.length;

    conditions.push(`(
      ${alias}.id = $${idIdx}
      OR ${alias}.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx})
      OR ${alias}.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $${qIdx})
      OR ($${pIdx} <> '' AND ${alias}.search_vector @@ to_tsquery('ukrainian'::regconfig, $${pIdx}))
      OR (
        ${alias}.search_vector IS NULL
        AND to_tsvector('ukrainian'::regconfig, COALESCE(${alias}.processed_comment, ${alias}.comment, '')) @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx})
      )
      OR ${alias}.processed_comment ILIKE '%' || $${qIdx} || '%'
      OR ${alias}.comment ILIKE '%' || $${qIdx} || '%'
    )`);
  }

  if (filters.hasCommentOnly) {
    conditions.push(`(${alias}.processed_comment IS NOT NULL AND length(trim(${alias}.processed_comment)) > 0)`);
  }

  return conditions.join(' AND ');
}

export async function getHromadaStatsFromPostgres(filters: DashboardFilters, existingClient?: any): Promise<HromadaStatItem[]> {
  const client = existingClient || (await acquirePgClient());
  try {
    const params: any[] = [];
    const filtersNoHromada = { ...filters, selectedHromada: undefined };
    const rawWhere = buildWhereClause(filtersNoHromada, params, 'f');
    const whereString = (rawWhere && rawWhere !== '1=1') ? `WHERE ${rawWhere}` : '';

    const sql = `
      SELECT
        f.katottg_short,
        COUNT(*)::int AS count,
        ROUND(AVG(f.score)::numeric, 2)::float AS avg_score,
        COUNT(CASE WHEN f.comment IS NOT NULL AND TRIM(f.comment) <> '' THEN 1 END)::int AS comments_count,
        COUNT(CASE WHEN f.persontype::text = '2' THEN 1 END)::int AS fop_count,
        COUNT(CASE WHEN f.persontype::text = '1' THEN 1 END)::int AS legal_count,
        COUNT(CASE WHEN f.score >= 9 THEN 1 END)::int AS pos_count,
        COUNT(CASE WHEN f.score <= 6 THEN 1 END)::int AS neg_count
      FROM feedback_e f
      ${whereString ? `${whereString} AND` : 'WHERE'} f.katottg_short IS NOT NULL AND f.katottg_short <> ''
      GROUP BY f.katottg_short
      ORDER BY count DESC;
    `;
    const res = await client.query(sql, params);
    return res.rows.map(r => {
      const c = r.count || 0;
      const d = c > 0 ? c : 1;
      const posPct = ((r.pos_count || 0) / d) * 100;
      const negPct = ((r.neg_count || 0) / d) * 100;
      return {
        katottg_short: r.katottg_short,
        count: c,
        avg_score: Number(r.avg_score || 0),
        comments_count: r.comments_count || 0,
        fop_count: r.fop_count || 0,
        legal_count: r.legal_count || 0,
        nps_balance: Number((posPct - negPct).toFixed(1))
      };
    });
  } finally {
    if (!existingClient) {
      client.release();
    }
  }
}

export async function getRegionalStatsFromPostgres(filters: DashboardFilters): Promise<{ granularity: 'oblast' | 'hromada'; items: RegionMapPoint[] | HromadaStatItem[] }> {
  let client: any = null;
  try {
    client = await acquirePgClient();
    if (filters.granularity === 'hromada') {
      const items = await getHromadaStatsFromPostgres(filters, client);
      return { granularity: 'hromada', items };
    } else {
      const regParams: any[] = [];
      const filtersNoRegion = { ...filters, region: 'all', selectedRegion: undefined };
      const regWhere = buildWhereClause(filtersNoRegion, regParams, 'f');
      const regSql = `
        SELECT 
          CASE 
            WHEN trim(f.oblast) IN ('Київ', 'м. Київ', 'м.Київ') THEN 'Київ'
            WHEN trim(f.oblast) LIKE 'Київська%' THEN 'Київська'
            WHEN trim(f.oblast) IN ('Севастополь', 'м. Севастополь', 'м.Севастополь') THEN 'Севастополь'
            WHEN trim(f.oblast) LIKE '%Крим%' THEN 'Автономна Республіка Крим'
            ELSE REPLACE(REPLACE(trim(f.oblast), ' область', ''), ' обл.', '')
          END AS canon_oblast,
          COUNT(*)::int AS scores_count,
          COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 THEN 1 END)::int AS comments_count,
          COALESCE(AVG(f.score), 7.5)::float AS avg_score,
          COUNT(CASE WHEN f.score >= 9 THEN 1 END)::int AS pos_count,
          COUNT(CASE WHEN f.score <= 6 THEN 1 END)::int AS neg_count
        FROM feedback_e f
        WHERE ${regWhere} AND f.oblast IS NOT NULL AND trim(f.oblast) != ''
        GROUP BY 1
        ORDER BY comments_count DESC;
      `;
      const regRes = await client.query(regSql, regParams);
      const items: RegionMapPoint[] = regRes.rows.map(r => {
        const c = r.scores_count || 0;
        const d = c > 0 ? c : 1;
        const posPct = (r.pos_count / d) * 100;
        const negPct = (r.neg_count / d) * 100;

        const ob = r.canon_oblast;
        const fullName = ob === 'Київ' 
          ? 'м. Київ' 
          : ob === 'Севастополь' 
          ? 'м. Севастополь' 
          : ob === 'Автономна Республіка Крим' 
          ? 'Автономна Республіка Крим' 
          : `${ob} область`;

        return {
          oblast: ob,
          fullName,
          count: c,
          commentsCount: r.comments_count || 0,
          avgScore: Number((r.avg_score || 7.5).toFixed(2)),
          npsBalance: Number((posPct - negPct).toFixed(1))
        };
      });
      return { granularity: 'oblast', items };
    }
  } catch (err) {
    console.error('[getRegionalStatsFromPostgres Error]:', err);
    return { granularity: filters.granularity || 'oblast', items: [] };
  } finally {
    if (client) {
      client.release();
    }
  }
}

function getEmptyDashboardData(): DashboardData {
  return {
    kpis: {
      averageScore: 0,
      averageScorePrev30d: 0,
      averageScoreGrowth30d: 0,
      totalScores: 0,
      totalScores30d: 0,
      totalScoresPrev30d: 0,
      totalScoresGrowth30d: 0,
      fopScores: 0,
      fopScores30d: 0,
      fopScoresPrev30d: 0,
      fopScoresGrowth30d: 0,
      legalScores: 0,
      legalScores30d: 0,
      legalScoresPrev30d: 0,
      legalScoresGrowth30d: 0,
      unknownScores: 0,
      npsScoreBalance: 0,
      npsScoreBalance30d: 0,
      npsScoreBalancePrev30d: 0,
      npsScoreBalanceGrowth30d: 0,
      totalComments: 0,
      comments30d: 0,
      commentsPrev30d: 0,
      commentsGrowth30d: 0
    },
    regionsMap: [],
    hromadaStats: [],
    monthlyScores: [],
    monthlyDistribution: [],
    monthlyComments: [],
    legalFormDistribution: [],
    newSignals: [],
    growingIssues: [],
    decliningIssues: [],
    fullGeneralIssues: [],
    fullDetailedIssues: [],
    sampleComments: [],
    totalSampleCommentsCount: 0,
    dbInfo: {
      connected: false,
      dbUrl: getPOSTGRES_URL_MASKED(),
      mode: 'postgresql',
      totalFeedbackRows: 0,
      lastRefreshed: new Date().toISOString(),
      tables: {
        feedback_e: 0,
        general_issues: 0,
        detailed_issues: 0,
        general_issue_comment: 0,
        detailed_issue_comment: 0,
        regions: 0
      }
    }
  };
}

export async function getDashboardDataFromPostgres(filters: DashboardFilters): Promise<DashboardData> {
  let client: any = null;
  try {
    client = await acquirePgClient();
    // 1. Overall KPIs with Real SQL 30d Comparison
    const kpiParams: any[] = [];
    const kpiWhere = buildWhereClause(filters, kpiParams, 'f');
    const kpiSql = `
      WITH max_d AS (
        SELECT COALESCE(MAX(created_at), NOW()) AS mdate FROM feedback_e f WHERE f.created_at IS NOT NULL
      )
      SELECT 
        COUNT(*)::int AS total_scores,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 THEN 1 END)::int AS total_comments,
        COALESCE(AVG(f.score), 7.5)::float AS avg_score,
        COUNT(CASE WHEN f.score >= 9 THEN 1 END)::int AS pos_count,
        COUNT(CASE WHEN f.score >= 7 AND f.score <= 8 THEN 1 END)::int AS neu_count,
        COUNT(CASE WHEN f.score <= 6 THEN 1 END)::int AS neg_count,
        COUNT(CASE WHEN f.persontype = '2' THEN 1 END)::int AS fop_scores,
        COUNT(CASE WHEN f.persontype = '1' THEN 1 END)::int AS legal_scores,
        COUNT(CASE WHEN f.persontype IS NULL OR f.persontype = '' OR f.persontype = 'unknown' THEN 1 END)::int AS unknown_scores,

        -- Real 30-day period counts vs previous 30-day period counts
        COUNT(CASE WHEN f.created_at >= (m.mdate - INTERVAL '30 days') THEN 1 END)::int AS total_30d,
        COUNT(CASE WHEN f.created_at < (m.mdate - INTERVAL '30 days') AND f.created_at >= (m.mdate - INTERVAL '60 days') THEN 1 END)::int AS total_prev_30d,

        COUNT(CASE WHEN f.persontype = '2' AND f.created_at >= (m.mdate - INTERVAL '30 days') THEN 1 END)::int AS fop_30d,
        COUNT(CASE WHEN f.persontype = '2' AND f.created_at < (m.mdate - INTERVAL '30 days') AND f.created_at >= (m.mdate - INTERVAL '60 days') THEN 1 END)::int AS fop_prev_30d,

        COUNT(CASE WHEN f.persontype = '1' AND f.created_at >= (m.mdate - INTERVAL '30 days') THEN 1 END)::int AS legal_30d,
        COUNT(CASE WHEN f.persontype = '1' AND f.created_at < (m.mdate - INTERVAL '30 days') AND f.created_at >= (m.mdate - INTERVAL '60 days') THEN 1 END)::int AS legal_prev_30d,

        COUNT(CASE WHEN f.score >= 9 AND f.created_at >= (m.mdate - INTERVAL '30 days') THEN 1 END)::int AS pos_30d,
        COUNT(CASE WHEN f.score <= 6 AND f.created_at >= (m.mdate - INTERVAL '30 days') THEN 1 END)::int AS neg_30d,

        COUNT(CASE WHEN f.score >= 9 AND f.created_at < (m.mdate - INTERVAL '30 days') AND f.created_at >= (m.mdate - INTERVAL '60 days') THEN 1 END)::int AS pos_prev_30d,
        COUNT(CASE WHEN f.score <= 6 AND f.created_at < (m.mdate - INTERVAL '30 days') AND f.created_at >= (m.mdate - INTERVAL '60 days') THEN 1 END)::int AS neg_prev_30d,

        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 AND f.created_at >= (m.mdate - INTERVAL '30 days') THEN 1 END)::int AS comm_30d,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 AND f.created_at < (m.mdate - INTERVAL '30 days') AND f.created_at >= (m.mdate - INTERVAL '60 days') THEN 1 END)::int AS comm_prev_30d,

        COALESCE(AVG(CASE WHEN f.created_at >= (m.mdate - INTERVAL '30 days') THEN f.score END), AVG(f.score))::float AS avg_score_30d,
        COALESCE(AVG(CASE WHEN f.created_at < (m.mdate - INTERVAL '30 days') AND f.created_at >= (m.mdate - INTERVAL '60 days') THEN f.score END), AVG(f.score))::float AS avg_score_prev_30d
      FROM feedback_e f
      CROSS JOIN max_d m
      WHERE ${kpiWhere};
    `;
    const kpiRes = await client.query(kpiSql, kpiParams);
    const row = kpiRes.rows[0] || {};

    const totalScores = row.total_scores || 0;
    const totalComments = row.total_comments || 0;
    const averageScore = Number((row.avg_score || 7.5).toFixed(2));
    const posCount = row.pos_count || 0;
    const negCount = row.neg_count || 0;

    const denom = totalScores > 0 ? totalScores : 1;
    const positiveShare = (posCount / denom) * 100;
    const negativeShare = (negCount / denom) * 100;
    const npsScoreBalance = Number((positiveShare - negativeShare).toFixed(1));

    // Real growth calculations
    const totalScores30d = row.total_30d || 0;
    const totalScoresPrev30d = row.total_prev_30d || 0;
    const totalScoresGrowth30d = totalScoresPrev30d > 0 
      ? Number((((totalScores30d - totalScoresPrev30d) / totalScoresPrev30d) * 100).toFixed(1)) 
      : 0;

    const fopScores30d = row.fop_30d || 0;
    const fopScoresPrev30d = row.fop_prev_30d || 0;
    const fopScoresGrowth30d = fopScoresPrev30d > 0
      ? Number((((fopScores30d - fopScoresPrev30d) / fopScoresPrev30d) * 100).toFixed(1))
      : 0;

    const legalScores30d = row.legal_30d || 0;
    const legalScoresPrev30d = row.legal_prev_30d || 0;
    const legalScoresGrowth30d = legalScoresPrev30d > 0
      ? Number((((legalScores30d - legalScoresPrev30d) / legalScoresPrev30d) * 100).toFixed(1))
      : 0;

    const pos30d = row.pos_30d || 0;
    const neg30d = row.neg_30d || 0;
    const posPrev30d = row.pos_prev_30d || 0;
    const negPrev30d = row.neg_prev_30d || 0;

    const nps30d = totalScores30d > 0
      ? Number((((pos30d / totalScores30d) - (neg30d / totalScores30d)) * 100).toFixed(1))
      : npsScoreBalance;

    const npsPrev30d = totalScoresPrev30d > 0
      ? Number((((posPrev30d / totalScoresPrev30d) - (negPrev30d / totalScoresPrev30d)) * 100).toFixed(1))
      : npsScoreBalance;

    const npsScoreBalanceGrowth30d = Number((nps30d - npsPrev30d).toFixed(1));

    const comments30d = row.comm_30d || 0;
    const commentsPrev30d = row.comm_prev_30d || 0;
    const commentsGrowth30d = commentsPrev30d > 0
      ? Number((((comments30d - commentsPrev30d) / commentsPrev30d) * 100).toFixed(1))
      : 0;

    const avgScore30d = Number((row.avg_score_30d || averageScore).toFixed(2));
    const avgScorePrev30d = Number((row.avg_score_prev_30d || averageScore).toFixed(2));
    const avgScoreGrowth30d = Number((avgScore30d - avgScorePrev30d).toFixed(2));

    const kpis: KPIStats = {
      averageScore,
      averageScorePrev30d: avgScorePrev30d,
      averageScoreGrowth30d: avgScoreGrowth30d,
      totalScores,
      totalScores30d,
      totalScoresPrev30d,
      totalScoresGrowth30d,
      fopScores: row.fop_scores || 0,
      fopScores30d,
      fopScoresPrev30d,
      fopScoresGrowth30d,
      legalScores: row.legal_scores || 0,
      legalScores30d,
      legalScoresPrev30d,
      legalScoresGrowth30d,
      unknownScores: row.unknown_scores || 0,
      npsScoreBalance,
      npsScoreBalance30d: nps30d,
      npsScoreBalancePrev30d: npsPrev30d,
      npsScoreBalanceGrowth30d,
      totalComments,
      comments30d,
      commentsPrev30d,
      commentsGrowth30d
    };

    // 2. Regions Map SQL with canonical region grouping
    const regParams: any[] = [];
    const filtersNoRegion = { ...filters, region: 'all' };
    const regWhere = buildWhereClause(filtersNoRegion, regParams, 'f');
    const regSql = `
      SELECT 
        CASE 
          WHEN trim(f.oblast) IN ('Київ', 'м. Київ', 'м.Київ') THEN 'Київ'
          WHEN trim(f.oblast) LIKE 'Київська%' THEN 'Київська'
          WHEN trim(f.oblast) IN ('Севастополь', 'м. Севастополь', 'м.Севастополь') THEN 'Севастополь'
          WHEN trim(f.oblast) LIKE '%Крим%' THEN 'Автономна Республіка Крим'
          ELSE REPLACE(REPLACE(trim(f.oblast), ' область', ''), ' обл.', '')
        END AS canon_oblast,
        COUNT(*)::int AS scores_count,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 THEN 1 END)::int AS comments_count,
        COALESCE(AVG(f.score), 7.5)::float AS avg_score,
        COUNT(CASE WHEN f.score >= 9 THEN 1 END)::int AS pos_count,
        COUNT(CASE WHEN f.score <= 6 THEN 1 END)::int AS neg_count
      FROM feedback_e f
      WHERE ${regWhere} AND f.oblast IS NOT NULL AND trim(f.oblast) != ''
      GROUP BY 1
      ORDER BY comments_count DESC;
    `;
    const regRes = await client.query(regSql, regParams);

    const regionsMap: RegionMapPoint[] = regRes.rows.map(r => {
      const c = r.scores_count || 0;
      const d = c > 0 ? c : 1;
      const posPct = (r.pos_count / d) * 100;
      const negPct = (r.neg_count / d) * 100;

      const ob = r.canon_oblast;
      const fullName = ob === 'Київ' 
        ? 'м. Київ' 
        : ob === 'Севастополь' 
        ? 'м. Севастополь' 
        : ob === 'Автономна Республіка Крим' 
        ? 'Автономна Республіка Крим' 
        : `${ob} область`;

      return {
        oblast: ob,
        fullName,
        count: c,
        commentsCount: r.comments_count || 0,
        avgScore: Number((r.avg_score || 7.5).toFixed(2)),
        npsBalance: Number((posPct - negPct).toFixed(1))
      };
    });

    // 3. Monthly Trends SQL
    const monthParams: any[] = [];
    const monthWhere = buildWhereClause(filters, monthParams, 'f');
    const monthSql = `
      SELECT 
        to_char(f.created_at, 'YYYY-MM') AS month_key,
        COUNT(*)::int AS total_count,
        COALESCE(AVG(f.score), 7.5)::float AS avg_score,
        COUNT(CASE WHEN f.score >= 9 THEN 1 END)::int AS pos_count,
        COUNT(CASE WHEN f.score >= 7 AND f.score <= 8 THEN 1 END)::int AS neu_count,
        COUNT(CASE WHEN f.score <= 6 THEN 1 END)::int AS neg_count,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 THEN 1 END)::int AS comments_count,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 AND f.persontype = '2' THEN 1 END)::int AS fop_comments,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 AND f.persontype = '1' THEN 1 END)::int AS legal_comments
      FROM feedback_e f
      WHERE ${monthWhere} AND f.created_at IS NOT NULL
      GROUP BY 1
      ORDER BY month_key ASC;
    `;
    const monthRes = await client.query(monthSql, monthParams);

    // Fetch full catalog of available months (without month filter)
    const allMonthsParams: any[] = [];
    const filtersNoMonth = { ...filters, month: 'all' };
    const allMonthsWhere = buildWhereClause(filtersNoMonth, allMonthsParams, 'f');
    const allMonthsSql = `
      SELECT 
        to_char(f.created_at, 'YYYY-MM') AS month_key,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 THEN 1 END)::int AS comments_count,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 AND f.persontype = '2' THEN 1 END)::int AS fop_comments,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 AND f.persontype = '1' THEN 1 END)::int AS legal_comments
      FROM feedback_e f
      WHERE ${allMonthsWhere} AND f.created_at IS NOT NULL
      GROUP BY 1
      ORDER BY month_key ASC;
    `;
    const allMonthsRes = (filters.month && filters.month !== 'all')
      ? await client.query(allMonthsSql, allMonthsParams)
      : monthRes;

    // Global timeline of all distinct months in feedback_e
    const globalMonthSql = `
      SELECT DISTINCT to_char(created_at, 'YYYY-MM') AS month_key
      FROM feedback_e
      WHERE created_at IS NOT NULL
      ORDER BY 1 ASC;
    `;
    const globalMonthRes = await client.query(globalMonthSql);
    const globalMonthKeys = globalMonthRes.rows.map(r => r.month_key).filter(Boolean);

    const getContinuousMonthList = (startKey: string, endKey: string): string[] => {
      if (!startKey || !endKey) return [];
      const res: string[] = [];
      const [sy, sm] = startKey.split('-').map(Number);
      const [ey, em] = endKey.split('-').map(Number);
      let cy = sy, cm = sm;
      while (cy < ey || (cy === ey && cm <= em)) {
        res.push(`${cy}-${String(cm).padStart(2, '0')}`);
        cm++;
        if (cm > 12) { cm = 1; cy++; }
      }
      return res;
    };

    let fullTimelineKeys: string[] = [];
    if (globalMonthKeys.length > 0) {
      fullTimelineKeys = getContinuousMonthList(globalMonthKeys[0], globalMonthKeys[globalMonthKeys.length - 1]);
    }

    let activeTimelineKeys: string[] = [];
    if (filters.month && filters.month !== 'all') {
      activeTimelineKeys = monthRes.rows.map(r => r.month_key).filter(Boolean);
    } else {
      activeTimelineKeys = fullTimelineKeys.length > 0 ? fullTimelineKeys : monthRes.rows.map(r => r.month_key).filter(Boolean);
    }

    const monthNamesUa: Record<string, string> = {
      '01': 'Січень', '02': 'Лютий', '03': 'Березень', '04': 'Квітень',
      '05': 'Травень', '06': 'Червень', '07': 'Липень', '08': 'Серпень',
      '09': 'Вересень', '10': 'Жовтень', '11': 'Листопад', '12': 'Грудень'
    };

    const monthlyScores: MonthlyScorePoint[] = [];
    const monthlyDistribution: MonthlyDistributionPoint[] = [];
    const monthlyComments: MonthlyCommentPoint[] = [];

    const monthDataMap = new Map<string, any>();
    monthRes.rows.forEach(m => {
      if (m.month_key) monthDataMap.set(m.month_key, m);
    });

    const allMonthDataMap = new Map<string, any>();
    allMonthsRes.rows.forEach(m => {
      if (m.month_key) allMonthDataMap.set(m.month_key, m);
    });

    activeTimelineKeys.forEach(monthKey => {
      const parts = monthKey.split('-');
      const year = parts[0] || '2024';
      const monthNum = parts[1] || '01';
      const monthShort = `${monthNum}-${year.slice(2)}`;
      const monthFull = `${monthNamesUa[monthNum] || monthNum} ${year}`;

      const m = monthDataMap.get(monthKey);
      const total_count = m ? (m.total_count || 0) : 0;
      const pos_count = m ? (m.pos_count || 0) : 0;
      const neu_count = m ? (m.neu_count || 0) : 0;
      const neg_count = m ? (m.neg_count || 0) : 0;
      const avg_score = m ? (m.avg_score || 0) : 0;
      const comments_count = m ? (m.comments_count || 0) : 0;
      const fop_comments = m ? (m.fop_comments || 0) : 0;
      const legal_comments = m ? (m.legal_comments || 0) : 0;

      const mTotal = total_count > 0 ? total_count : 1;
      const mPosPct = total_count > 0 ? (pos_count / mTotal) * 100 : 0;
      const mNegPct = total_count > 0 ? (neg_count / mTotal) * 100 : 0;
      const npsBal = Number((mPosPct - mNegPct).toFixed(1));

      monthlyScores.push({
        month: monthShort,
        monthFull,
        monthRaw: `${monthKey}-01`,
        avgScore: total_count > 0 ? Number((avg_score || 7.5).toFixed(2)) : 0,
        totalScores: total_count,
        fopScores: fop_comments,
        legalScores: legal_comments,
        npsBalance: npsBal,
        totalComments: comments_count
      });

      monthlyDistribution.push({
        month: monthShort,
        monthRaw: `${monthKey}-01`,
        positiveCount: pos_count,
        neutralCount: neu_count,
        negativeCount: neg_count
      });

      const am = allMonthDataMap.get(monthKey);
      monthlyComments.push({
        month: monthFull,
        monthRaw: `${monthKey}-01`,
        totalComments: am ? (am.comments_count || 0) : 0,
        fopComments: am ? (am.fop_comments || 0) : 0,
        legalComments: am ? (am.legal_comments || 0) : 0
      });
    });

    // 4. Legal Form Distribution SQL
    const ptParams: any[] = [];
    const ptWhere = buildWhereClause(filters, ptParams, 'f');
    const ptSql = `
      SELECT 
        COALESCE(f.persontype, 'unknown') AS pt_code,
        COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 THEN 1 END)::int AS comments_count
      FROM feedback_e f
      WHERE ${ptWhere}
      GROUP BY COALESCE(f.persontype, 'unknown');
    `;
    const ptRes = await client.query(ptSql, ptParams);

    let fopCount = 0;
    let legalCount = 0;
    let unknownCount = 0;

    ptRes.rows.forEach(r => {
      if (r.pt_code === '2') fopCount += r.comments_count;
      else if (r.pt_code === '1') legalCount += r.comments_count;
      else unknownCount += r.comments_count;
    });

    const kpiCommDenom = totalComments > 0 ? totalComments : 1;
    const legalFormDistribution: LegalFormDistributionPoint[] = [
      { persontype: "2", label: "ФОП", count: fopCount, percentage: Number(((fopCount / kpiCommDenom) * 100).toFixed(2)) },
      { persontype: "1", label: "Юридична особа", count: legalCount, percentage: Number(((legalCount / kpiCommDenom) * 100).toFixed(2)) },
    ];
    if (unknownCount > 0 || filters.persontype === 'unknown') {
      legalFormDistribution.push({
        persontype: "unknown",
        label: "Нема даних",
        count: unknownCount,
        percentage: Number(((unknownCount / kpiCommDenom) * 100).toFixed(2))
      });
    }

    // 5. General Issues SQL & Trends (full issue list without issue filter so issue tables stay intact)
    const giParams: any[] = [];
    const filtersNoIssue = { ...filters, generalIssueId: null, detailedIssueId: null, search: null };
    const giWhere = buildWhereClause(filtersNoIssue, giParams, 'f');

    // Denominator for issue share calculation: total comments matching all active filters EXCEPT issue filters
    const denomParams: any[] = [];
    const denomWhere = buildWhereClause(filtersNoIssue, denomParams, 'f');
    const denomSql = `
      SELECT COUNT(CASE WHEN f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 THEN 1 END)::int AS total_comments_no_issue
      FROM feedback_e f
      WHERE ${denomWhere};
    `;
    const denomRes = await client.query(denomSql, denomParams);
    const totalCommentsNoIssue = denomRes.rows[0]?.total_comments_no_issue || 0;
    const commDenom = totalCommentsNoIssue > 0 ? totalCommentsNoIssue : 1;

    let giSearchWhere = 'WHERE g.general_issue_id IS NOT NULL';
    if (filters.search && filters.search.trim().length > 0) {
      const qStr = filters.search.trim();
      const cleanId = parseInt(qStr.replace(/^[\s#№]+/, ''), 10);
      const parsedId = !isNaN(cleanId) ? cleanId : -1;

      const cleanWords = qStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const prefixTsQuery = cleanWords
        .map(w => w.replace(/['":&|!()*\\/]/g, '').trim() + ':*')
        .filter(w => w !== ':*')
        .join(' & ');

      giParams.push(parsedId);
      const idIdx = giParams.length;
      giParams.push(qStr);
      const qIdx = giParams.length;
      giParams.push(prefixTsQuery);
      const pIdx = giParams.length;

      giSearchWhere = `
        WHERE g.general_issue_id IS NOT NULL AND (
          g.general_issue_id = $${idIdx}
          OR g.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx})
          OR g.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $${qIdx})
          OR ($${pIdx} <> '' AND g.search_vector @@ to_tsquery('ukrainian'::regconfig, $${pIdx}))
          OR g.issue_title_ua ILIKE '%' || $${qIdx} || '%'
          OR g.mechanism_ua ILIKE '%' || $${qIdx} || '%'
          OR EXISTS (
            SELECT 1 FROM detailed_issues d_sub 
            WHERE d_sub.parent_id = g.general_issue_id 
              AND (
                d_sub.detailed_issue_id = $${idIdx}
                OR d_sub.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx})
                OR d_sub.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $${qIdx})
                OR ($${pIdx} <> '' AND d_sub.search_vector @@ to_tsquery('ukrainian'::regconfig, $${pIdx}))
                OR d_sub.issue_title_ua ILIKE '%' || $${qIdx} || '%'
                OR d_sub.mechanism_ua ILIKE '%' || $${qIdx} || '%'
              )
          )
        )
      `;
    }

    const giSql = `
      WITH max_d AS (
        SELECT COALESCE(MAX(created_at), NOW()) AS mdate FROM feedback_e WHERE created_at IS NOT NULL
      ),
      unnested AS (
        SELECT 
          unnest(f.general_issue_id)::int AS gid,
          f.created_at,
          m.mdate
        FROM feedback_e f
        CROSS JOIN max_d m
        WHERE ${giWhere} AND f.general_issue_id IS NOT NULL AND array_length(f.general_issue_id, 1) > 0
      )
      SELECT 
        u.gid AS general_issue_id,
        COALESCE(g.issue_title_ua, 'Проблема #' || u.gid::text) AS title,
        COALESCE(g.mechanism_ua, 'Стандартна процедура') AS mechanism,
        g.scope_tags AS scope_tags,
        COUNT(*)::int AS count,
        COUNT(CASE WHEN u.created_at >= (u.mdate - INTERVAL '30 days') THEN 1 END)::int AS cur_30d,
        COUNT(CASE WHEN u.created_at < (u.mdate - INTERVAL '30 days') AND u.created_at >= (u.mdate - INTERVAL '60 days') THEN 1 END)::int AS prev_30d
      FROM unnested u
      LEFT JOIN general_issues g ON u.gid = g.general_issue_id
      ${giSearchWhere}
      GROUP BY u.gid, g.issue_title_ua, g.mechanism_ua, g.scope_tags
      ORDER BY count DESC;
    `;
    const giRes = await client.query(giSql, giParams);

    // Approved Methodology V3 Trend & Rising Signal Calculation
    const trendFilters = {
      month: 'all',
      region: filters.region,
      regions: filters.regions,
      selectedRegion: filters.selectedRegion,
      selectedHromada: filters.selectedHromada,
      selectedHromadaName: filters.selectedHromadaName,
      persontype: filters.persontype,
      scoreCategory: filters.scoreCategory,
      sentiment: filters.sentiment,
      generalIssueId: null,
      detailedIssueId: null,
      search: null
    };

    const tTotalParams: any[] = [];
    const tTotalWhere = buildWhereClause(trendFilters, tTotalParams, 'f');
    let maxMonthCond = '';
    if (filters.month && filters.month !== 'all') {
      const ym = filters.month.substring(0, 7);
      tTotalParams.push(`${ym}%`);
      maxMonthCond = `AND to_char(f.created_at, 'YYYY-MM') <= $${tTotalParams.length}`;
    }

    const tTotalSql = `
      SELECT 
        to_char(f.created_at, 'YYYY-MM') AS month_key,
        COUNT(DISTINCT f.id)::int AS month_comments
      FROM feedback_e f
      WHERE ${tTotalWhere} ${maxMonthCond}
        AND f.created_at IS NOT NULL
        AND char_length(btrim(coalesce(f.processed_comment, ''))) > 0
        AND lower(btrim(coalesce(f.comment_quality::text, ''))) IN ('низька', 'середня', 'висока')
        AND f.created_at < date_trunc('month', CURRENT_DATE)
      GROUP BY 1
      ORDER BY 1 ASC;
    `;
    const tTotalRes = await client.query(tTotalSql, tTotalParams);

    const monthTotalsMap = new Map<string, number>();
    const monthKeysSorted: string[] = [];
    tTotalRes.rows.forEach(r => {
      if (r.month_key) {
        monthTotalsMap.set(r.month_key, r.month_comments || 0);
        monthKeysSorted.push(r.month_key);
      }
    });

    const tIssueParams: any[] = [];
    const tIssueWhere = buildWhereClause(trendFilters, tIssueParams, 'f');
    let maxMonthCondIssue = '';
    if (filters.month && filters.month !== 'all') {
      const ym = filters.month.substring(0, 7);
      tIssueParams.push(`${ym}%`);
      maxMonthCondIssue = `AND to_char(f.created_at, 'YYYY-MM') <= $${tIssueParams.length}`;
    }

    const tIssueSql = `
      WITH eligible_f AS (
        SELECT f.id, to_char(f.created_at, 'YYYY-MM') AS month_key
        FROM feedback_e f
        WHERE ${tIssueWhere} ${maxMonthCondIssue}
          AND f.created_at IS NOT NULL
          AND char_length(btrim(coalesce(f.processed_comment, ''))) > 0
          AND lower(btrim(coalesce(f.comment_quality::text, ''))) IN ('низька', 'середня', 'висока')
          AND f.created_at < date_trunc('month', CURRENT_DATE)
      ),
      general_direct AS (
        SELECT ef.month_key, unnest(f.general_issue_id)::int AS gid, ef.id
        FROM eligible_f ef
        JOIN feedback_e f ON f.id = ef.id
        WHERE f.general_issue_id IS NOT NULL AND array_length(f.general_issue_id, 1) > 0
      ),
      general_via_detailed AS (
        SELECT ef.month_key, d.parent_id AS gid, ef.id
        FROM eligible_f ef
        JOIN feedback_e f ON f.id = ef.id
        JOIN (
          SELECT f2.id, unnest(f2.detailed_issue_id)::int AS did
          FROM feedback_e f2
          WHERE f2.detailed_issue_id IS NOT NULL AND array_length(f2.detailed_issue_id, 1) > 0
        ) u_d ON u_d.id = ef.id
        JOIN detailed_issues d ON d.detailed_issue_id = u_d.did
        WHERE d.parent_id IS NOT NULL
      ),
      combined_general_mentions AS (
        SELECT month_key, gid, id FROM general_direct
        UNION
        SELECT month_key, gid, id FROM general_via_detailed
      )
      SELECT gid AS general_issue_id, month_key, COUNT(DISTINCT id)::int AS mentions
      FROM combined_general_mentions
      WHERE gid IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1, 2 ASC;
    `;
    const tIssueRes = await client.query(tIssueSql, tIssueParams);

    const issueMonthlyMentionsMap = new Map<number, Map<string, number>>();
    tIssueRes.rows.forEach(r => {
      const gid = r.general_issue_id;
      const mk = r.month_key;
      const count = r.mentions || 0;
      if (gid !== null && mk) {
        if (!issueMonthlyMentionsMap.has(gid)) {
          issueMonthlyMentionsMap.set(gid, new Map<string, number>());
        }
        issueMonthlyMentionsMap.get(gid)!.set(mk, count);
      }
    });

    interface CalculatedTrendV3 {
      generalIssueId: number;
      monthsCount: number;
      trendDirection: string;
      trendStrength: string | null;
      trendSlope: number | null;
      delta6: number | null;
      robustNoise: number | null;
      sTrend: number | null;
      risingSignal: string;
      activitySpike?: boolean;
      hasActivitySpike?: boolean;
      sRecent: number | null;
      sigmaB: number | null;
      deltaRecent: number | null;
      sparklineMa: number[];
    }

    const trendAnalysisMap = new Map<number, CalculatedTrendV3>();

    giRes.rows.forEach(g => {
      const gid = g.general_issue_id;
      if (gid === null) return;

      const mentionsMap = issueMonthlyMentionsMap.get(gid) || new Map<string, number>();
      const rawShares: number[] = [];
      const rawMentions: number[] = [];
      const xIndices: number[] = [];

      monthKeysSorted.forEach(mKey => {
        const totalCommentsInMonth = monthTotalsMap.get(mKey) || 0;
        const mentionsInMonth = mentionsMap.get(mKey) || 0;

        const sharePp = totalCommentsInMonth > 0 
          ? (mentionsInMonth / totalCommentsInMonth) * 100 
          : 0;
        rawShares.push(sharePp);
        rawMentions.push(mentionsInMonth);
        xIndices.push(parseMonthKeyToCalendarIndex(mKey));
      });

      // 3-month equal-weight moving average (full 3-month trailing windows only for i >= 2)
      const ma3mShares: number[] = [];
      const xIndicesMA: number[] = [];
      for (let i = 2; i < rawShares.length; i++) {
        const window = rawShares.slice(i - 2, i + 1);
        ma3mShares.push(mathMean(window));
        xIndicesMA.push(xIndices[i]);
      }

      const N = rawShares.length;
      let trendDirection = 'без тренду';
      let trendStrength: string | null = null;
      let trendSlope: number | null = null;
      let delta6: number | null = null;
      let robustNoise: number | null = null;
      let sTrend: number | null = null;

      // Stable Trend: require at least 15 raw monthly shares
      if (N < 15) {
        trendDirection = 'недостатньо даних';
        trendStrength = null;
        trendSlope = null;
      } else {
        const beta = calculateTheilSenSlope(xIndicesMA, ma3mShares);
        const d6 = 6 * beta;
        delta6 = Number(d6.toFixed(4));

        const intercepts = rawShares.map((p, idx) => p - beta * xIndices[idx]);
        const alpha = mathMedian(intercepts);
        const residuals = rawShares.map((p, idx) => p - (alpha + beta * xIndices[idx]));

        const madRes = calculateMAD(residuals);
        robustNoise = Number(madRes.robustNoise.toFixed(4));

        let st = 0;
        if (madRes.robustNoise > 0) {
          st = Math.abs(d6) / madRes.robustNoise;
        } else if (Math.abs(d6) > 0) {
          st = 999;
        }
        sTrend = Number(st.toFixed(3));

        trendSlope = beta;

        if (st < 0.75) {
          trendDirection = 'без тренду';
          trendStrength = null;
        } else {
          trendDirection = beta > 0 ? 'зростаючий' : 'спадаючий';
          if (st >= 1.50) trendStrength = 'сильний';
          else if (st >= 1.00) trendStrength = 'помірний';
          else trendStrength = 'слабкий';
        }
      }

      // General Issue Current Rising Signal
      let risingSignal = 'немає';
      let sRecent: number | null = null;
      let sigmaB: number | null = null;
      let deltaRecent: number | null = null;

      if (N >= 9) {
        const recentShares = rawShares.slice(-3); // T-2, T-1, T
        const baselineShares = rawShares.slice(-9, -3); // T-8..T-3

        const R = mathMean(recentShares);
        const B = mathMedian(baselineShares);
        const dRec = R - B;
        deltaRecent = Number(dRec.toFixed(4));

        const countRecentAboveB = recentShares.filter(p => p > B).length;

        if (dRec >= 0.50 && countRecentAboveB >= 2) {
          const baselineDevs = baselineShares.map(p => p - B);
          const madB = calculateMAD(baselineDevs);
          sigmaB = Number(madB.robustNoise.toFixed(4));

          let sr = 0;
          if (madB.robustNoise > 0) {
            sr = dRec / madB.robustNoise;
          } else {
            sr = 999;
          }
          sRecent = Number(sr.toFixed(3));

          if (sr >= 2.00) risingSignal = 'сильний';
          else if (sr >= 1.50) risingSignal = 'помірний';
          else if (sr >= 1.00) risingSignal = 'слабкий';
          else risingSignal = 'немає';
        }
      }

      // General Issue Activity Spike (V3 Spec)
      const activitySpike = calculateActivitySpikeV3(rawShares, rawMentions, ma3mShares);

      const sparklineMa = ma3mShares.slice(-12).map(v => Number(v.toFixed(2)));

      trendAnalysisMap.set(gid, {
        generalIssueId: gid,
        monthsCount: N,
        trendDirection,
        trendStrength,
        trendSlope,
        delta6,
        robustNoise,
        sTrend,
        risingSignal,
        activitySpike,
        hasActivitySpike: activitySpike,
        sRecent,
        sigmaB,
        deltaRecent,
        sparklineMa
      });
    });

    const fullGeneralIssues: GeneralIssueFullItem[] = giRes.rows
      .filter(g => g.general_issue_id !== null)
      .map(g => {
        const trend = trendAnalysisMap.get(g.general_issue_id) || {
          generalIssueId: g.general_issue_id,
          monthsCount: 0,
          trendDirection: 'без тренду',
          trendStrength: null,
          trendSlope: null,
          delta6: null,
          robustNoise: null,
          sTrend: null,
          risingSignal: 'немає',
          activitySpike: false,
          hasActivitySpike: false,
          sRecent: null,
          sigmaB: null,
          deltaRecent: null,
          sparklineMa: []
        };

        let tags: string[] = [];
        if (Array.isArray(g.scope_tags)) {
          tags = g.scope_tags;
        } else if (typeof g.scope_tags === 'string' && g.scope_tags.trim().length > 0) {
          tags = [g.scope_tags];
        }

        return {
          generalIssueId: g.general_issue_id,
          issueTitle: g.title,
          mechanism: g.mechanism,
          totalMentions: g.count,
          shareRatio: commDenom > 0 ? Number((g.count / commDenom).toFixed(6)) : 0,
          trendDirection: trend.trendDirection,
          trendStrength: trend.trendStrength,
          trendSlope: trend.trendSlope,
          risingSignal: trend.risingSignal,
          activitySpike: Boolean(trend.activitySpike),
          hasActivitySpike: Boolean(trend.activitySpike),
          scopeTags: tags,
          monthsCount: trend.monthsCount,
          delta6: trend.delta6,
          robustNoise: trend.robustNoise,
          sTrend: trend.sTrend,
          sRecent: trend.sRecent,
          sigmaB: trend.sigmaB,
          deltaRecent: trend.deltaRecent
        };
      });

    const trendItems: GeneralIssueTrendItem[] = giRes.rows
      .filter(g => g.general_issue_id !== null)
      .map(g => {
        const cur30 = g.cur_30d || 0;
        const prev30 = g.prev_30d || 0;
        const trend = trendAnalysisMap.get(g.general_issue_id) || {
          generalIssueId: g.general_issue_id,
          monthsCount: 0,
          trendDirection: 'без тренду',
          trendStrength: null,
          trendSlope: null,
          delta6: null,
          robustNoise: null,
          sTrend: null,
          risingSignal: 'немає',
          activitySpike: false,
          hasActivitySpike: false,
          sRecent: null,
          sigmaB: null,
          deltaRecent: null,
          sparklineMa: [0, 0, 0, 0, 0, 0]
        };

        const currentShare = commDenom > 0 ? Number(((g.count / commDenom) * 100).toFixed(2)) : 0;
        const totalShare = commDenom > 0 ? Number(((g.count / commDenom) * 100).toFixed(2)) : 0;

        return {
          generalIssueId: g.general_issue_id,
          issueTitle: g.title,
          mechanism: g.mechanism,
          trendDirection: trend.trendDirection,
          trendStrength: trend.trendStrength,
          trendSlope: trend.trendSlope,
          risingSignal: trend.risingSignal,
          currentMentions: cur30,
          prevMentions: prev30,
          currentShare,
          prevShare: 0,
          shareDiffPp: trend.trendSlope || 0,
          totalMentions: g.count,
          shareRatio: totalShare,
          sparkline: trend.sparklineMa.length > 0 ? trend.sparklineMa : [0, 0, 0, 0, 0, 0],
          monthsCount: trend.monthsCount,
          delta6: trend.delta6,
          robustNoise: trend.robustNoise,
          sTrend: trend.sTrend,
          sRecent: trend.sRecent,
          sigmaB: trend.sigmaB,
          deltaRecent: trend.deltaRecent,
          activitySpike: Boolean(trend.activitySpike),
          hasActivitySpike: Boolean(trend.activitySpike)
        };
      });

    // Growing issues include stable growing trend OR rising signal
    let growingIssues = trendItems
      .filter(t => t.trendDirection === 'зростаючий' || (t.risingSignal && t.risingSignal !== 'немає'))
      .sort((a, b) => {
        const sigScore = (s?: string) => s === 'сильний' ? 3 : s === 'помірний' ? 2 : s === 'слабкий' ? 1 : 0;
        const sDiff = sigScore(b.risingSignal) - sigScore(a.risingSignal);
        if (sDiff !== 0) return sDiff;
        return (b.trendSlope || 0) - (a.trendSlope || 0);
      });

    const decliningIssues = trendItems
      .filter(t => t.trendDirection === 'спадаючий')
      .sort((a, b) => (a.trendSlope || 0) - (b.trendSlope || 0));

    // 6. Detailed Issues & New Signals SQL
    const diParams: any[] = [];
    const diWhere = buildWhereClause(filtersNoIssue, diParams, 'f');

    let diSearchWhere = 'WHERE d.detailed_issue_id IS NOT NULL';
    if (filters.search && filters.search.trim().length > 0) {
      const qStr = filters.search.trim();
      const cleanId = parseInt(qStr.replace(/^[\s#№]+/, ''), 10);
      const parsedId = !isNaN(cleanId) ? cleanId : -1;

      const cleanWords = qStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const prefixTsQuery = cleanWords
        .map(w => w.replace(/['":&|!()*\\/]/g, '').trim() + ':*')
        .filter(w => w !== ':*')
        .join(' & ');

      diParams.push(parsedId);
      const idIdx = diParams.length;
      diParams.push(qStr);
      const qIdx = diParams.length;
      diParams.push(prefixTsQuery);
      const pIdx = diParams.length;

      diSearchWhere = `
        WHERE d.detailed_issue_id IS NOT NULL AND (
          d.detailed_issue_id = $${idIdx}
          OR d.parent_id = $${idIdx}
          OR d.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx})
          OR d.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $${qIdx})
          OR ($${pIdx} <> '' AND d.search_vector @@ to_tsquery('ukrainian'::regconfig, $${pIdx}))
          OR d.issue_title_ua ILIKE '%' || $${qIdx} || '%'
          OR d.mechanism_ua ILIKE '%' || $${qIdx} || '%'
          OR g.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx})
          OR g.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $${qIdx})
          OR ($${pIdx} <> '' AND g.search_vector @@ to_tsquery('ukrainian'::regconfig, $${pIdx}))
          OR g.issue_title_ua ILIKE '%' || $${qIdx} || '%'
        )
      `;
    }

    const diSql = `
      WITH unnested AS (
        SELECT 
          unnest(f.detailed_issue_id)::int AS did,
          f.created_at
        FROM feedback_e f
        WHERE ${diWhere} AND f.detailed_issue_id IS NOT NULL AND array_length(f.detailed_issue_id, 1) > 0
      )
      SELECT 
        u.did AS detailed_issue_id,
        COALESCE(d.parent_id, 1) AS parent_id,
        COALESCE(d.issue_title_ua, 'Детальна проблема #' || u.did::text) AS title,
        COALESCE(g.issue_title_ua, 'Загальна проблема #' || COALESCE(d.parent_id, 1)::text) AS general_title,
        COALESCE(d.mechanism_ua, 'Процедура') AS mechanism,
        COALESCE(d.scope_tags, g.scope_tags) AS scope_tags,
        COUNT(*)::int AS count,
        COALESCE(d.created_at, MIN(u.created_at))::text AS first_seen_at
      FROM unnested u
      LEFT JOIN detailed_issues d ON u.did = d.detailed_issue_id
      LEFT JOIN general_issues g ON d.parent_id = g.general_issue_id
      ${diSearchWhere}
      GROUP BY u.did, d.parent_id, d.issue_title_ua, g.issue_title_ua, d.mechanism_ua, d.scope_tags, g.scope_tags, d.created_at
      ORDER BY count DESC;
    `;
    const diRes = await client.query(diSql, diParams);

    // Detailed Issues monthly mentions query
    const tDetParams: any[] = [];
    const tDetWhere = buildWhereClause(filtersNoIssue, tDetParams, 'f');
    const tDetSql = `
      SELECT 
        u.did AS detailed_issue_id,
        to_char(u.created_at, 'YYYY-MM') AS month_key,
        COUNT(DISTINCT u.id)::int AS mentions
      FROM (
        SELECT 
          f.id,
          unnest(f.detailed_issue_id)::int AS did,
          f.created_at
        FROM feedback_e f
        WHERE ${tDetWhere} 
          AND f.detailed_issue_id IS NOT NULL 
          AND array_length(f.detailed_issue_id, 1) > 0
          AND char_length(btrim(coalesce(f.processed_comment, ''))) > 0
          AND lower(btrim(coalesce(f.comment_quality::text, ''))) IN ('низька', 'середня', 'висока')
          AND f.created_at < date_trunc('month', CURRENT_DATE)
      ) u
      GROUP BY u.did, to_char(u.created_at, 'YYYY-MM');
    `;
    const tDetRes = await client.query(tDetSql, tDetParams);

    const detMonthlyMentionsMap = new Map<number, Map<string, number>>();
    tDetRes.rows.forEach(r => {
      const did = r.detailed_issue_id;
      const mk = r.month_key;
      const count = r.mentions || 0;
      if (did !== null && mk) {
        if (!detMonthlyMentionsMap.has(did)) {
          detMonthlyMentionsMap.set(did, new Map<string, number>());
        }
        detMonthlyMentionsMap.get(did)!.set(mk, count);
      }
    });

    interface CalculatedDetTrendV3 {
      detailedIssueId: number;
      monthsCount: number;
      trendDirection: string;
      trendStrength: string | null;
      trendSlope: number | null;
      delta6: number | null;
      robustNoise: number | null;
      sTrend: number | null;
      risingSignal: string;
      activitySpike?: boolean;
      sparklineMa: number[];
    }

    const detTrendMap = new Map<number, CalculatedDetTrendV3>();

    diRes.rows.forEach(d => {
      const did = d.detailed_issue_id;
      if (did === null) return;

      const mentionsMap = detMonthlyMentionsMap.get(did) || new Map<string, number>();
      const rawShares: number[] = [];
      const rawMentions: number[] = [];
      const xIndices: number[] = [];
      let totalMentionsAllTime = 0;
      let activeMonthsCount = 0;

      monthKeysSorted.forEach(mKey => {
        const totalCommentsInMonth = monthTotalsMap.get(mKey) || 0;
        const mentionsInMonth = mentionsMap.get(mKey) || 0;
        totalMentionsAllTime += mentionsInMonth;
        if (mentionsInMonth > 0) activeMonthsCount++;

        const sharePp = totalCommentsInMonth > 0 
          ? (mentionsInMonth / totalCommentsInMonth) * 100 
          : 0;
        rawShares.push(sharePp);
        rawMentions.push(mentionsInMonth);
        xIndices.push(parseMonthKeyToCalendarIndex(mKey));
      });

      // 3-month equal-weight moving average (full 3-month trailing windows only for i >= 2)
      const ma3mShares: number[] = [];
      const xIndicesMA: number[] = [];
      for (let i = 2; i < rawShares.length; i++) {
        const window = rawShares.slice(i - 2, i + 1);
        ma3mShares.push(mathMean(window));
        xIndicesMA.push(xIndices[i]);
      }

      // Detailed Issue Stable Trend (N >= 15 AND totalMentions >= 20 AND activeMonths >= 8)
      const N = rawShares.length;
      let trendDirection = 'без тренду';
      let trendStrength: string | null = null;
      let trendSlope: number | null = null;
      let delta6: number | null = null;
      let robustNoise: number | null = null;
      let sTrend: number | null = null;

      if (N < 15 || totalMentionsAllTime < 20 || activeMonthsCount < 8) {
        trendDirection = 'недостатньо даних';
        trendStrength = null;
        trendSlope = null;
      } else {
        const beta = calculateTheilSenSlope(xIndicesMA, ma3mShares);
        const d6 = 6 * beta;
        delta6 = Number(d6.toFixed(4));

        const intercepts = rawShares.map((p, idx) => p - beta * xIndices[idx]);
        const alpha = mathMedian(intercepts);
        const residuals = rawShares.map((p, idx) => p - (alpha + beta * xIndices[idx]));

        const madRes = calculateMAD(residuals);
        robustNoise = Number(madRes.robustNoise.toFixed(4));

        let st = 0;
        if (madRes.robustNoise > 0) {
          st = Math.abs(d6) / madRes.robustNoise;
        } else if (Math.abs(d6) > 0) {
          st = 999;
        }
        sTrend = Number(st.toFixed(3));

        trendSlope = beta;

        if (st < 0.75) {
          trendDirection = 'без тренду';
          trendStrength = null;
        } else {
          trendDirection = beta > 0 ? 'зростаючий' : 'спадаючий';
          if (st >= 1.50) trendStrength = 'сильний';
          else if (st >= 1.00) trendStrength = 'помірний';
          else trendStrength = 'слабкий';
        }
      }

      // Detailed Issue Current Rising Signal & Activity Spike (V3 Spec)
      let risingSignal = 'немає';
      let activitySpike = false;

      if (N >= 9) {
        const recentShares = rawShares.slice(-3); // T-2, T-1, T (last 3 complete months)
        const recentMentionsArr = rawMentions.slice(-3);
        const baselineShares = rawShares.slice(-9, -3); // T-8..T-3 (previous 6 complete months)
        const baselineMentionsArr = rawMentions.slice(-9, -3);

        const R = mathMean(recentShares);
        const B = mathMean(baselineShares); // MEAN for detailed issue baseline

        const aRecent = recentMentionsArr.filter(m => m > 0).length;
        const cRecent = recentMentionsArr.reduce((a, b) => a + b, 0);
        const cBaseline = baselineMentionsArr.reduce((a, b) => a + b, 0);

        // Recency gate: at least 1 mention in T-1 or T (last 2 complete months)
        const recencyGate = (recentMentionsArr[1] + recentMentionsArr[2]) >= 1;

        // top2_MA gate: latest 3M MA is among top 2 3M MAs in historical series
        const latestMA = ma3mShares.length > 0 ? ma3mShares[ma3mShares.length - 1] : R;
        const sortedMAs = ma3mShares.length > 0 ? [...ma3mShares].sort((a, b) => a - b) : [R];
        const top2Threshold = sortedMAs.length >= 2 ? sortedMAs[sortedMAs.length - 2] : sortedMAs[0];
        const isTop2MA = ma3mShares.length > 0 ? latestMA >= (top2Threshold - 1e-9) : true;

        // --- Part II-B: Detailed Rising Signal ---
        // Mandatory recurrence gate (Section 27): A_recent >= 2, C_recent >= 3, R > B
        if (aRecent >= 2 && cRecent >= 3 && R > B) {
          if (B > 0) {
            const lift = R / B;
            if (lift >= 3.0 && cRecent >= 4 && isTop2MA) {
              risingSignal = 'сильний';
            } else if (lift >= 2.0 && isTop2MA) {
              risingSignal = 'помірний';
            } else if (lift >= 1.5) {
              risingSignal = 'слабкий';
            } else {
              risingSignal = 'немає';
            }
          } else {
            // Zero baseline activation (Section 31)
            if (cRecent >= 6 && isTop2MA) {
              risingSignal = 'сильний';
            } else if (cRecent >= 4 && isTop2MA) {
              risingSignal = 'помірний';
            } else {
              risingSignal = 'слабкий';
            }
          }
        }

        // --- Part II-C: Separate Activity Spike (Сплеск активності) ---
        // Sections 31A - 31D (V3 Softened Spec)
        activitySpike = calculateActivitySpikeV3(rawShares, rawMentions, ma3mShares);
      }

      const sparklineMa = ma3mShares.slice(-12).map(v => Number(v.toFixed(2)));

      detTrendMap.set(did, {
        detailedIssueId: did,
        monthsCount: N,
        trendDirection,
        trendStrength,
        trendSlope,
        delta6,
        robustNoise,
        sTrend,
        risingSignal,
        activitySpike,
        sparklineMa
      });
    });

    const fullDetailedIssues: DetailedIssueFullItem[] = diRes.rows
      .filter(d => d.detailed_issue_id !== null)
      .map(d => {
        const detTrend = detTrendMap.get(d.detailed_issue_id) || {
          detailedIssueId: d.detailed_issue_id,
          monthsCount: 0,
          trendDirection: 'без тренду',
          trendStrength: null,
          trendSlope: null,
          delta6: null,
          robustNoise: null,
          sTrend: null,
          risingSignal: 'немає',
          activitySpike: false,
          sparklineMa: []
        };

        let tags: string[] = [];
        if (Array.isArray(d.scope_tags)) {
          tags = d.scope_tags;
        } else if (typeof d.scope_tags === 'string' && d.scope_tags.trim().length > 0) {
          tags = [d.scope_tags];
        }

        const activitySpikeVal = Boolean(detTrend.activitySpike);
        return {
          detailedIssueId: d.detailed_issue_id,
          parentGeneralIssueId: d.parent_id || 1,
          generalIssueTitle: d.general_title,
          signalName: `${d.title} | ${d.mechanism}`,
          issueTitle: d.title,
          mechanism: d.mechanism,
          totalMentions: d.count,
          totalAllTime: d.count,
          shareRatio: commDenom > 0 ? Number((d.count / commDenom).toFixed(6)) : 0,
          trendType: detTrend.trendDirection,
          trendPower: detTrend.trendStrength,
          slope: detTrend.trendSlope,
          risingSignal: detTrend.risingSignal,
          activitySpike: activitySpikeVal,
          hasActivitySpike: activitySpikeVal,
          isNewIssue: 'Ні',
          scopeTags: tags,
          monthsCount: detTrend.monthsCount,
          delta6: detTrend.delta6,
          robustNoise: detTrend.robustNoise,
          sTrend: detTrend.sTrend
        };
      });

    const newSignals: NewSignalItem[] = diRes.rows
      .filter(d => Boolean(d.first_seen_at))
      .map(d => {
        let tags: string[] = [];
        if (Array.isArray(d.scope_tags)) {
          tags = d.scope_tags;
        } else if (typeof d.scope_tags === 'string' && d.scope_tags.trim().length > 0) {
          tags = [d.scope_tags];
        }

        const dateFormatted = typeof d.first_seen_at === 'string'
          ? d.first_seen_at.split(' ')[0].split('T')[0]
          : new Date(d.first_seen_at).toISOString().split('T')[0];

        const detTrend = detTrendMap.get(d.detailed_issue_id) || {
          detailedIssueId: d.detailed_issue_id,
          trendDirection: 'без тренду',
          trendStrength: null,
          trendSlope: null,
          risingSignal: 'немає',
          activitySpike: false,
          sparklineMa: []
        };

        return {
          detailedIssueId: d.detailed_issue_id || 1,
          issueTitle: d.title,
          generalIssueTitle: d.general_title,
          mechanism: d.mechanism,
          mentionsCount: d.count,
          isNewIssue: 'Так',
          firstSeenAt: dateFormatted,
          scopeTags: tags,
          trendDirection: detTrend.trendDirection,
          trendStrength: detTrend.trendStrength,
          trendSlope: detTrend.trendSlope,
          risingSignal: detTrend.risingSignal,
          activitySpike: Boolean(detTrend.activitySpike),
          hasActivitySpike: Boolean(detTrend.activitySpike)
        };
      })
      .sort((a, b) => {
        const aHasPriority = a.trendDirection === 'зростаючий' || Boolean(a.activitySpike) || Boolean(a.hasActivitySpike) || (Boolean(a.risingSignal) && a.risingSignal !== 'немає');
        const bHasPriority = b.trendDirection === 'зростаючий' || Boolean(b.activitySpike) || Boolean(b.hasActivitySpike) || (Boolean(b.risingSignal) && b.risingSignal !== 'немає');

        if (aHasPriority !== bHasPriority) {
          return aHasPriority ? -1 : 1;
        }

        return (b.mentionsCount || 0) - (a.mentionsCount || 0);
      });

    // 7. Recent Comments List SQL
    const commParams: any[] = [];
    const commWhere = buildWhereClause(filters, commParams, 'f');
    const commSql = `
      SELECT 
        f.id::text AS id_str,
        COALESCE(f.score, 8)::float AS score,
        f.persontype AS persontype,
        to_char(f.created_at, 'YYYY-MM-DD') AS created_at,
        f.oblast AS oblast,
        f.processed_comment AS processed_comment,
        f.general_issue_id[1]::int AS general_issue_id,
        f.detailed_issue_id[1]::int AS detailed_issue_id,
        g.issue_title_ua AS general_issue_title,
        d.issue_title_ua AS detailed_issue_title
      FROM feedback_e f
      LEFT JOIN general_issues g ON f.general_issue_id[1] = g.general_issue_id
      LEFT JOIN detailed_issues d ON f.detailed_issue_id[1] = d.detailed_issue_id
      WHERE ${commWhere} AND f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0
      ORDER BY f.created_at DESC
      LIMIT 100;
    `;
    const commRes = await client.query(commSql, commParams);

    const sampleComments: FeedbackComment[] = commRes.rows.map((c, idx) => {
      const score = c.score || 8;
      const sentiment = score >= 9 ? 'позитивна' : score <= 6 ? 'негативна' : 'нейтральна';
      const ptLabel = c.persontype === '2' ? 'ФОП' : c.persontype === '1' ? 'Юридична особа' : 'Нема даних';
      const numId = parseInt(c.id_str, 10);

      return {
        id: !isNaN(numId) ? numId : idx + 1,
        score,
        persontype: c.persontype || '2',
        personTypeLabel: ptLabel,
        created_at: c.created_at || new Date().toISOString().split('T')[0],
        oblast: c.oblast || 'Україна',
        comment: c.processed_comment || '',
        processed_comment: c.processed_comment || '',
        comment_quality: 'Висока',
        sentiment,
        general_issue_id: c.general_issue_id,
        general_issue_title: c.general_issue_title,
        detailed_issue_id: c.detailed_issue_id,
        detailed_issue_title: c.detailed_issue_title
      };
    });

    let hromadaStats: HromadaStatItem[] | undefined;
    if (filters.granularity === 'hromada') {
      hromadaStats = await getHromadaStatsFromPostgres(filters, client);
    }

    return {
      kpis,
      monthlyScores,
      monthlyDistribution,
      regionsMap,
      hromadaStats,
      monthlyComments,
      legalFormDistribution,
      newSignals,
      growingIssues,
      decliningIssues,
      fullGeneralIssues,
      fullDetailedIssues,
      sampleComments,
      totalSampleCommentsCount: sampleComments.length,
      dbInfo: {
        connected: true,
        dbUrl: getActiveDbConfig().maskedUrl,
        mode: "postgresql",
        totalFeedbackRows: totalScores,
        lastRefreshed: new Date().toISOString(),
        tables: {
          feedback_e: totalScores,
          general_issues: fullGeneralIssues.length,
          detailed_issues: fullDetailedIssues.length,
          general_issue_comment: 0,
          detailed_issue_comment: 0,
          regions: regionsMap.length
        }
      }
    };
  } catch (err) {
    const formatted = formatPgError(err);
    console.error('[PostgreSQL Query Error]:', formatted);
    const emptyData = getEmptyDashboardData();
    emptyData.dbInfo.lastError = formatted;
    return emptyData;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function getAllCommentsFromPostgres(
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
  let client: any = null;
  try {
    client = await acquirePgClient();
    const params: any[] = [];
    const activePersonType = (personTypeFilter && personTypeFilter !== 'all')
      ? personTypeFilter
      : filters.persontype;

    const effectiveFilters: DashboardFilters = {
      ...filters,
      persontype: activePersonType,
      search: searchQuery ? '' : filters.search
    };

    const baseWhere = buildWhereClause(effectiveFilters, params, 'f');
    const conditions: string[] = [
      baseWhere,
      `(f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0 OR f.comment IS NOT NULL AND length(trim(f.comment)) > 0)`
    ];

    const activeSearch = searchQuery || filters.search || '';
    if (activeSearch && activeSearch.trim().length > 0) {
      const qStr = activeSearch.trim();
      const cleanId = parseInt(qStr.replace(/^[\s#№]+/, ''), 10);
      const parsedId = !isNaN(cleanId) ? cleanId : -1;

      const cleanWords = qStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const prefixTsQuery = cleanWords
        .map(w => w.replace(/['":&|!()*\\/]/g, '').trim() + ':*')
        .filter(w => w !== ':*')
        .join(' & ');

      params.push(parsedId);
      const idIdx = params.length;

      params.push(qStr);
      const qIdx = params.length;

      params.push(prefixTsQuery);
      const pIdx = params.length;

      conditions.push(`(
        f.id = $${idIdx} OR
        f.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx}) OR
        f.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $${qIdx}) OR
        ($${pIdx} <> '' AND f.search_vector @@ to_tsquery('ukrainian'::regconfig, $${pIdx})) OR
        (
          f.search_vector IS NULL AND
          to_tsvector('ukrainian'::regconfig, COALESCE(f.processed_comment, f.comment, '')) @@ websearch_to_tsquery('ukrainian'::regconfig, $${qIdx})
        ) OR
        f.processed_comment ILIKE '%' || $${qIdx} || '%' OR
        f.comment ILIKE '%' || $${qIdx} || '%'
      )`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 1. Total Count Query
    const countSql = `
      SELECT COUNT(*)::int AS total_count
      FROM feedback_e f
      LEFT JOIN general_issues g ON f.general_issue_id[1] = g.general_issue_id
      LEFT JOIN detailed_issues d ON f.detailed_issue_id[1] = d.detailed_issue_id
      ${whereClause};
    `;
    const countRes = await client.query(countSql, params);
    const totalCount = countRes.rows[0]?.total_count || 0;

    // 2. Data Query with Limit & Offset
    const validPage = Math.max(1, page);
    const validPageSize = Math.max(1, Math.min(200, pageSize));
    const offset = (validPage - 1) * validPageSize;

    const dataParams = [...params, validPageSize, offset];
    const dataSql = `
      SELECT 
        f.id::text AS id_str,
        COALESCE(f.score, 8)::float AS score,
        f.persontype AS persontype,
        to_char(f.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        f.oblast AS oblast,
        f.processed_comment AS processed_comment,
        f.comment AS raw_comment,
        f.general_issue_id[1]::int AS general_issue_id,
        f.detailed_issue_id[1]::int AS detailed_issue_id,
        g.issue_title_ua AS general_issue_title,
        d.issue_title_ua AS detailed_issue_title
      FROM feedback_e f
      LEFT JOIN general_issues g ON f.general_issue_id[1] = g.general_issue_id
      LEFT JOIN detailed_issues d ON f.detailed_issue_id[1] = d.detailed_issue_id
      ${whereClause}
      ORDER BY f.created_at DESC NULLS LAST, f.id DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
    `;

    const dataRes = await client.query(dataSql, dataParams);

    const comments: FeedbackComment[] = dataRes.rows.map((c, idx) => {
      const score = c.score || 8;
      const sentiment = score >= 9 ? 'позитивна' : score <= 6 ? 'негативна' : 'нейтральна';
      const ptLabel = c.persontype === '2' ? 'ФОП' : c.persontype === '1' ? 'Юридична особа' : 'Нема даних';
      const numId = parseInt(c.id_str, 10);
      const text = c.processed_comment || c.raw_comment || '';

      return {
        id: !isNaN(numId) ? numId : idx + 1 + offset,
        score,
        persontype: c.persontype || '2',
        personTypeLabel: ptLabel,
        created_at: c.created_at || new Date().toISOString().split('T')[0],
        oblast: c.oblast || 'Україна',
        comment: text,
        processed_comment: text,
        comment_quality: 'Висока',
        sentiment,
        general_issue_id: c.general_issue_id,
        general_issue_title: c.general_issue_title,
        detailed_issue_id: c.detailed_issue_id,
        detailed_issue_title: c.detailed_issue_title
      };
    });

    const totalPages = Math.ceil(totalCount / validPageSize) || 1;

    return {
      comments,
      totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages
    };
  } catch (err) {
    console.error('[getAllCommentsFromPostgres Error]:', err);
    return {
      comments: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function getIssueCommentsFromPostgres(
  type: 'general' | 'detailed',
  issueId: number,
  filters?: DashboardFilters,
  limit?: number
): Promise<FeedbackComment[]> {
  let client: any = null;
  try {
    client = await acquirePgClient();
    const colName = type === 'general' ? 'general_issue_id' : 'detailed_issue_id';
    const queryParams: any[] = [issueId];

    let filterClause = '';
    if (filters) {
      const cleanedFilters = { ...filters, generalIssueId: null, detailedIssueId: null };
      const whereStr = buildWhereClause(cleanedFilters, queryParams, 'f');
      if (whereStr && whereStr !== '1=1') {
        filterClause = ` AND (${whereStr})`;
      }
    }

    let sql = `
      SELECT 
        f.id::text AS id_str,
        COALESCE(f.score, 8)::float AS score,
        f.persontype AS persontype,
        to_char(f.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        f.oblast AS oblast,
        f.katottg_short AS katottg_short,
        f.processed_comment AS processed_comment,
        f.comment AS raw_comment,
        f.general_issue_id[1]::int AS general_issue_id,
        f.detailed_issue_id[1]::int AS detailed_issue_id,
        g.issue_title_ua AS general_issue_title,
        d.issue_title_ua AS detailed_issue_title
      FROM feedback_e f
      LEFT JOIN general_issues g ON f.general_issue_id[1] = g.general_issue_id
      LEFT JOIN detailed_issues d ON f.detailed_issue_id[1] = d.detailed_issue_id
      WHERE $1::int = ANY(f.${colName}) 
        AND (f.processed_comment IS NOT NULL AND length(trim(f.processed_comment)) > 0)
        ${filterClause}
      ORDER BY f.created_at DESC
    `;
    if (limit && limit > 0) {
      sql += ` LIMIT $${queryParams.length + 1}`;
      queryParams.push(limit);
    }
    const res = await client.query(sql, queryParams);

    return res.rows.map((c, idx) => {
      const score = c.score || 8;
      const sentiment = score >= 9 ? 'позитивна' : score <= 6 ? 'негативна' : 'нейтральна';
      const ptLabel = c.persontype === '2' ? 'ФОП' : c.persontype === '1' ? 'Юридична особа' : 'Нема даних';
      const numId = parseInt(c.id_str, 10);
      const text = c.processed_comment || c.raw_comment || '';

      return {
        id: !isNaN(numId) ? numId : idx + 1,
        score,
        persontype: c.persontype || '2',
        personTypeLabel: ptLabel,
        created_at: c.created_at || new Date().toISOString().split('T')[0],
        oblast: c.oblast || 'Україна',
        comment: text,
        processed_comment: text,
        comment_quality: 'Висока',
        sentiment,
        general_issue_id: c.general_issue_id,
        general_issue_title: c.general_issue_title,
        detailed_issue_id: c.detailed_issue_id,
        detailed_issue_title: c.detailed_issue_title
      };
    });
  } catch (err) {
    console.error('[getIssueCommentsFromPostgres Error]:', err);
    return [];
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Dedicated PostgreSQL Full-Text Search function for General & Detailed Issues using 'search_vector' and 'ukrainian' regconfig.
 * Supports searching by numeric issue ID as well.
 */
export async function searchIssuesFromPostgres(
  searchQuery: string,
  limit: number = 100
): Promise<{ generalIssues: GeneralIssueFullItem[]; detailedIssues: DetailedIssueFullItem[] }> {
  let client: any = null;
  try {
    client = await acquirePgClient();
    const qStr = searchQuery.trim();
    if (!qStr) return { generalIssues: [], detailedIssues: [] };

    const cleanId = parseInt(qStr.replace(/^[\s#№]+/, ''), 10);
    const parsedId = !isNaN(cleanId) ? cleanId : -1;

    const cleanWords = qStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const prefixTsQuery = cleanWords
      .map(w => w.replace(/['":&|!()*\\/]/g, '').trim() + ':*')
      .filter(w => w !== ':*')
      .join(' & ');

    const giSql = `
      SELECT 
        g.general_issue_id,
        COALESCE(g.issue_title_ua, 'Проблема #' || g.general_issue_id::text) AS issue_title,
        COALESCE(g.mechanism_ua, 'Стандартна процедура') AS mechanism,
        g.scope_tags
      FROM general_issues g
      WHERE g.general_issue_id = $1
         OR g.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $2)
         OR g.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $2)
         OR ($4 <> '' AND g.search_vector @@ to_tsquery('ukrainian'::regconfig, $4))
         OR g.issue_title_ua ILIKE '%' || $2 || '%'
         OR g.mechanism_ua ILIKE '%' || $2 || '%'
         OR EXISTS (
           SELECT 1 FROM detailed_issues d_sub
           WHERE d_sub.parent_id = g.general_issue_id
             AND (
               d_sub.detailed_issue_id = $1
               OR d_sub.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $2)
               OR d_sub.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $2)
               OR ($4 <> '' AND d_sub.search_vector @@ to_tsquery('ukrainian'::regconfig, $4))
               OR d_sub.issue_title_ua ILIKE '%' || $2 || '%'
               OR d_sub.mechanism_ua ILIKE '%' || $2 || '%'
             )
         )
      ORDER BY g.general_issue_id ASC
      LIMIT $3;
    `;
    const giRes = await client.query(giSql, [parsedId, qStr, limit, prefixTsQuery]);

    const diSql = `
      SELECT 
        d.detailed_issue_id,
        COALESCE(d.parent_id, 1) AS parent_id,
        COALESCE(d.issue_title_ua, 'Детальна проблема #' || d.detailed_issue_id::text) AS issue_title,
        COALESCE(g.issue_title_ua, 'Загальна проблема #' || COALESCE(d.parent_id, 1)::text) AS general_title,
        COALESCE(d.mechanism_ua, 'Процедура') AS mechanism,
        COALESCE(d.scope_tags, g.scope_tags) AS scope_tags
      FROM detailed_issues d
      LEFT JOIN general_issues g ON d.parent_id = g.general_issue_id
      WHERE d.detailed_issue_id = $1
         OR d.parent_id = $1
         OR d.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $2)
         OR d.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $2)
         OR ($4 <> '' AND d.search_vector @@ to_tsquery('ukrainian'::regconfig, $4))
         OR d.issue_title_ua ILIKE '%' || $2 || '%'
         OR d.mechanism_ua ILIKE '%' || $2 || '%'
         OR g.search_vector @@ websearch_to_tsquery('ukrainian'::regconfig, $2)
         OR g.search_vector @@ plainto_tsquery('ukrainian'::regconfig, $2)
         OR ($4 <> '' AND g.search_vector @@ to_tsquery('ukrainian'::regconfig, $4))
         OR g.issue_title_ua ILIKE '%' || $2 || '%'
      ORDER BY d.detailed_issue_id ASC
      LIMIT $3;
    `;
    const diRes = await client.query(diSql, [parsedId, qStr, limit, prefixTsQuery]);

    const generalIssues: GeneralIssueFullItem[] = giRes.rows.map(r => ({
      generalIssueId: r.general_issue_id,
      issueTitle: r.issue_title,
      mechanism: r.mechanism,
      totalMentions: 0,
      shareRatio: 0,
      trendDirection: 'без тренду',
      risingSignal: 'немає',
      scopeTags: Array.isArray(r.scope_tags) ? r.scope_tags : (typeof r.scope_tags === 'string' ? [r.scope_tags] : [])
    }));

    const detailedIssues: DetailedIssueFullItem[] = diRes.rows.map(r => ({
      detailedIssueId: r.detailed_issue_id,
      parentGeneralIssueId: r.parent_id,
      generalIssueTitle: r.general_title,
      signalName: `${r.issue_title} | ${r.mechanism}`,
      issueTitle: r.issue_title,
      mechanism: r.mechanism,
      totalMentions: 0,
      totalAllTime: 0,
      trendType: 'без тренду',
      risingSignal: 'немає',
      isNewIssue: 'Ні',
      scopeTags: Array.isArray(r.scope_tags) ? r.scope_tags : (typeof r.scope_tags === 'string' ? [r.scope_tags] : [])
    }));

    return { generalIssues, detailedIssues };
  } catch (err) {
    console.error('[searchIssuesFromPostgres Error]:', err);
    return { generalIssues: [], detailedIssues: [] };
  } finally {
    if (client) client.release();
  }
}


