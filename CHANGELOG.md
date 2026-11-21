# Changelog

## 0.1.0 — 2026-11-21

### Added

- **6 ESLint rules** for Zustand architecture analysis:
  - `no-direct-getstate-coupling` — Detect `storeA.getState()` inside another store
  - `no-cross-store-writes` — Detect `otherStore.setState(...)` inside another store
  - `no-cross-store-subscriptions` — Detect `otherStore.subscribe(...)` store-to-store only
  - `no-duplicate-slice-keys` — Detect duplicate state/action keys during slice composition
  - `no-state-ownership-violation` — Detect unauthorized writes based on ownership config
  - `no-bidirectional-store-coupling` — Detect A→B and B→A store dependency cycles
- **Shared analysis engine** (`src/analyzer/`):
  - Store discovery (`create`, `createStore`, `createWithEqualityFn`)
  - Slice discovery
  - Store registry with dependency tracking
  - Dependency graph with bidirectional detection
  - Symbol/import resolution (aliases, re-exports, barrel files)
- **Flat config support** (ESLint 9+)
- **Configs**: `recommended` (warn) and `strict` (error)
- **Settings schema validation** for `ownership`, `allowedDependencies`, `analysis.confidenceThreshold`
- **TypeScript support** with `@typescript-eslint` compatibility
- **Zustand v5** target: `create`, `createStore`, `createWithEqualityFn`, `StateCreator`, middleware patterns
- **Vitest** test suite with RuleTester
- **GitHub Actions CI**

### Changed

- N/A (initial release)

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- N/A

### Security

- N/A