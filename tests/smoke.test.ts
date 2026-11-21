import { describe, expect, it } from 'vitest';
import { plugin } from '../src/index';

describe('plugin smoke test', () => {
  it('exports a plugin object with meta, rules, and configs', () => {
    expect(plugin).toBeDefined();
    expect(plugin.meta.name).toBe('eslint-plugin-zustand-architecture');
    expect(plugin.meta.version).toBe('0.1.0');
    expect(plugin.rules).toBeDefined();
    expect(typeof plugin.rules).toBe('object');
    expect(plugin.configs.recommended).toBeDefined();
    expect(plugin.configs.strict).toBeDefined();
  });
});