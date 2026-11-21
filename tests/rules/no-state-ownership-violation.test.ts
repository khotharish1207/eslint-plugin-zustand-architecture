import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../src/rules/no-state-ownership-violation';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

const ownershipSettings = {
  'zustand-architecture': {
    ownership: {
      cartItems: { owner: 'cart', allowedWriters: ['cart'] },
      userProfile: { owner: 'user', allowedWriters: ['user'] },
    },
  },
};

describe('no-state-ownership-violation', () => {
  it('allows writes to owned fields', () => {
    ruleTester.run('no-state-ownership-violation', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const cart = create((set) => ({ cartItems: [] }));
            cart.setState({ cartItems: ['a'] });
          `,
          settings: ownershipSettings,
        },
        {
          code: `
            import { create } from 'zustand';
            const user = create((set) => ({ userProfile: null }));
            user.setState({ userProfile: { name: 'alice' } });
          `,
          settings: ownershipSettings,
        },
        {
          code: `
            import { create } from 'zustand';
            const cart = create((set) => ({ cartItems: [] }));
            cart.setState((state) => ({ cartItems: [...state.cartItems, 'a'] }));
          `,
          settings: ownershipSettings,
        },
        {
          code: `
            const obj = { setState: () => {} };
            obj.setState({ foo: 1 });
          `,
          settings: ownershipSettings,
        },
        {
          code: `
            import { create } from 'zustand';
            const cart = create((set) => ({ cartItems: [] }));
            cart.setState({ cartItems: ['a'] });
          `,
          // No ownership config — skip all checks
          settings: {},
        },
      ],
      invalid: [],
    });
  });

  it('detects unauthorized writes to owned fields', () => {
    ruleTester.run('no-state-ownership-violation', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ cartItems: [] }));
            const useUserStore = create((set) => ({ userProfile: null }));
            useUserStore.setState({ cartItems: ['a'] });
          `,
          settings: ownershipSettings,
          errors: [
            {
              messageId: 'stateOwnershipViolation',
              data: {
                storeName: 'useUserStore',
                field: 'cartItems',
                owner: 'cart',
                allowedWriters: 'cart',
              },
            },
          ],
        },
      ],
    });
  });

  it('detects ownership violation in updater callback', () => {
    ruleTester.run('no-state-ownership-violation', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ cartItems: [] }));
            const useUserStore = create((set) => ({ userProfile: null }));
            useUserStore.setState((state) => ({ cartItems: ['a'] }));
          `,
          settings: ownershipSettings,
          errors: [
            {
              messageId: 'stateOwnershipViolation',
              data: {
                storeName: 'useUserStore',
                field: 'cartItems',
                owner: 'cart',
                allowedWriters: 'cart',
              },
            },
          ],
        },
      ],
    });
  });

  it('allows writes when store is an allowed writer', () => {
    ruleTester.run('no-state-ownership-violation', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const cart = create((set) => ({ cartItems: [] }));
            const user = create((set) => ({ userProfile: null }));
            // user is an allowed writer for cartItems
            user.setState({ cartItems: ['a'] });
          `,
          settings: {
            'zustand-architecture': {
              ownership: {
                cartItems: { owner: 'cart', allowedWriters: ['cart', 'user'] },
              },
            },
          },
        },
      ],
      invalid: [],
    });
  });

  it('skips fields with no ownership rule', () => {
    ruleTester.run('no-state-ownership-violation', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ cartItems: [], otherField: 1 }));
            const useUserStore = create((set) => ({ userProfile: null }));
            // otherField has no ownership rule — skip
            useUserStore.setState({ otherField: 1 });
          `,
          settings: ownershipSettings,
        },
      ],
      invalid: [],
    });
  });
});