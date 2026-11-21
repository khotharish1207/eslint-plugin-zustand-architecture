import { describe, expect, it } from 'vitest';
import { ZustandAnalyzer, scanDependencies } from '../../src/analyzer';
import { StoreRegistry } from '../../src/analyzer/store-registry';
import { SymbolResolver } from '../../src/analyzer/symbol-resolution';
import { DependencyGraph } from '../../src/analyzer/dependency-graph';
import type { EsNode, EsIdentifier, EsCallExpression } from '../../src/utils/ast';
import type { Confidence } from '../../src/types';

function ident(name: string): EsIdentifier {
  return { type: 'Identifier', name };
}

function literal(value: string) {
  return { type: 'Literal', value };
}

function call(callee: EsNode, args: EsNode[] = []): EsCallExpression {
  return { type: 'CallExpression', callee, arguments: args };
}

function memberCall(objectName: string, method: string): EsCallExpression {
  return call(
    { type: 'MemberExpression', object: ident(objectName), property: ident(method), computed: false },
    [],
  );
}

function storeCreation(storeName: string, api = 'create'): EsNode {
  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: ident(storeName),
        init: call(ident(api), [{ type: 'ObjectExpression', properties: [] }]),
      },
    ],
  };
}

function importNamed(source: string, localName: string, importedName: string): EsNode {
  return {
    type: 'ImportDeclaration',
    source: literal(source),
    specifiers: [{ type: 'ImportSpecifier', local: ident(localName), imported: ident(importedName) }],
  };
}

function reExportNamed(source: string, localName: string, exportedName: string): EsNode {
  return {
    type: 'ExportNamedDeclaration',
    source: literal(source),
    specifiers: [{ type: 'ExportSpecifier', local: ident(localName), exported: ident(exportedName) }],
    declaration: null,
  };
}

function program(...nodes: EsNode[]): EsNode {
  return { type: 'Program', body: nodes };
}

function analyze(files: Record<string, EsNode>, options = { confidenceThreshold: 'medium' as Confidence }) {
  const analyzer = new ZustandAnalyzer(options);
  for (const [filePath, ast] of Object.entries(files)) {
    analyzer.analyzeFile(filePath, ast);
  }
  analyzer.finalize();
  return analyzer;
}
describe('ZustandAnalyzer store discovery', () => {
  it('registers a create store with name, filePath and creationApi', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(storeCreation('cartStore')),
    });

    const stores = analyzer.getRegistry().all();
    expect(stores).toHaveLength(1);
    expect(stores[0].name).toBe('cartStore');
    expect(stores[0].filePath).toBe('/src/cart.ts');
    expect(stores[0].creationApi).toBe('create');
    expect(stores[0].id).toBe('/src/cart.ts#cartStore');
  });

  it('supports createStore and createWithEqualityFn', () => {
    const analyzer = analyze({
      '/src/a.ts': program(storeCreation('aStore', 'createStore')),
      '/src/b.ts': program(storeCreation('bStore', 'createWithEqualityFn')),
    });

    const byFile = (fp: string) => analyzer.getRegistry().all().filter((s) => s.filePath === fp);
    expect(byFile('/src/a.ts')[0].creationApi).toBe('createStore');
    expect(byFile('/src/b.ts')[0].creationApi).toBe('createWithEqualityFn');
  });

  it('treats self getState() as not a cross-store dependency', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(
        storeCreation('cartStore'),
        { type: 'ExpressionStatement', expression: memberCall('cartStore', 'getState') },
      ),
    });

    const store = analyzer.getRegistry().all()[0];
    expect(store.readsFrom).toEqual([]);
    expect(store.writesTo).toEqual([]);
    expect(store.subscribesTo).toEqual([]);
  });

  it('detects cross-file read when the reading file defines its own store', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(storeCreation('cartStore')),
      '/src/ui.ts': program(
        storeCreation('uiStore'),
        importNamed('./cart', 'cartStore', 'cartStore'),
        { type: 'ExpressionStatement', expression: memberCall('cartStore', 'getState') },
      ),
    });

    const uiStore = analyzer.getRegistry().all().find((s) => s.name === 'uiStore')!;
    expect(uiStore.readsFrom.length).toBe(1);
    expect(uiStore.readsFrom[0].target).toBe('/src/cart.ts#cartStore');
    expect(uiStore.readsFrom[0].via).toBe('read');
    expect(uiStore.readsFrom[0].confidence).toBe('high');
  });

  it('detects cross-file setState write', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(storeCreation('cartStore')),
      '/src/ui.ts': program(
        storeCreation('uiStore'),
        importNamed('./cart', 'cartStore', 'cartStore'),
        { type: 'ExpressionStatement', expression: memberCall('cartStore', 'setState') },
      ),
    });

    const uiStore = analyzer.getRegistry().all().find((s) => s.name === 'uiStore')!;
    expect(uiStore.writesTo.length).toBe(1);
    expect(uiStore.writesTo[0].via).toBe('write');
  });

  it('detects cross-file subscribe', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(storeCreation('cartStore')),
      '/src/ui.ts': program(
        storeCreation('uiStore'),
        importNamed('./cart', 'cartStore', 'cartStore'),
        { type: 'ExpressionStatement', expression: memberCall('cartStore', 'subscribe') },
      ),
    });

    const uiStore = analyzer.getRegistry().all().find((s) => s.name === 'uiStore')!;
    expect(uiStore.subscribesTo.length).toBe(1);
    expect(uiStore.subscribesTo[0].via).toBe('subscribe');
  });
});
describe('symbol resolution - aliases and barrels', () => {
  it('resolves aliased imports', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(storeCreation('cartStore')),
      '/src/ui.ts': program(
        storeCreation('uiStore'),
        importNamed('./cart', 'cs', 'cartStore'),
        { type: 'ExpressionStatement', expression: memberCall('cs', 'getState') },
      ),
    });

    const uiStore = analyzer.getRegistry().all().find((s) => s.name === 'uiStore')!;
    expect(uiStore.readsFrom.length).toBe(1);
    expect(uiStore.readsFrom[0].target).toBe('/src/cart.ts#cartStore');
  });

  it('resolves through a barrel re-export', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(storeCreation('cartStore')),
      '/src/index.ts': program(reExportNamed('./cart', 'cartStore', 'cartStore')),
      '/src/ui.ts': program(
        storeCreation('uiStore'),
        importNamed('./index', 'cartStore', 'cartStore'),
        { type: 'ExpressionStatement', expression: memberCall('cartStore', 'getState') },
      ),
    });

    const uiStore = analyzer.getRegistry().all().find((s) => s.name === 'uiStore')!;
    expect(uiStore.readsFrom.length).toBe(1);
    expect(uiStore.readsFrom[0].target).toBe('/src/cart.ts#cartStore');
  });

  it('returns empty for unresolvable dynamic identifiers', () => {
    const analyzer = analyze({
      '/src/ui.ts': program(
        storeCreation('uiStore'),
        { type: 'ExpressionStatement', expression: memberCall('unknownStore', 'getState') },
      ),
    });

    const uiStore = analyzer.getRegistry().all().find((s) => s.name === 'uiStore')!;
    expect(uiStore.readsFrom).toEqual([]);
  });
});

