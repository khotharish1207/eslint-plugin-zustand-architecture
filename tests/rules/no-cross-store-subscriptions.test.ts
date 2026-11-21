import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../src/rules/no-cross-store-subscriptions';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

describe('no-cross-store-subscriptions', () => {
  it('allows self store subscription', () => {
    ruleTester.run('no-cross-store-subscriptions', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            useCartStore.subscribe((state) => console.log(state.items));
          `,
        },
        {
          code: `
            const obj = { subscribe: () => {} };
            obj.subscribe(() => {});
          `,
        },
        // React component selector (useStore(selector)) is NOT a member expression call,
        // so it won't be flagged as store-to-store subscription.
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
      ],
      invalid: [],
    });
  });

  it('detects cross-store subscribe access in same file', () => {
    ruleTester.run('no-cross-store-subscriptions', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const useUserStore = create((set) => ({ name: '' }));
            useUserStore.subscribe((state) => console.log(state.name));
          `,
          errors: [
            {
              messageId: 'crossStoreSubscriptions',
            },
          ],
        },
      ],
    });
  });

  it('detects cross-store subscribeWithSelector', () => {
    ruleTester.run('no-cross-store-subscriptions', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            import { subscribeWithSelector } from 'zustand/middleware';
            const useCartStore = create(subscribeWithSelector((set) => ({ items: [] })));
            const useUserStore = create((set) => ({ name: '' }));
            useUserStore.subscribeWithSelector(
              (state) => state.name,
              (name) => console.log(name)
            );
          `,
          errors: [
            {
              messageId: 'crossStoreSubscriptions',
            },
          ],
        },
      ],
    });
  });

  it('does not report React component selectors', () => {
    ruleTester.run('no-cross-store-subscriptions', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const useUserStore = create((set) => ({ name: '' }));
            function Component() {
              const items = useCartStore((state) => state.items);
              const name = useUserStore((state) => state.name);
              return <div>{items.length}{name}</div>;
            }
          `,
        },
      ],
      invalid: [],
    });
  });
});