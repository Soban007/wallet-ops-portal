// Domain input/output shapes for the wallets service. Kept separate from the
// request DTOs so the service isn't coupled to the controller layer.

export interface CreateWalletInput {
  userId: string;
  currency?: string;
}

export interface WalletOperationInput {
  amount: string;
  referenceId: string;
  description?: string;
}

/** Wallet shape returned to clients, with the balance as a major-unit string. */
export interface WalletView {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
