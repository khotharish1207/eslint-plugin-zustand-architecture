import type {
  StoreMetadata,
  Dependency,
  FileAnalysis,
  AnalysisOptions,
  ImportBinding,
} from '../types';
import { StoreRegistry } from './store-registry';
import { SymbolResolver } from './symbol-resolution';
import { DependencyGraph } from './dependency-graph';
import { discoverStores } from './store-discovery';
import {
  EsNode,
  EsImportDeclaration,
  EsExportNamedDeclaration,
  EsExportAllDeclaration,
  findAll,
  getIdentifierName,
} from '../utils/ast';

/**
 * Shared analysis engine for Zustand architecture.
 *
 * Responsibilities (shared by all rules):
 *   - store discovery
 *   - slice discovery
 *   - store registry
 *   - dependency graph
 *   - symbol / import resolution (aliases, re-exports, barrels)
 *
 * Usage:
 *   const analyzer = new ZustandAnalyzer(options);
 *   analyzer.analyzeFile(filePath, ast);   // called once per file
 *   analyzer.finalize();                   // resolve cross-file links + build graph
 */
export class ZustandAnalyzer {
  private registry = new StoreRegistry();
  private resolver = new SymbolResolver();
  private graph = new DependencyGraph();
  private options: Required<AnalysisOptions>;
  private analyses = new Map<string, { ast: EsNode; imports: ImportBinding[] }>();
  private finalized = false;

  constructor(options: AnalysisOptions) {
    this.options = {
      confidenceThreshold: options.confidenceThreshold ?? 'medium',
      ownership: options.ownership ?? {},
      allowedDependencies: options.allowedDependencies ?? {},
    };
  }

  /** Analyze a single source file. Call once per file, then finalize(). */
  analyzeFile(filePath: string, ast: EsNode): FileAnalysis {
    this.analyses.set(filePath, { ast, imports: [] });

    // 1. Record imports + re-exports so the resolver can wire cross-file links.
    this.recordBindings(filePath, ast);

    // 2. Discover stores defined in this file (registers them + records local defs).
    const result = discoverStores(ast, filePath, this.registry, this.resolver);

    // Stash the import bindings for the cross-file link step.
    const entry = this.analyses.get(filePath);
    if (entry) {
      entry.imports = this.extractImportBindings(ast);
    }

    return result;
  }

  /**
   * Resolve cross-file import links, re-scan dependencies, and build the
   * dependency graph. Must be called after all files have been analyzed.
   */
  finalize(): void {
    if (this.finalized) return;
    this.finalized = true;

    // 1. Build import map: resolvedSource::importedName -> storeId.
    //    Resolve relative specifiers against the importing file's directory.
    for (const [filePath, entry] of this.analyses) {
      for (const binding of entry.imports) {
        if (!binding.source) continue;
        const resolvedSource = this.resolveSpecifier(filePath, binding.source);
        const storeId = this.resolveImportedStore(resolvedSource, binding.importedName ?? 'default');
        if (storeId) {
          this.resolver.recordImportBinding(filePath, binding, storeId);
        }
      }
    }

    // 2. Re-scan dependencies now that import map is populated (cross-file edges).
    for (const [filePath, entry] of this.analyses) {
      discoverStores(entry.ast, filePath, this.registry, this.resolver);
    }

    // 3. Build the dependency graph from the registry.
    this.graph = DependencyGraph.fromRegistry(this.registry);
  }

  /**
   * Resolve a relative import specifier against an importing file path.
   * Supports ./ and ../ segments. Returns a path without extension handling
   * (callers match against both bare and .ts forms).
   */
  private resolveSpecifier(importingFile: string, specifier: string): string {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      return specifier; // bare package specifier or absolute path
    }
    const dirParts = importingFile.split('/').slice(0, -1); // drop file name
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

  /** The shared store registry. */
  getRegistry(): StoreRegistry {
    return this.registry;
  }

  /** The dependency graph (built after finalize()). */
  getGraph(): DependencyGraph {
    return this.graph;
  }

  /** The symbol resolver. */
  getResolver(): SymbolResolver {
    return this.resolver;
  }

  /** Analysis options. */
  getOptions(): Required<AnalysisOptions> {
    return this.options;
  }

  /** Get the analysis result for a single file. */
  getFileAnalysis(filePath: string): FileAnalysis | undefined {
    const entry = this.analyses.get(filePath);
    if (!entry) return undefined;
    const stores = this.registry.all().filter((s) => s.filePath === filePath);
    return { filePath, stores, dependencies: [] };
  }
  /* ------------------------------------------------------------------ */
  /* Private                                                            */
  /* ------------------------------------------------------------------ */

