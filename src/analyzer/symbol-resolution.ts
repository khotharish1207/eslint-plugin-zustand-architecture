import type {
  ImportBinding,
  StoreResolution,
} from '../types';
import {
  EsImportDeclaration,
  EsImportDefaultSpecifier,
  EsImportNamespaceSpecifier,
  EsImportSpecifier,
  EsExportNamedDeclaration,
  EsExportAllDeclaration,
} from '../utils/ast';

const MAX_REEXPORT_DEPTH = 5;

/**
 * Resolves local identifiers to known Zustand stores.
 *
 * Handles:
 *   - plain imports: `import { cartStore } from './cart'`
 *   - aliases: `import { cartStore as cs } from './cart'`
 *   - default imports: `import store from './store'`
 *   - namespace imports: `import * as store from './store'`
 *   - re-exports / barrel files: `export { cartStore } from './cart'`
 *   - cross-file chains up to MAX_REEXPORT_DEPTH
 */
export class SymbolResolver {
  // (sourceModule, importedName) -> storeId
  private importMap = new Map<string, string>();
  // (filePath, localName) -> storeId  (stores defined in that file)
  private localDefMap = new Map<string, string>();
  // (filePath, localName) -> { source, importedName }  (re-export bindings)
  private reExportMap = new Map<string, { source: string; importedName: string }>();

  /** Register that `localName` in `filePath` is a store definition. */
  recordStoreDefinition(filePath: string, localName: string, storeId: string): void {
    this.localDefMap.set(`${filePath}::${localName}`, storeId);
  }

  /** Register an import binding so future resolutions can map it to a store. */
  recordImportBinding(filePath: string, binding: ImportBinding, storeId: string): void {
    if (!binding.source) return;
    const key = `${binding.source}::${binding.importedName ?? 'default'}`;
    this.importMap.set(key, storeId);
    this.localDefMap.set(`${filePath}::${binding.localName}`, storeId);
  }

  /** Register a re-export (barrel) binding. */
  recordReExport(filePath: string, localName: string, source: string, importedName: string): void {
    this.reExportMap.set(`${filePath}::${localName}`, { source, importedName });
  }
  /**
   * Resolve a local identifier used in `filePath` to a store.
   * Returns null when the identifier cannot be confidently resolved.
   */
  resolve(filePath: string, localName: string): StoreResolution | null {
    // 1. Direct store defined in this file.
    const direct = this.localDefMap.get(`${filePath}::${localName}`);
    if (direct) {
      return { storeId: direct, storeName: localName, confidence: 'high', via: 'direct' };
    }

    // 2. Re-export / barrel: this file re-exports `localName` from another module.
    const reExport = this.reExportMap.get(`${filePath}::${localName}`);
    if (reExport) {
      return this.resolveViaModule(reExport.source, reExport.importedName, filePath, 're-export', 0);
    }

    return null;
  }

  /**
   * Resolve an identifier by looking up which store a module exports under a
   * given name. Used for cross-file and barrel resolution.
   */
  private resolveViaModule(
    source: string,
    importedName: string,
    originatingFile: string,
    via: StoreResolution['via'],
    depth: number,
  ): StoreResolution | null {
    if (depth >= MAX_REEXPORT_DEPTH) {
      return null;
    }
    const key = `${source}::${importedName}`;
    const storeId = this.importMap.get(key);
    if (storeId) {
      return {
        storeId,
        storeName: importedName,
        confidence: 'high',
        via,
      };
    }
    const reExport = this.reExportMap.get(`${source}::${importedName}`);
    if (reExport) {
      return this.resolveViaModule(reExport.source, reExport.importedName, originatingFile, 'barrel', depth + 1);
    }
    return null;
  }

  /** Extract ImportBinding records from an ImportDeclaration node. */
  extractImportBindings(node: EsImportDeclaration): ImportBinding[] {
    const source = node.source.value;
    const bindings: ImportBinding[] = [];
    for (const spec of node.specifiers) {
      if (spec.type === 'ImportSpecifier') {
        bindings.push({
          localName: spec.local.name,
          importedName: spec.imported.name,
          source,
          isAlias: spec.local.name !== spec.imported.name,
          isDefault: false,
          isNamespace: false,
          isReExport: false,
        });
      } else if (spec.type === 'ImportDefaultSpecifier') {
        bindings.push({
          localName: spec.local.name,
          importedName: undefined,
          source,
          isAlias: false,
          isDefault: true,
          isNamespace: false,
          isReExport: false,
        });
      } else if (spec.type === 'ImportNamespaceSpecifier') {
        bindings.push({
          localName: spec.local.name,
          importedName: undefined,
          source,
          isAlias: false,
          isDefault: false,
          isNamespace: true,
          isReExport: false,
        });
      }
    }
    return bindings;
  }

  /** Extract re-export bindings from export declarations. */
  extractReExports(
    filePath: string,
    nodes: (EsExportNamedDeclaration | EsExportAllDeclaration)[],
  ): { localName: string; source: string; importedName: string }[] {
    const results: { localName: string; source: string; importedName: string }[] = [];
    for (const node of nodes) {
      if (node.type === 'ExportNamedDeclaration' && node.source) {
        const source = node.source.value;
        for (const spec of node.specifiers) {
          if (spec.type === 'ExportSpecifier') {
            results.push({
              localName: spec.local.name,
              source,
              importedName: spec.exported.name,
            });
            this.recordReExport(filePath, spec.local.name, source, spec.exported.name);
          }
        }
      } else if (node.type === 'ExportAllDeclaration') {
        results.push({
          localName: '*',
          source: node.source.value,
          importedName: '*',
        });
        this.recordReExport(filePath, '*', node.source.value, '*');
      }
    }
    return results;
  }

  /**
   * Resolve a relative import specifier against an importing file path.
   * Supports ./ and ../ segments.
   */
  resolveSpecifier(importingFile: string, specifier: string): string {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      return specifier;
    }
    const dirParts = importingFile.split('/').slice(0, -1);
    const specParts = specifier.split('/');
    const parts = [...dirParts];
    for (const p of specParts) {
      if (p === '..') {
        if (parts.length > 0) parts.pop();
      } else if (p === '.' || p === '') {
        continue;
      } else {
        parts.push(p);
      }
    }
    return parts.join('/');
  }

  /**
   * Follow re-export chains to resolve an imported name to a storeId.
   * `source` should already be resolved to an absolute path (extension optional).
   * Returns undefined when the chain cannot be resolved confidently.
   */
  resolveViaReExports(source: string, importedName: string, depth = 0): string | undefined {
    if (depth >= MAX_REEXPORT_DEPTH) {
      return undefined;
    }
    // Try both bare and .ts filePath forms for local-def and re-export lookups.
    for (const fp of [source, `${source}.ts`]) {
      const direct = this.localDefMap.get(`${fp}::${importedName}`);
      if (direct) {
        return direct;
      }
      const reExport = this.reExportMap.get(`${fp}::${importedName}`);
      if (reExport) {
        const resolved = this.resolveSpecifier(fp, reExport.source);
        const deeper = this.resolveViaReExports(resolved, reExport.importedName, depth + 1);
        if (deeper) {
          return deeper;
        }
      }
    }
    return undefined;
  }
}