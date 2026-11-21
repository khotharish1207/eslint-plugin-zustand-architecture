# no-direct-getstate-coupling

## Purpose

Detect direct cross-store state access via `getState()` inside another Zustand store.

## Problem

Calling `storeA.getState()` inside another store creates tight coupling between stores, making the architecture fragile and hard to maintain. Stores should communicate through selectors or derived stores, not direct state access.

## Invalid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({ items: [] }));
const useUserStore = create((set) => ({ name: '' }));

// ❌ Direct cross-store read
const items = useCartStore.getState().items;
```

## Valid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({ items: [] }));
const useUserStore = create((set) => ({ name: '' }));

// ✅ Self-access is fine
const items = useCartStore.getState().items;

// ✅ React component selector (not getState)
function Component() {
  const items = useCartStore((state) => state.items);
}
```

## Configuration

No rule-specific configuration. Uses the global `zustand-architecture` settings for confidence threshold.

## Limitations

- Single-file analysis only; imported stores from other files are not resolved
- Only detects direct `getState()` member calls, not indirect access patterns

## False Positives

- None expected; self-access is excluded, and non-Zustand objects with `getState()` are ignored