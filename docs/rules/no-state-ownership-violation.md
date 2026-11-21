# no-state-ownership-violation

## Purpose

Detect writes to state fields outside their declared ownership.

## Problem

Without clear ownership boundaries, any store can modify any state field, leading to race conditions and unpredictable state changes.

## Invalid Example

```ts
// Settings:
ownership: {
  cartItems: { owner: 'cart', allowedWriters: ['cart'] },
}

import { create } from 'zustand';

const useCartStore = create((set) => ({ cartItems: [] }));
const useUserStore = create((set) => ({ name: '' }));

// ❌ useUserStore writes to cartItems which is owned by 'cart'
useUserStore.setState({ cartItems: ['a'] });
```

## Valid Example

```ts
// Settings:
ownership: {
  cartItems: { owner: 'cart', allowedWriters: ['cart', 'user'] },
}

import { create } from 'zustand';

const useCartStore = create((set) => ({ cartItems: [] }));
const useUserStore = create((set) => ({ name: '' }));

// ✅ 'user' is an allowed writer for cartItems
useUserStore.setState({ cartItems: ['a'] });
```

## Configuration

Configure via `settings['zustand-architecture'].ownership`:

```ts
settings: {
  'zustand-architecture': {
    ownership: {
      cartItems: {
        owner: 'cart',
        allowedWriters: ['cart'],
      },
    },
  },
},
```

## Limitations

- Single-file analysis only
- Fields without ownership rules are skipped (no uncertain reports)
- Updater callbacks are analyzed when the returned object is statically determinable

## False Positives

- Fields without ownership configuration are not flagged
- Stores listed in `allowedWriters` are permitted