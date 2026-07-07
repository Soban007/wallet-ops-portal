import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transactions/transaction.entity';
import { User } from './users/user.entity';
import { Wallet } from './wallets/wallet.entity';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', '1234'),
        database: config.get<string>('DB_NAME', 'postgres'),
        entities: [User, Wallet, Transaction],
        // Auto-sync schema for the assessment; a real service would use migrations.
        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
      }),
    }),
    UsersModule,
    WalletsModule,
    ReportsModule,
  ],
})
export class AppModule {}
