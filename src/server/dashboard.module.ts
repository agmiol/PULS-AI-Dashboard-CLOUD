import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardCacheService } from './dashboard.cache';
import { DatabaseService } from './database/database.service';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardCacheService,
    DatabaseService,
  ],
  exports: [DashboardService, DatabaseService],
})
export class DashboardModule {}
