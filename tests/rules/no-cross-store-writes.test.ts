import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../src/rules/no-cross-store-writes';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

describe('no-cross-store-writes', () => {
  it('allows self store setState access', () => {
    ruleTester.run('no-cross-store-writes', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({
              items: [],
              addItem: (item) => set((state) => ({ items: [...state.items, item] })),
            }));
            useCartStore.setState({ items: ['a'] });
          `,
        },
        {
          code: `
            const obj = { setState: () => {} };
            obj.setState({ foo: 1 });
          `,
        },
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            useCartStore((state) => state.items);
          `,
        },
      ],
      invalid: [],
    });
  });

  it('detects cross-store setState access in same file', () => {
    ruleTester.run('no-cross-store-writes', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const useUserStore = create((set) => ({ name: '' }));
            useUserStore.setState({ name: 'alice' });
          `,
          errors: [
            {
              messageId: 'crossStoreWrites',
            },
          ],
        },
      ],
    });
  });

  it('does not report non-Zustand setState()', () => {
    ruleTester.run('no-cross-store-writes', rule as any, {
      valid: [
        {
          code: `
            const api = { setState: () => {} };
            api.setState({ foo: 1 });
          `,
        },
      ],
      invalid: [],
    });
  });

  it('detects updater callback cross-store write', () => {
    ruleTester.run('no-cross-store-writes', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const useUserStore = create((set) => ({ name: '' }));
            useUserStore.setState((state) => ({ name: state.name + '!' }));
          `,
          errors: [
            {
              messageId: 'crossStoreWrites',
            },
          ],
        },
      ],
    });
  });
});