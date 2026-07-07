import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/transaction.entity';
import { Wallet } from '../wallets/wallet.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Wallet])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
