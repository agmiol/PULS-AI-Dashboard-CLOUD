# Інструкція з інтеграції та архітектури дашборду для системи "Пульс"

Цей документ описує кроки з переносу кода дашборда в існуючий технологічний стек системи **"Пульс"** (NestJS + TypeORM + PostgreSQL + Angular) та архітектурні рішення для забезпечення високої швидкодії при одночасному навантаженні до **5 000 користувачів**.

---

## Частина 1. Поточна відповідність коду (Refactored Code Structure)

Код дашборду розділено на чіткі модульні шари, що повністю відповідають шаблонам NestJS та сервісно-орієнтованої архітектури:

1. **`src/server/dashboard.cache.ts`** — Сервіс кешування в пам'яті (In-memory TTL Cache + ETag hashing).
2. **`src/server/dashboard.repository.ts`** — Шар паттерну Репозиторій (`IDashboardRepository`). Дозволяє безболісно перемикати джерело даних з Excel / Google Sheets на PostgreSQL TypeORM.
3. **`src/server/dashboard.service.ts`** — Бізнес-логіка агрегацій, крос-фільтрації та підрахунку відфільтрованих коментарів.
4. **`src/server/dashboard.controller.ts`** — NestJS-ready контролер із валідацією DTO, підтримкою ETag (304 Not Modified) та заголовками `Cache-Control`.

---

## Частина 2. Інтеграція в Backend системи Пульс (NestJS + TypeORM + PostgreSQL)

### 1. Модуль NestJS (`DashboardModule`)

Створіть модуль у NestJS проєкті `src/modules/dashboard/`:

```typescript
// src/modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FeedbackEntity } from './entities/feedback.entity';
import { PostgresDashboardRepository } from './repositories/postgres-dashboard.repository';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntity])],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    {
      provide: 'IDashboardRepository',
      useClass: PostgresDashboardRepository, // Заміна GoogleSheets на Postgres в 1 рядок
    },
  ],
})
export class DashboardModule {}
```

### 2. Схема БД та індекси в PostgreSQL (TypeORM)

Для миттєвої крос-фільтрації по мільйонам записів створіть індекси в PostgreSQL:

```sql
-- Таблиця фідбеку
CREATE TABLE pulse_feedback (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    region_id VARCHAR(50) NOT NULL,
    persontype VARCHAR(10) NOT NULL, -- '1' = ЮО, '2' = ФОП, 'unknown'
    score_category VARCHAR(20) NOT NULL, -- 'positive', 'neutral', 'negative'
    score_value INT NOT NULL,
    general_issue_id INT,
    detailed_issue_id INT,
    processed_comment TEXT
);

-- КРИТИЧНО ДЛЯ 5000 КОРИСТУВАЧІВ: Составні індекси для крос-фільтрації
CREATE INDEX idx_pulse_feedback_cross_filter 
ON pulse_feedback (created_at, region_id, persontype, score_category);

CREATE INDEX idx_pulse_feedback_issues 
ON pulse_feedback (general_issue_id, detailed_issue_id);
```

### 3. Запити з використанням Materialized Views (Агрегати)

Щоб PostgreSQL не проводив повнотабличний Scan під час кожного запиту, використовуйте матеріалізовані представлення для місячних та регіональних зрізів:

```sql
CREATE MATERIALIZED VIEW mv_monthly_feedback_stats AS
SELECT 
    TO_CHAR(created_at, 'YYYY-MM') as month_key,
    region_id,
    persontype,
    score_category,
    COUNT(*) as total_count,
    COUNT(CASE WHEN LENGTH(processed_comment) > 0 THEN 1 END) as comments_count,
    AVG(score_value) as avg_score
FROM pulse_feedback
GROUP BY 1, 2, 3, 4;

-- Оновлення раз на годину або по тригеру
CREATE UNIQUE INDEX idx_mv_monthly_stats ON mv_monthly_feedback_stats (month_key, region_id, persontype, score_category);
```

---

## Частина 3. Забезпечення високої продуктивності при 5 000 одночасних користувачів

При 5 000 одночасних активних користувачах (High Concurrency) відвідувачі публічного дашборда переважно **переглядають однакові зрізи даних**.

