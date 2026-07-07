import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toMajorUnits } from '../common/money';
import { Transaction } from '../transactions/transaction.entity';
import { Wallet } from '../wallets/wallet.entity';

export interface OverviewReport {
  totalWallets: number;
  totalBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
}

export interface DailySummaryReport {
  date: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
  activeWallets: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
  ) {}

  /** All-time totals that drive the dashboard cards. */
  async overview(): Promise<OverviewReport> {
    const totalWallets = await this.wallets.count();

    const balanceRow = await this.wallets
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.balanceMinor), 0)', 'sum')
      .getRawOne<{ sum: string }>();

    const credits = await this.sumByType('credit');
    const debits = await this.sumByType('debit');
    const transactionCount = await this.transactions.count();

    return {
      totalWallets,
      totalBalance: toMajorUnits(BigInt(balanceRow?.sum ?? '0')),
      totalCredits: toMajorUnits(credits),
      totalDebits: toMajorUnits(debits),
      transactionCount,
    };
  }

  /** Credits, debits, count and active wallets for a single day. */
  async dailySummary(date?: string): Promise<DailySummaryReport> {
    const day = date ?? new Date().toISOString().slice(0, 10);
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(`${day}T23:59:59.999Z`);

    const rows = await this.transactions
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COALESCE(SUM(t.amountMinor), 0)', 'sum')
      .addSelect('COUNT(*)', 'count')
      .where('t.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('t.type')
      .getRawMany<{ type: string; sum: string; count: string }>();

    let credits = 0n;
    let debits = 0n;
    let transactionCount = 0;
    for (const row of rows) {
      transactionCount += Number(row.count);
      if (row.type === 'credit') {
        credits = BigInt(row.sum);
      } else if (row.type === 'debit') {
        debits = BigInt(row.sum);
      }
    }

    const activeRow = await this.transactions
      .createQueryBuilder('t')
      .select('COUNT(DISTINCT t.walletId)', 'count')
      .where('t.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne<{ count: string }>();

    return {
      date: day,
      totalCredits: toMajorUnits(credits),
      totalDebits: toMajorUnits(debits),
      transactionCount,
      activeWallets: Number(activeRow?.count ?? 0),
    };
  }

  private async sumByType(type: 'credit' | 'debit'): Promise<bigint> {
    const row = await this.transactions
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amountMinor), 0)', 'sum')
      .where('t.type = :type', { type })
      .getRawOne<{ sum: string }>();
    return BigInt(row?.sum ?? '0');
  }
}
