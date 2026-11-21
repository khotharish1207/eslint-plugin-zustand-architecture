import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../src/rules/no-bidirectional-store-coupling';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

describe('no-bidirectional-store-coupling', () => {
  it('allows unidirectional coupling (A → B only)', () => {
    ruleTester.run('no-bidirectional-store-coupling', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const useUserStore = create((set) => ({ name: '' }));
            // cartStore reads userStore, but userStore does not read cartStore
            const user = useUserStore.getState().name;
          `,
        },
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const useUserStore = create((set) => ({ name: '' }));
            // Only one store defined
            const items = useCartStore.getState().items;
          `,
        },
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const items = useCartStore.getState().items;
          `,
        },
      ],
      invalid: [],
    });
  });

  it('detects bidirectional coupling (A → B and B → A)', () => {
    ruleTester.run('no-bidirectional-store-coupling', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({
              addItem: (item) => {
                const user = useUserStore.getState().user;
                set((state) => ({ items: [...state.items, item] }));
              },
            }));
            const useUserStore = create((set) => ({
              updateUser: (user) => {
                const cart = useCartStore.getState().items;
                set((state) => ({ name: user.name }));
              },
            }));
          `,
          errors: [{ messageId: 'bidirectionalStoreCoupling' }],
        },
      ],
    });
  });

  it('detects bidirectional coupling via setState', () => {
    ruleTester.run('no-bidirectional-store-coupling', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({
              sync: () => set((state) => ({ items: useUserStore.getState().items })),
            }));
            const useUserStore = create((set) => ({
              sync: () => set((state) => ({ name: useCartStore.getState().name })),
            }));
          `,
          errors: [{ messageId: 'bidirectionalStoreCoupling' }],
        },
      ],
    });
  });

  it('does not flag self-access', () => {
    ruleTester.run('no-bidirectional-store-coupling', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({
              addItem: (item) => set((state) => ({ items: [...state.items, item] })),
            }));
          `,
        },
      ],
      invalid: [],
    });
  });

  it('allows single store with no cross-store access', () => {
    ruleTester.run('no-bidirectional-store-coupling', rule as any, {
      valid: [
        {
          code: `
            import { create } from 'zustand';
            const useCartStore = create((set) => ({ items: [] }));
            const items = useCartStore.getState().items;
          `,
        },
      ],
      invalid: [],
    });
  });
});