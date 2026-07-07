import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../transactions/transaction.entity';

/**
 * Connects to a real, throwaway Postgres for the concurrency integration test.
 * Row locking and unique-constraint races are database behaviour — an
 * in-memory fake can't reproduce "two transactions both try to lock the same
 * row", which is exactly the thing this test needs to prove. Point this at a
 * disposable database via env vars (see docker-compose.test.yml).
 */
export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.TEST_DB_HOST ?? 'localhost',
    port: parseInt(process.env.TEST_DB_PORT ?? '55432', 10),
    username: process.env.TEST_DB_USER ?? 'wallet',
    password: process.env.TEST_DB_PASSWORD ?? 'wallet',
    database: process.env.TEST_DB_NAME ?? 'wallet_ops_test',
    entities: [User, Wallet, Transaction],
    synchronize: true,
    dropSchema: true,
  });
  await dataSource.initialize();
  return dataSource;
}
