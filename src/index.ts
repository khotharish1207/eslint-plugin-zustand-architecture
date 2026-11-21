import type { Linter } from 'eslint';
import noDirectGetStateCoupling from './rules/no-direct-getstate-coupling';
import noCrossStoreWrites from './rules/no-cross-store-writes';
import noCrossStoreSubscriptions from './rules/no-cross-store-subscriptions';
import noDuplicateSliceKeys from './rules/no-duplicate-slice-keys';
import noStateOwnershipViolation from './rules/no-state-ownership-violation';
import noBidirectionalStoreCoupling from './rules/no-bidirectional-store-coupling';
import {
  zustandArchitectureSettingsSchema,
  validateSettings,
  validateSettingsOrThrow,
} from './configs/schema';

export interface ZustandArchitectureSettings {
  ownership?: Record<string, { owner: string; allowedWriters?: string[] }>;
  allowedDependencies?: Record<string, string[]>;
  analysis?: {
    confidenceThreshold?: 'low' | 'medium' | 'high';
  };
}

export const plugin = {
  meta: {
    name: 'eslint-plugin-zustand-architecture',
    version: '0.1.0',
  },
  rules: {
    'no-direct-getstate-coupling': noDirectGetStateCoupling,
    'no-cross-store-writes': noCrossStoreWrites,
    'no-cross-store-subscriptions': noCrossStoreSubscriptions,
    'no-duplicate-slice-keys': noDuplicateSliceKeys,
    'no-state-ownership-violation': noStateOwnershipViolation,
    'no-bidirectional-store-coupling': noBidirectionalStoreCoupling,
  },
  configs: {
    recommended: {
      plugins: {
        'zustand-architecture': {} as Record<string, unknown>,
      },
      rules: {
        'zustand-architecture/no-direct-getstate-coupling': 'warn',
        'zustand-architecture/no-cross-store-writes': 'warn',
        'zustand-architecture/no-cross-store-subscriptions': 'warn',
        'zustand-architecture/no-duplicate-slice-keys': 'warn',
        'zustand-architecture/no-state-ownership-violation': 'warn',
        'zustand-architecture/no-bidirectional-store-coupling': 'warn',
      },
    } as Linter.Config,
    strict: {
      plugins: {
        'zustand-architecture': {} as Record<string, unknown>,
      },
      rules: {
        'zustand-architecture/no-direct-getstate-coupling': 'error',
        'zustand-architecture/no-cross-store-writes': 'error',
        'zustand-architecture/no-cross-store-subscriptions': 'error',
        'zustand-architecture/no-duplicate-slice-keys': 'error',
        'zustand-architecture/no-state-ownership-violation': 'error',
        'zustand-architecture/no-bidirectional-store-coupling': 'error',
      },
    } as Linter.Config,
  },
} as const;

export default plugin;

/** JSON schema for zustand-architecture settings (draft-07). */
export { zustandArchitectureSettingsSchema };

/** Validate zustand-architecture settings. Returns array of errors (empty = valid). */
export { validateSettings };

/** Validate zustand-architecture settings and throw if invalid. */
export { validateSettingsOrThrow };