### Архітектурна схема масштабування:

```
[5,000 Користувачів]
       │
       ▼
 [Nginx Reverse Proxy]  ──(95% запитів: Nginx Microcache < 1 ms)──► [Повертає response]
       │
       ▼ (5% Cache Miss)
 [NestJS Nodes (Cluster / Docker)] ──(Redis Cache < 2 ms)──► [Повертає JSON]
       │
       ▼ (Cache Miss / Refresh)
 [PostgreSQL (Materialized Views & Indexes)]
```

### 1. Nginx Microcaching (Ключ високої швидкості)

Додайте конфігурацію в Nginx проєкту Пульс. Вона віддаватиме зрізи дашборду за **0.5–1 мс**, взагалі не навантажуючи Node.js:

```nginx
# В nginx.conf
proxy_cache_path /var/cache/nginx/pulse_dash levels=1:2 keys_zone=pulse_dash_zone:20m max_size=1g inactive=10m;

server {
    location /api/dashboard/ {
        proxy_pass http://pulse_backend_nestjs:3000;
        
        # Microcaching на 30 секунд для публічного дашборда
        proxy_cache pulse_dash_zone;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        proxy_cache_valid 200 30s;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        
        add_header X-Cache-Status $upstream_cache_status;
        add_header Cache-Control "public, max-age=30, s-maxage=300";
    }
}
```

### 2. Redis Caching у NestJS Backend

У `DashboardService` NestJS використовується Redis:

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class DashboardService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getDashboardData(filters: DashboardFiltersDto) {
    const cacheKey = `pulse:dash:${crypto.createHash('md5').update(JSON.stringify(filters)).digest('hex')}`;
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.repository.calculateAggregates(filters);
    await this.cacheManager.set(cacheKey, data, 60000); // 60s TTL
    return data;
  }
}
```

---

## Частина 4. Інтеграція у Frontend системи Пульс (Angular + SCSS + ngx-echarts)

### 1. Angular Service (`DashboardService`)

```typescript
// src/app/core/services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { debounceTime, switchMap, shareReplay } from 'rxjs/operators';
import { DashboardData, DashboardFilters } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private filters$ = new BehaviorSubject<DashboardFilters>({
    month: 'all',
    region: 'all',
    persontype: 'all',
    scoreCategory: 'all'
  });

  public dashboardData$: Observable<DashboardData>;

  constructor(private http: HttpClient) {
    this.dashboardData$ = this.filters$.pipe(
      debounceTime(200), // Запобігає спаму API при швидких кліках
      switchMap(filters => this.fetchData(filters)),
      shareReplay(1)
    );
  }

  public updateFilter(patch: Partial<DashboardFilters>) {
    this.filters$.next({ ...this.filters$.value, ...patch });
  }

  private fetchData(filters: DashboardFilters): Observable<DashboardData> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== 'all') {
        params = params.set(k, v.toString());
      }
    });
    return this.http.get<DashboardData>('/api/dashboard/data', { params });
  }
}
```

### 2. Angular Component з `ngx-echarts`

```typescript
// src/app/features/dashboard/components/monthly-comments-chart.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-monthly-comments-chart',
  template: `<div echarts [options]="chartOption" (chartClick)="onBarClick($event)" class="h-72 w-full"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyCommentsChartComponent {
  @Input() data!: MonthlyCommentPoint[];
  
  // Конфігурація ECharts переноситься з нашого TypeScript коду без змін
  chartOption: EChartsOption = { ... };

  onBarClick(event: any) {
    // Тригер крос-фільтрації
  }
}
```

---

## План подальшого підключення PostgreSQL

Коли ви будете готові переключитися з Excel/Google Sheets на вашу базу даних PostgreSQL:

1. У backend вам потрібно змінити **лише один провайдер** в NestJS `DashboardModule`:
   Замінити `GoogleSheetsDashboardRepository` на `PostgresDashboardRepository`.
2. Усі правила обчислення, крос-фільтрації, формат відповіді та фронтенд **за залишаються 100% незмінними**, оскільки вони працюють через строгий контракт `DashboardData` DTO.
