import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletOperationDto } from './dto/wallet-operation.dto';
import { WalletsService } from './wallets.service';

@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a wallet for a user' })
  @ApiResponse({ status: 201, description: 'Wallet created' })
  @ApiResponse({ status: 404, description: 'User not found' })
  create(@Body() dto: CreateWalletDto) {
    return this.walletsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all wallets' })
  @ApiResponse({ status: 200, description: 'List of wallets' })
  findAll() {
    return this.walletsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a wallet by id' })
  @ApiResponse({ status: 200, description: 'The wallet' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.walletsService.findOne(id);
  }

  @Post(':id/credit')
  @ApiOperation({ summary: 'Credit a wallet (idempotent by referenceId)' })
  @ApiResponse({ status: 201, description: 'Credit applied, or the existing transaction on retry' })
  @ApiResponse({ status: 400, description: 'Validation error or wallet not active' })
  credit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WalletOperationDto) {
    return this.walletsService.credit(id, dto);
  }

  @Post(':id/debit')
  @ApiOperation({ summary: 'Debit a wallet (idempotent by referenceId)' })
  @ApiResponse({ status: 201, description: 'Debit applied, or the existing transaction on retry' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or validation error' })
  debit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WalletOperationDto) {
    return this.walletsService.debit(id, dto);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'List a wallet’s transactions' })
  @ApiResponse({ status: 200, description: 'Transactions, newest first' })
  transactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.walletsService.listTransactions(id);
  }
}
