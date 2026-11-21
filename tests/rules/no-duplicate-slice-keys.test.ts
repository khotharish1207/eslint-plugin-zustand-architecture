import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../src/rules/no-duplicate-slice-keys';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

describe('no-duplicate-slice-keys', () => {
  it('allows unique slice keys', () => {
    ruleTester.run('no-duplicate-slice-keys', rule as any, {
      valid: [
        {
          code: `
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
          `,
        },
        {
          code: `
            const createAuthSlice = () => ({ user: null });
            const createProfileSlice = () => ({ profile: null });
            const store = create({ ...createAuthSlice(), ...createProfileSlice() });
          `,
        },
        {
          code: `
            const store = create({ a: 1, b: 2 });
          `,
        },
      ],
      invalid: [],
    });
  });

  it('detects duplicate state field keys across slices', () => {
    ruleTester.run('no-duplicate-slice-keys', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            function createAuthSlice() {
              return { user: null, login: () => {} };
            }
            function createUserSlice() {
              return { user: null, settings: {} };
            }
            const store = create({
              ...createAuthSlice(),
              ...createUserSlice(),
            });
          `,
          errors: [{ messageId: 'duplicateSliceKeys' }],
        },
      ],
    });
  });

  it('detects duplicate action keys across slices', () => {
    ruleTester.run('no-duplicate-slice-keys', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            function createAuthSlice() {
              return { login: () => {}, logout: () => {} };
            }
            function createSessionSlice() {
              return { login: () => {}, refresh: () => {} };
            }
            const store = create({
              ...createAuthSlice(),
              ...createSessionSlice(),
            });
          `,
          errors: [{ messageId: 'duplicateSliceKeys' }],
        },
      ],
    });
  });

  it('detects duplicate keys from same slice spread twice', () => {
    ruleTester.run('no-duplicate-slice-keys', rule as any, {
      valid: [],
      invalid: [
        {
          code: `
            function createAuthSlice() {
              return { user: null };
            }
            const store = create({
              ...createAuthSlice(),
              ...createAuthSlice(),
            });
          `,
          errors: [{ messageId: 'duplicateSliceKeys' }],
        },
      ],
    });
  });

  it('allows single slice spread (no duplication possible)', () => {
    ruleTester.run('no-duplicate-slice-keys', rule as any, {
      valid: [
        {
          code: `
            function createAuthSlice() {
              return { user: null };
            }
            const store = create({ ...createAuthSlice() });
          `,
        },
      ],
      invalid: [],
    });
  });
});