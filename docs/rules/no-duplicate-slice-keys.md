# no-duplicate-slice-keys

## Purpose

Detect duplicate state/action keys during slice composition.

## Problem

When composing slices with spread operators, duplicate keys cause later slices to silently overwrite earlier ones, leading to bugs that are hard to debug.

## Invalid Example

```ts
import { create } from 'zustand';

function createAuthSlice() {
  return { user: null, login: () => {} };
}
function createUserSlice() {
  return { user: null, settings: {} }; // ❌ duplicate 'user' key
}

const store = create({
  ...createAuthSlice(),
  ...createUserSlice(),
});
```

## Valid Example

```ts
import { create } from 'zustand';

function createAuthSlice() {
  return { user: null, login: () => {} };
}
function createProfileSlice() {
  return { profile: null, updateProfile: () => {} };
}

const store = create({
  ...createAuthSlice(),
  ...createProfileSlice(),
});
```

## Configuration

No rule-specific configuration.

## Limitations

- Only detects duplicate keys from statically analyzable slice functions
- Does not detect duplicates from dynamic or computed keys

## False Positives

- Single slice spread (no duplication possible) is not flagged