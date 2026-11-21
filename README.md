# eslint-plugin-zustand-architecture

ESLint plugin that understands Zustand architecture rather than generic JS dependencies.

Detects cross-store coupling, duplicate slice keys, state ownership violations, and bidirectional store dependencies in Zustand v5 applications.

## Installation

```bash
npm install -D eslint-plugin-zustand-architecture eslint
```

## Usage (flat config, ESLint 9+)

```ts
import zustandArchitecture from 'eslint-plugin-zustand-architecture';

export default [
  zustandArchitecture.configs.recommended,
];
```

## Configs

| Config | Description |
|--------|-------------|
| `recommended` | All 6 rules at `warn` level |
| `strict` | All 6 rules at `error` level |

## Rules

| Rule | Description | Config |
|------|-------------|--------|
| `no-direct-getstate-coupling` | Detects `storeA.getState()` inside another Zustand store | recommended / strict |
| `no-cross-store-writes` | Detects `otherStore.setState(...)` inside another store | recommended / strict |
| `no-cross-store-subscriptions` | Detects `otherStore.subscribe(...)` store-to-store only | recommended / strict |
| `no-duplicate-slice-keys` | Detects duplicate state/action keys during slice composition | recommended / strict |
| `no-state-ownership-violation` | Detects writes to state fields outside declared ownership | recommended / strict |
| `no-bidirectional-store-coupling` | Detects A→B and B→A store dependency cycles | recommended / strict |

### Example: Recommended config

```ts
import zustandArchitecture from 'eslint-plugin-zustand-architecture';

export default [
  zustandArchitecture.configs.recommended,
];
```

### Example: Strict config

```ts
import zustandArchitecture from 'eslint-plugin-zustand-architecture';

export default [
  zustandArchitecture.configs.strict,
];
```

## Configuration (settings)

Configure via ESLint flat config `settings`:

```ts
export default [
  {
    plugins: {
      'zustand-architecture': require('eslint-plugin-zustand-architecture'),
    },
    rules: {
      'zustand-architecture/no-state-ownership-violation': 'warn',
    },
    settings: {
      'zustand-architecture': {
        ownership: {
          cartItems: {
            owner: 'cart',
            allowedWriters: ['cart'],
          },
          userProfile: {
            owner: 'user',
            allowedWriters: ['user', 'profile'],
          },
        },
        allowedDependencies: {
          cart: ['user'],
        },
        analysis: {
          confidenceThreshold: 'medium',
        },
      },
    },
  },
];
```

### Settings reference

| Setting | Type | Description |
|---------|------|-------------|
| `ownership` | `Record<string, { owner: string; allowedWriters?: string[] }>` | State field ownership rules |
| `allowedDependencies` | `Record<string, string[]>` | Allowed cross-store dependencies per store |
| `analysis.confidenceThreshold` | `'low' \| 'medium' \| 'high'` | Minimum confidence for reports |

## Supported Zustand APIs

- `create()`, `createStore()`, `createWithEqualityFn()`
- `StateCreator` pattern
- Middleware: `persist()`, `devtools()`, `immer()`, `subscribeWithSelector()`
- Hook stores and vanilla stores

## Rule Documentation

See `docs/rules/` for per-rule documentation with purpose, problem, invalid/valid examples, configuration, limitations, and false positives.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Typecheck without emitting |
| `npm run lint` | Lint the plugin itself |
| `npm test` | Run Vitest test suite |

## Requirements

- Node.js ≥ 18.18
- ESLint ≥ 9.0.0 (flat config)
- TypeScript (for TypeScript projects)

## License

MIT