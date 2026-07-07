import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wallet } from '../wallets/wallet.entity';

export type TransactionType = 'credit' | 'debit';

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({ type: 'varchar', length: 10 })
  type: TransactionType;

  // All money columns are integer minor units (cents), stored as bigint.
  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ type: 'bigint' })
  balanceBeforeMinor: string;

  @Column({ type: 'bigint' })
  balanceAfterMinor: string;

  // Unique so the same referenceId can never be processed twice (idempotency).
  @Index({ unique: true })
  @Column({ length: 100 })
  referenceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
