import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../src/rules/no-direct-getstate-coupling';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

describe('no-direct-getstate-coupling', () => {
  // ┌─────────────────────────────────────────────────────────────────┐
  // │ VALID CASES                                                     │
  // └─────────────────────────────────────────────────────────────────┘
  it('allows self store getState access', () => {
    ruleTester.run('no-direct-getstate-coupling', rule as any, {
      valid: [
        // Self access: store reading its own state is fine
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({
              items: [],
              addItem: (item) => set((state) => ({ items: [...state.items, item] })),
            }));
            const items = useCartStore.getState().items;
          `,
        },
        // Non-Zustand object with getState() - ordinary object
        {
          code: `
            const obj = { getState: () => ({ foo: 1 }) };
            const val = obj.getState().foo;
          `,
        },
        // No store creation at all
        {
          code: `
            const x = { getState: () => 42 };
            x.getState();
          `,
        },
        // Regular function call, not a store
        {
          code: `
            function getState() { return 1; }
            getState();
          `,
        },
        // Store used in React component selector (not getState)
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            function Component() {
              const items = useCartStore((state) => state.items);
              return <div>{items.length}</div>;
            }
          `,
        },
        // Middleware-wrapped store
        {
          code: `
            import { create } from 'zustand';
            import { persist } from 'zustand/middleware';
            const useCartStore = create(persist((set) => ({ items: [] }), { name: 'cart' }));
            const items = useCartStore.getState().items;
          `,
        },
      ],
      invalid: [],
    });
  });

  it('detects cross-store getState access in same file', () => {
    ruleTester.run('no-direct-getstate-coupling', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const useUserStore = create((set) => ({ name: '' }));
            const items = useCartStore.getState().items;
            const name = useUserStore.getState().name;
          `,
          errors: [
            {
              messageId: 'directGetStateCoupling',
            },
            {
              messageId: 'directGetStateCoupling',
            },
          ],
        },
      ],
    });
  });

  it('does not report non-Zustand getState()', () => {
    ruleTester.run('no-direct-getstate-coupling', rule as any, {
      valid: [
        {
          code: `
            const api = { getState: () => ({ status: 'ok' }) };
            const status = api.getState().status;
          `,
        },
      ],
      invalid: [],
    });
  });
});