import { describe, expect, it } from 'vitest';
import { validateSettings, validateSettingsOrThrow } from '../../src/configs/schema';

describe('validateSettings', () => {
  it('accepts valid settings', () => {
    const validSettings = [
      {},
      { ownership: {} },
      { ownership: { cartItems: { owner: 'cart' } } },
      {
        ownership: {
          cartItems: { owner: 'cart', allowedWriters: ['cart', 'user'] },
          userProfile: { owner: 'user' },
        },
      },
      { allowedDependencies: { cart: ['user'] } },
      { analysis: { confidenceThreshold: 'high' } },
      { analysis: { confidenceThreshold: 'medium' } },
      { analysis: { confidenceThreshold: 'low' } },
    ];

    for (const settings of validSettings) {
      const errors = validateSettings(settings);
      expect(errors).toEqual([]);
    }
  });

  it('rejects non-object settings', () => {
    const invalidSettings: unknown[] = [null, undefined, 'string', 42, true, []];

    for (const settings of invalidSettings) {
      const errors = validateSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.path).toBe('');
    }
  });

  it('rejects invalid ownership', () => {
    const errors = validateSettings({
      ownership: 'not-an-object',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('ownership');
  });

  it('rejects ownership rule without owner', () => {
    const errors = validateSettings({
      ownership: {
        cartItems: { allowedWriters: ['cart'] },
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('ownership.cartItems.owner');
  });

  it('rejects ownership with non-string owner', () => {
    const errors = validateSettings({
      ownership: {
        cartItems: { owner: 42 },
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('ownership.cartItems.owner');
  });

  it('rejects allowedWriters not being an array', () => {
    const errors = validateSettings({
      ownership: {
        cartItems: { owner: 'cart', allowedWriters: 'cart' },
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('ownership.cartItems.allowedWriters');
  });

  it('rejects allowedWriters with non-string items', () => {
    const errors = validateSettings({
      ownership: {
        cartItems: { owner: 'cart', allowedWriters: ['cart', 42] },
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('ownership.cartItems.allowedWriters[1]');
  });

  it('rejects invalid allowedDependencies', () => {
    const errors = validateSettings({
      allowedDependencies: 'not-an-object',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('allowedDependencies');
  });

  it('rejects allowedDependencies with non-array values', () => {
    const errors = validateSettings({
      allowedDependencies: {
        cart: 'not-an-array',
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('allowedDependencies.cart');
  });

  it('rejects invalid confidenceThreshold', () => {
    const errors = validateSettings({
      analysis: { confidenceThreshold: 'invalid' },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.path).toBe('analysis.confidenceThreshold');
  });

  it('collects multiple errors', () => {
    const errors = validateSettings({
      ownership: 'bad',
      allowedDependencies: 'bad',
      analysis: { confidenceThreshold: 'bad' },
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateSettingsOrThrow', () => {
  it('does not throw for valid settings', () => {
    expect(() => validateSettingsOrThrow({})).not.toThrow();
    expect(() =>
      validateSettingsOrThrow({
        ownership: { cartItems: { owner: 'cart' } },
      }),
    ).not.toThrow();
  });

  it('throws with helpful message for invalid settings', () => {
    expect(() => validateSettingsOrThrow('not-an-object')).toThrow(
      /Invalid eslint-plugin-zustand-architecture settings/,
    );
    expect(() =>
      validateSettingsOrThrow({
        ownership: { cartItems: { owner: 42 } },
      }),
    ).toThrow(/ownership\.cartItems\.owner/);
  });
});