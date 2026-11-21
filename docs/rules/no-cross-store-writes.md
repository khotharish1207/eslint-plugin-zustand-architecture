# no-cross-store-writes

## Purpose

Detect cross-store writes via `setState()` inside another Zustand store.

## Problem

Calling `otherStore.setState()` from within a store breaks encapsulation and creates unpredictable state mutation patterns.

## Invalid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({ items: [] }));
const useUserStore = create((set) => ({ name: '' }));

// ❌ Direct cross-store write
useUserStore.setState({ name: 'alice' });
```

## Valid Example

```ts
import { create } from 'zustand';

const useCartStore = create((set) => ({ items: [] }));

// ✅ Self write is fine
useCartStore.setState({ items: ['a'] });
```

## Configuration

No rule-specific configuration.

## Limitations

- Single-file analysis only
- Does not track writes through aliased variables across files

## False Positives

- Non-Zustand objects with `setState()` are ignored