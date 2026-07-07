import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Shared body for credit and debit. `amount` is a major-unit string and is
 * validated to at most two decimals so it can be parsed to integer cents
 * without touching floats.
 */
export class WalletOperationDto {
  @ApiProperty({ example: '100.50', description: 'Positive amount, up to 2 decimals' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;

  @ApiProperty({
    example: 'txn-2026-06-25-0001',
    description: 'Caller-supplied unique id; repeats are ignored (idempotency)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  referenceId: string;

  @ApiProperty({ example: 'Top-up from bank transfer', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
