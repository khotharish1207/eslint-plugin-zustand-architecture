# no-cross-store-subscriptions

## Purpose

Detect store-to-store subscriptions via `subscribe()` and `subscribeWithSelector()`.

## Problem

A store subscribing to another store creates hidden dependency cycles and makes data flow difficult to trace.

## Invalid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({ items: [] }));
const useUserStore = create((set) => ({ name: '' }));

// ❌ Store-to-store subscription
useUserStore.subscribe((state) => console.log(state.name));
```

## Valid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({ items: [] }));

// ✅ React component selector (not a store-to-store subscription)
function Component() {
  const items = useCartStore((state) => state.items);
}
```

## Configuration

No rule-specific configuration.

## Limitations

- Single-file analysis only
- React component selectors (`useStore(selector)`) are not flagged as they are not store-to-store subscriptions

## False Positives

- None expected; React selectors are not member expression calls