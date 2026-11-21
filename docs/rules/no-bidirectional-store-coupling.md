# no-bidirectional-store-coupling

## Purpose

Detect bidirectional coupling between Zustand stores (A→B and B→A).

## Problem

Bidirectional dependencies create cycles that make the architecture difficult to understand, test, and maintain.

## Invalid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({
  addItem: (item) => {
    const user = useUserStore.getState().user; // cart → user
    set((state) => ({ items: [...state.items, item] }));
  },
}));
const useUserStore = create((set) => ({
  updateUser: (user) => {
    const cart = useCartStore.getState().items; // user → cart
    set((state) => ({ name: user.name }));
  },
}));

// ❌ Bidirectional: cart ↔ user
```

## Valid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({ items: [] }));
const useUserStore = create((set) => ({ name: '' }));

// ✅ Unidirectional only
const items = useCartStore.getState().items;
```

## Configuration

No rule-specific configuration.

## Limitations

- Single-file analysis only; cross-file bidirectional coupling is not detected
- Only detects dependencies through `getState()`, `setState()`, `subscribe()`, and `subscribeWithSelector()` calls

## False Positives

- Self-access is not flagged
- Single-store files are not flagged