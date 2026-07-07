import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class DailySummaryQueryDto {
  @ApiPropertyOptional({
    example: '2026-06-25',
    description: 'Day to report on (YYYY-MM-DD). Defaults to today.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;
}
