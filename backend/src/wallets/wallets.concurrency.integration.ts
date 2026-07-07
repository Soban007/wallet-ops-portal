import { DataSource } from 'typeorm';
import { createTestDataSource } from '../test-utils/test-data-source';
import { User } from '../users/user.entity';
import { Wallet } from './wallet.entity';
import { Transaction } from '../transactions/transaction.entity';
import { WalletsService } from './wallets.service';

/**
 * Unlike wallets.service.spec.ts (fast, in-memory fakes), these tests fire
 * genuinely concurrent requests (Promise.allSettled, not sequential awaits)
 * at a real Postgres instance. That's the only way to actually prove the
 * `pessimistic_write` row lock and the `referenceId` unique constraint hold
 * under a real race, rather than just reasoning about the code.
 *
 * Requires a disposable Postgres reachable via TEST_DB_* env vars — see
 * docker-compose.test.yml and the "Concurrency integration test" section of
 * the README for how to run this.
 */
describe('WalletsService concurrency (real Postgres)', () => {
  let dataSource: DataSource;
  let walletsService: WalletsService;
  let walletId: string;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    walletsService = new WalletsService(
      dataSource.getRepository(Wallet),
      dataSource.getRepository(Transaction),
      dataSource.getRepository(User),
      dataSource,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    const user = await dataSource.getRepository(User).save({
      name: 'Concurrency Test User',
      phone: '+923001234567',
      email: `concurrency-${Date.now()}-${Math.random()}@example.com`,
    });
    const wallet = await walletsService.create({ userId: user.id, currency: 'USD' });
    walletId = wallet.id;
  });

  it('never lets the balance go negative when two debits race for the last funds', async () => {
    await walletsService.credit(walletId, { amount: '100.00', referenceId: 'seed-funds' });

    // Two debits of 70.00 each against a 100.00 balance: only one can win.
    const results = await Promise.allSettled([
      walletsService.debit(walletId, { amount: '70.00', referenceId: 'race-debit-a' }),
      walletsService.debit(walletId, { amount: '70.00', referenceId: 'race-debit-b' }),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const wallet = await walletsService.findOne(walletId);
    expect(wallet.balance).toBe('30.00'); // 100.00 - 70.00, exactly one debit applied
    expect(Number(wallet.balance)).toBeGreaterThanOrEqual(0);
  });

  it('applies a duplicate referenceId exactly once even when both requests race', async () => {
    await walletsService.credit(walletId, { amount: '200.00', referenceId: 'seed-funds-2' });

    const referenceId = 'race-same-reference';
    const results = await Promise.allSettled([
      walletsService.debit(walletId, { amount: '50.00', referenceId }),
      walletsService.debit(walletId, { amount: '50.00', referenceId }),
    ]);

    // Both calls resolve — the loser replays the winner's transaction rather
    // than erroring — and they must describe the exact same transaction row.
    const values = results.map((r) => (r.status === 'fulfilled' ? r.value : undefined));
    expect(values[0]).toBeDefined();
    expect(values[1]).toBeDefined();
    expect(values[0]!.id).toBe(values[1]!.id);

    const wallet = await walletsService.findOne(walletId);
    expect(wallet.balance).toBe('150.00'); // 200.00 - 50.00, debited only once

    const matchingTransactions = await dataSource
      .getRepository(Transaction)
      .find({ where: { referenceId } });
    expect(matchingTransactions).toHaveLength(1);
  });
});
