import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Transaction } from '../transactions/transaction.entity';
import { Wallet } from '../wallets/wallet.entity';
import { WalletOperationInput } from './wallets.types';
import { WalletsService } from './wallets.service';

/**
 * These tests exercise the service with light in-memory fakes instead of a real
 * database, so they run fast and still cover the rules that matter: credit,
 * debit, insufficient funds, and duplicate-referenceId idempotency.
 */
describe('WalletsService', () => {
  let service: WalletsService;
  let walletStore: Wallet;
  let savedTransactions: Transaction[];

  const op = (over: Partial<WalletOperationInput> = {}): WalletOperationInput => ({
    amount: '100.00',
    referenceId: 'ref-1',
    description: 'test',
    ...over,
  });

  // A fake query runner whose manager reads/writes the shared in-memory wallet.
  const buildQueryRunner = () => ({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Wallet) return walletStore;
        return null;
      }),
      create: jest.fn((_entity: unknown, data: Partial<Transaction>) => data as Transaction),
      save: jest.fn(async (entity: Wallet | Transaction) => {
        if ((entity as Transaction).referenceId !== undefined) {
          savedTransactions.push(entity as Transaction);
        }
        return entity;
      }),
    },
  });

  let queryRunner: ReturnType<typeof buildQueryRunner>;

  beforeEach(() => {
    walletStore = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'USD',
      balanceMinor: '1000', // 10.00
      status: 'active',
    } as Wallet;
    savedTransactions = [];
    queryRunner = buildQueryRunner();

    const transactionsRepo = {
      // No existing transaction for this referenceId unless one was saved.
      findOne: jest.fn(
        async ({ where }: any) =>
          savedTransactions.find((t) => t.referenceId === where.referenceId) ?? null,
      ),
    };

    const dataSource = {
      createQueryRunner: () => queryRunner,
    } as unknown as DataSource;

    service = new WalletsService(
      {} as any, // wallets repo (unused in these paths)
      transactionsRepo as any,
      {} as any, // users repo (unused)
      dataSource,
    );
  });

  it('credits a wallet and records before/after balances', async () => {
    const tx = await service.credit('wallet-1', op({ amount: '5.00', referenceId: 'c1' }));

    expect(tx.type).toBe('credit');
    expect(tx.balanceBeforeMinor).toBe('1000');
    expect(tx.balanceAfterMinor).toBe('1500');
    expect(walletStore.balanceMinor).toBe('1500');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('debits a wallet when funds are sufficient', async () => {
    const tx = await service.debit('wallet-1', op({ amount: '4.00', referenceId: 'd1' }));

    expect(tx.type).toBe('debit');
    expect(tx.balanceAfterMinor).toBe('600');
    expect(walletStore.balanceMinor).toBe('600');
  });

  it('rejects a debit that would make the balance negative', async () => {
    await expect(
      service.debit('wallet-1', op({ amount: '50.00', referenceId: 'd2' })),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(walletStore.balanceMinor).toBe('1000'); // unchanged
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('is idempotent: a repeated referenceId is not processed twice', async () => {
    const first = await service.credit('wallet-1', op({ amount: '5.00', referenceId: 'same' }));
    const second = await service.credit('wallet-1', op({ amount: '5.00', referenceId: 'same' }));

    expect(second.id).toBe(first.id);
    expect(walletStore.balanceMinor).toBe('1500'); // only the first credit applied
    expect(savedTransactions).toHaveLength(1);
  });

  it('rejects a reused referenceId that has different parameters', async () => {
    await service.credit('wallet-1', op({ amount: '5.00', referenceId: 'dup' }));

    await expect(
      service.credit('wallet-1', op({ amount: '9.99', referenceId: 'dup' })),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(walletStore.balanceMinor).toBe('1500'); // unchanged by the rejected retry
    expect(savedTransactions).toHaveLength(1);
  });
});
