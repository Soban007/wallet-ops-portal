import { applyOperation, toMajorUnits, toMinorUnits } from './money';

describe('money helpers', () => {
  describe('toMinorUnits', () => {
    it('parses whole and fractional amounts without floating point', () => {
      expect(toMinorUnits('100').toString()).toBe('10000');
      expect(toMinorUnits('100.5').toString()).toBe('10050');
      expect(toMinorUnits('0.01').toString()).toBe('1');
    });

    it('rejects badly formatted amounts', () => {
      expect(() => toMinorUnits('10.999')).toThrow();
      expect(() => toMinorUnits('abc')).toThrow();
      expect(() => toMinorUnits('-5')).toThrow();
    });
  });

  describe('toMajorUnits', () => {
    it('formats minor units back to two decimals', () => {
      expect(toMajorUnits('10050')).toBe('100.50');
      expect(toMajorUnits('1')).toBe('0.01');
      expect(toMajorUnits(0n)).toBe('0.00');
    });
  });

  describe('applyOperation', () => {
    it('adds on credit and subtracts on debit', () => {
      expect(applyOperation(1000n, 'credit', 500n)).toBe(1500n);
      expect(applyOperation(1000n, 'debit', 400n)).toBe(600n);
    });

    it('never lets a debit go negative', () => {
      expect(() => applyOperation(300n, 'debit', 500n)).toThrow('Insufficient balance');
    });

    it('rejects non-positive amounts', () => {
      expect(() => applyOperation(1000n, 'credit', 0n)).toThrow();
    });
  });
});