  private recordBindings(filePath: string, ast: EsNode): void {
    // Import declarations.
    const imports = findAll(ast, (n): n is EsImportDeclaration =>
      n.type === 'ImportDeclaration',
    );
    for (const imp of imports) {
      const bindings = this.resolver.extractImportBindings(imp);
      const entry = this.analyses.get(filePath);
      if (entry) {
        entry.imports.push(...bindings);
      }
    }

    // Re-export / barrel declarations.
    const exports = findAll(ast, (n): n is EsExportNamedDeclaration | EsExportAllDeclaration =>
      n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration',
    );
    this.resolver.extractReExports(filePath, exports);

    // `export default <storeIdentifier>` -> record default export link.
    const defaultExports = findAll(ast, (n): n is EsExportNamedDeclaration => {
      const decl = n as EsExportNamedDeclaration;
      return (
        decl.type === 'ExportNamedDeclaration' &&
        !decl.source &&
        decl.declaration != null &&
        decl.declaration.type === 'Identifier'
      );
    });
    for (const decl of defaultExports) {
      const ident = decl.declaration as EsNode;
      const name = getIdentifierName(ident);
      if (!name) continue;
      const resolution = this.resolver.resolve(filePath, name);
      if (resolution) {
        this.resolver.recordStoreDefinition(filePath, 'default', resolution.storeId);
      }
    }
  }

  private extractImportBindings(ast: EsNode): ImportBinding[] {
    const bindings: ImportBinding[] = [];
    const imports = findAll(ast, (n): n is EsImportDeclaration =>
      n.type === 'ImportDeclaration',
    );
    for (const imp of imports) {
      bindings.push(...this.resolver.extractImportBindings(imp));
    }
    return bindings;
  }

  /**
   * Resolve an imported name from a source module to a store id, using the
   * stores already registered from that source file.
   */
  private resolveImportedStore(source: string, importedName: string): string | undefined {
    // Match registered stores whose filePath equals `source` or `source + '.ts'`
    // (import specifiers omit the extension).
    const candidates = [source, `${source}.ts`];
    for (const store of this.registry.all()) {
      if (candidates.includes(store.filePath) && store.name === importedName) {
        return store.id;
      }
    }
    // Follow re-export (barrel) chains: source file re-exports the name from elsewhere.
    const viaBarrel = this.resolver.resolveViaReExports(source, importedName);
    if (viaBarrel) {
      return viaBarrel;
    }
    // Default export match: first store in the source file.
    if (importedName === 'default') {
      for (const store of this.registry.all()) {
        if (candidates.includes(store.filePath)) {
          return store.id;
        }
      }
    }
    return undefined;
  }
}

/**
 * Scan member calls for dependencies (e.g. `otherStore.getState()`).
 * Shared helper used by the engine and rules.
 */
export function scanDependencies(
  ast: EsNode,
  filePath: string,
  localStoreNames: Set<string>,
  resolver: SymbolResolver,
  registry: StoreRegistry,
  currentStoreId: string | undefined,
): Dependency[] {
  const dependencies: Dependency[] = [];
  const memberCalls = findAll(ast, (n): n is EsCallExpression =>
    n.type === 'CallExpression' && isMemberExpressionCall(n),
  );

  for (const call of memberCalls) {
    const member = call.callee as EsMemberExpression;
    const object = member.object;
    const objectName = getIdentifierName(object);
    if (!objectName) continue;

    const propertyName = member.property.type === 'Identifier' && !member.computed
      ? (member.property as EsIdentifier).name
      : null;
    if (!propertyName || !['getState', 'setState', 'subscribe'].includes(propertyName)) continue;

    const resolution = resolver.resolve(filePath, objectName);
    if (!resolution) continue;
    if (localStoreNames.has(objectName)) continue;

    const via = propertyName === 'getState' ? 'read' : propertyName === 'setState' ? 'write' : 'subscribe';

    if (currentStoreId && resolution.storeId !== currentStoreId) {
      const dep: Dependency = {
        target: resolution.storeId,
        targetFile: resolution.storeId.split('#')[0],
        confidence: resolution.confidence,
        via,
      };
      registry.addDependency(currentStoreId, dep);
      dependencies.push(dep);
    }
  }
  return dependencies;
}

function isMemberExpressionCall(node: EsNode): node is EsCallExpression {
  if (node.type !== 'CallExpression') return false;
  return (node as EsCallExpression).callee.type === 'MemberExpression';
}

interface EsIdentifier {
  type: 'Identifier';
  name: string;
}

interface EsMemberExpression {
  type: 'MemberExpression';
  object: EsNode;
  property: EsNode;
  computed: boolean;
}

interface EsCallExpression {
  type: 'CallExpression';
  callee: EsNode;
}