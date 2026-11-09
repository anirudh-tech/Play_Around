import { describe, expect, it } from 'vitest';
import { assertPaymentReference } from './payments';

describe('assertPaymentReference', () => {
  it('allows cash notes and short bank refs', () => {
    expect(() => assertPaymentReference('cash at court')).not.toThrow();
    expect(() => assertPaymentReference('TRX-9921')).not.toThrow();
  });

  it('rejects card-number-shaped strings', () => {
    expect(() => assertPaymentReference('4111111111111111')).toThrow('CARD_LIKE_REFERENCE');
    expect(() => assertPaymentReference('4111 1111 1111 1111')).toThrow('CARD_LIKE_REFERENCE');
  });
});