describe('confidence threshold', () => {
  it('keeps high-confidence cross-file dependencies', () => {
    const analyzer = analyze({
      '/src/cart.ts': program(storeCreation('cartStore')),
      '/src/ui.ts': program(
        storeCreation('uiStore'),
        importNamed('./cart', 'cartStore', 'cartStore'),
        { type: 'ExpressionStatement', expression: memberCall('cartStore', 'getState') },
      ),
    }, { confidenceThreshold: 'high' });

    const uiStore = analyzer.getRegistry().all().find((s) => s.name === 'uiStore')!;
    expect(uiStore.readsFrom.length).toBe(1);
    expect(uiStore.readsFrom[0].confidence).toBe('high');
  });
});

describe('DependencyGraph bidirectional coupling', () => {
  function regStore(registry: StoreRegistry, id: string, name: string, filePath: string) {
    registry.register({
      id, name, filePath, creationApi: 'create',
      stateFields: [], actions: [], readsFrom: [], writesTo: [], subscribesTo: [],
    });
  }

  it('finds bidirectional pairs', () => {
    const registry = new StoreRegistry();
    regStore(registry, '/a.ts#a', 'a', '/a.ts');
    regStore(registry, '/b.ts#b', 'b', '/b.ts');
    registry.addDependency('/a.ts#a', { target: '/b.ts#b', confidence: 'high', via: 'read' });
    registry.addDependency('/b.ts#b', { target: '/a.ts#a', confidence: 'high', via: 'write' });

    const graph = DependencyGraph.fromRegistry(registry);
    const pairs = graph.findBidirectional();
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual(['/a.ts#a', '/b.ts#b']);
  });

  it('returns empty when only one direction exists', () => {
    const registry = new StoreRegistry();
    regStore(registry, '/a.ts#a', 'a', '/a.ts');
    regStore(registry, '/b.ts#b', 'b', '/b.ts');
    registry.addDependency('/a.ts#a', { target: '/b.ts#b', confidence: 'high', via: 'read' });

    const graph = DependencyGraph.fromRegistry(registry);
    expect(graph.findBidirectional()).toEqual([]);
  });

  it('dependsOn lists outgoing targets', () => {
    const registry = new StoreRegistry();
    regStore(registry, '/a.ts#a', 'a', '/a.ts');
    regStore(registry, '/b.ts#b', 'b', '/b.ts');
    registry.addDependency('/a.ts#a', { target: '/b.ts#b', confidence: 'high', via: 'read' });
    registry.addDependency('/a.ts#a', { target: '/b.ts#b', confidence: 'high', via: 'write' });

    const graph = DependencyGraph.fromRegistry(registry);
    expect(graph.dependsOn('/a.ts#a')).toEqual(['/b.ts#b']);
    expect(graph.readsFrom('/a.ts#a')).toEqual(['/b.ts#b']);
    expect(graph.writesTo('/a.ts#a')).toEqual(['/b.ts#b']);
  });
});

describe('scanDependencies standalone', () => {
  it('builds read/write/subscribe edges from member calls', () => {
    const registry = new StoreRegistry();
    const resolver = new SymbolResolver();
    resolver.recordStoreDefinition('/src/cart.ts', 'cartStore', '/src/cart.ts#cartStore');
    // Simulate what finalize() does: record the cross-file import binding.
    resolver.recordImportBinding('/src/ui.ts', {
      localName: 'cartStore',
      importedName: 'cartStore',
      source: './cart',
      isAlias: false,
      isDefault: false,
      isNamespace: false,
      isReExport: false,
    }, '/src/cart.ts#cartStore');

    const ast = program(
      storeCreation('uiStore'),
      importNamed('./cart', 'cartStore', 'cartStore'),
      memberCall('cartStore', 'getState'),
      memberCall('cartStore', 'setState'),
      memberCall('cartStore', 'subscribe'),
      memberCall('uiStore', 'getState'), // self -> ignored
    );

    const deps = scanDependencies(
      ast, '/src/ui.ts', new Set(['uiStore']), resolver, registry, '/src/ui.ts#uiStore',
    );

    expect(deps.length).toBe(3);
    expect(deps.map((d) => d.via).sort()).toEqual(['read', 'subscribe', 'write']);
  });
});