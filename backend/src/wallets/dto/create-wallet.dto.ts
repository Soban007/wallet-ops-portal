import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({ example: 'b3f1c8e2-0c2a-4f6e-9a1d-2e5b7c9d0a11' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'USD', enum: ['USD', 'PKR', 'EUR', 'QAR'], required: false })
  @IsOptional()
  @IsString()
  @IsIn(['USD', 'PKR', 'EUR', 'QAR'])
  currency?: string;
}
