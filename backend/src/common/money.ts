/**
 * Money helpers.
 *
 * Balances and amounts are kept as integer "minor units" (e.g. cents) and
 * handled with BigInt so we never run floating point math on money. The API
 * speaks in major units as strings ("100.50"); these helpers convert at the
 * boundary.
 */

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Parse a major-unit amount string ("100.50") into integer minor units (10050n). */
export function toMinorUnits(amount: string): bigint {
  if (!AMOUNT_PATTERN.test(amount)) {
    throw new Error(`Invalid money amount: "${amount}"`);
  }

  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = (fraction + '00').slice(0, 2);
  return BigInt(whole) * 100n + BigInt(paddedFraction);
}

/** Format integer minor units back into a major-unit string ("10050" -> "100.50"). */
export function toMajorUnits(minor: bigint | string): string {
  const value = typeof minor === 'string' ? BigInt(minor) : minor;
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  return `${sign}${whole}.${fraction.toString().padStart(2, '0')}`;
}

export type OperationType = 'credit' | 'debit';

/**
 * Apply a credit/debit to a balance and return the new balance.
 * Throws when a debit would push the balance negative, which keeps the
 * "balance must never become negative" rule in one place.
 */
export function applyOperation(
  currentBalance: bigint,
  type: OperationType,
  amount: bigint,
): bigint {
  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero');
  }

  if (type === 'credit') {
    return currentBalance + amount;
  }

  const next = currentBalance - amount;
  if (next < 0n) {
    throw new Error('Insufficient balance');
  }
  return next;
}
