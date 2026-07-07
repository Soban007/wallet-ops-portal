import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { applyOperation, OperationType, toMajorUnits, toMinorUnits } from '../common/money';
import { Transaction } from '../transactions/transaction.entity';
import { User } from '../users/user.entity';
import { Wallet } from './wallet.entity';
import { CreateWalletInput, WalletOperationInput, WalletView } from './wallets.types';

// Postgres error code for a unique-constraint violation.
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateWalletInput): Promise<WalletView> {
    const user = await this.users.findOne({ where: { id: input.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wallet = this.wallets.create({
      userId: input.userId,
      currency: input.currency ?? 'USD',
      balanceMinor: '0',
    });
    const saved = await this.wallets.save(wallet);
    return this.toView(saved);
  }

  async findAll(): Promise<WalletView[]> {
    const wallets = await this.wallets.find({ order: { createdAt: 'DESC' } });
    return wallets.map((wallet) => this.toView(wallet));
  }

  async findOne(id: string): Promise<WalletView> {
    const wallet = await this.getWalletOrFail(id);
    return this.toView(wallet);
  }

  credit(walletId: string, input: WalletOperationInput): Promise<Transaction> {
    return this.execute(walletId, 'credit', input);
  }

  debit(walletId: string, input: WalletOperationInput): Promise<Transaction> {
    return this.execute(walletId, 'debit', input);
  }

  listTransactions(walletId: string): Promise<Transaction[]> {
    return this.getWalletOrFail(walletId).then(() =>
      this.transactions.find({
        where: { walletId },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  /**
   * Core credit/debit routine.
   *
   * Concurrency + idempotency are handled together:
   *  1. A cheap pre-check returns the existing transaction if the referenceId
   *     was already used, so retries are free and never double-charge.
   *  2. The balance update runs inside a DB transaction that locks the wallet
   *     row (SELECT ... FOR UPDATE). Two concurrent debits therefore queue
   *     instead of both reading the same starting balance.
   *  3. The unique constraint on referenceId is the final guard: if two
   *     identical requests race past the pre-check, the second insert fails
   *     with a unique violation and we return the first result instead.
   */
  private async execute(
    walletId: string,
    type: OperationType,
    input: WalletOperationInput,
  ): Promise<Transaction> {
    const amount = toMinorUnits(input.amount);

    const alreadyProcessed = await this.transactions.findOne({
      where: { referenceId: input.referenceId },
    });
    if (alreadyProcessed) {
      return this.reconcileExisting(alreadyProcessed, type, amount);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { id: walletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }
      if (wallet.status !== 'active') {
        throw new BadRequestException('Wallet is not active');
      }

      const before = BigInt(wallet.balanceMinor);
      let after: bigint;
      try {
        after = applyOperation(before, type, amount);
      } catch (err) {
        // Convert the domain error into a clean 400 with a useful message.
        throw new BadRequestException((err as Error).message);
      }

      const transaction = queryRunner.manager.create(Transaction, {
        walletId,
        type,
        amountMinor: amount.toString(),
        balanceBeforeMinor: before.toString(),
        balanceAfterMinor: after.toString(),
        referenceId: input.referenceId,
        description: input.description ?? null,
      });
      await queryRunner.manager.save(transaction);

      wallet.balanceMinor = after.toString();
      await queryRunner.manager.save(wallet);

      await queryRunner.commitTransaction();
      return transaction;
    } catch (err) {
      await queryRunner.rollbackTransaction();

      // Lost the race: another request inserted the same referenceId first.
      if (err instanceof QueryFailedError && (err as { code?: string }).code === UNIQUE_VIOLATION) {
        const existing = await this.transactions.findOne({
          where: { referenceId: input.referenceId },
        });
        if (existing) {
          return this.reconcileExisting(existing, type, amount);
        }
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Decide what to do when a referenceId was already used. A request that
   * matches the stored operation is a genuine retry, so we return the original
   * transaction (idempotent). If the type or amount differ, the same id is being
   * reused for a *different* operation, which we reject instead of silently
   * ignoring the new values.
   */
  private reconcileExisting(
    existing: Transaction,
    type: OperationType,
    amount: bigint,
  ): Transaction {
    if (existing.type === type && BigInt(existing.amountMinor) === amount) {
      return existing;
    }
    throw new ConflictException('referenceId already used for a different operation');
  }

  private async getWalletOrFail(id: string): Promise<Wallet> {
    const wallet = await this.wallets.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  private toView(wallet: Wallet): WalletView {
    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      balance: toMajorUnits(wallet.balanceMinor),
      status: wallet.status,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
