import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'All-time totals for the dashboard' })
  @ApiResponse({ status: 200, description: 'Wallet, balance and transaction totals' })
  overview() {
    return this.reportsService.overview();
  }

  @Get('daily-summary')
  @ApiOperation({ summary: 'Credits, debits and counts for a single day' })
  @ApiResponse({ status: 200, description: 'Summary for the requested (or current) day' })
  dailySummary(@Query() query: DailySummaryQueryDto) {
    return this.reportsService.dailySummary(query.date);
  }
}
