import type { StoreMetadata, Dependency, Confidence, ImportBinding } from '../types';
import { StoreRegistry } from '../analyzer/store-registry';
import { SymbolResolver } from '../analyzer/symbol-resolution';
import {
  EsNode,
  EsCallExpression,
  EsMemberExpression,
  EsIdentifier,
  EsImportDeclaration,
  EsExportNamedDeclaration,
  EsExportAllDeclaration,
  EsVariableDeclaration,
  EsVariableDeclarator,
  getIdentifierName,
  getCalleeName,
  findAll,
} from './ast';

const STATE_CREATE_APIS = new Set(['create', 'createStore', 'createWithEqualityFn']);
const STORE_METHODS = new Set(['getState', 'setState', 'subscribe', 'subscribeWithSelector']);

export interface RuleViolation {
  node: EsNode;
  message: string;
  storeName: string;
  targetStore: string;
  targetFile?: string;
  via: 'read' | 'write' | 'subscribe';
  confidence: Confidence;
}

export class ZustandRuleHelper {
  private registry = new StoreRegistry();
  private resolver = new SymbolResolver();
  private filePath: string;
  private ast: EsNode;
  private localStoreNames = new Set<string>();
  private violations: RuleViolation[] = [];

  constructor(ast: EsNode, filePath: string) {
    this.ast = ast;
    this.filePath = filePath;
  }

  analyze(): RuleViolation[] {
    this.violations = [];
    this.localStoreNames = new Set();
    this.recordBindings(this.ast);
    this.discoverStores();
    this.scanMemberCalls();
    return this.violations;
  }

  getStores(): StoreMetadata[] {
    return this.registry.all().filter((s) => s.filePath === this.filePath);
  }

  /** Number of stores defined in this file. */
  getStoreCount(): number {
    return this.getStores().length;
  }

  getResolver(): SymbolResolver {
    return this.resolver;
  }

  private recordBindings(ast: EsNode): void {
    const imports = findAll(ast, (n): n is EsImportDeclaration => n.type === 'ImportDeclaration');
    for (const imp of imports) {
      const source = imp.source.value;
      for (const spec of imp.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          this.resolver.recordReExport(this.filePath, spec.local.name, source, spec.imported.name);
        } else if (spec.type === 'ImportDefaultSpecifier') {
          this.resolver.recordReExport(this.filePath, spec.local.name, source, 'default');
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          this.resolver.recordReExport(this.filePath, spec.local.name, source, '*');
        }
      }
    }
    const exports = findAll(
      ast,
      (n): n is EsExportNamedDeclaration | EsExportAllDeclaration =>
        n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration',
    );
    for (const node of exports) {
      if (node.type === 'ExportNamedDeclaration' && node.source) {
        const source = node.source.value;
        for (const spec of node.specifiers) {
          if (spec.type === 'ExportSpecifier') {
            this.resolver.recordReExport(this.filePath, spec.local.name, source, spec.exported.name);
          }
        }
      } else if (node.type === 'ExportAllDeclaration') {
        this.resolver.recordReExport(this.filePath, '*', node.source.value, '*');
      }
    }
  }

  private discoverStores(): void {
    const storeCalls = findAll(this.ast, (n): n is EsCallExpression =>
      n.type === 'CallExpression' && STATE_CREATE_APIS.has(getCalleeName(n) ?? ''),
    );

    for (const call of storeCalls) {
      const calleeName = getCalleeName(call)!;
      const declarator = this.findEnclosingVariableDeclarator(this.ast, call);
      const localName = declarator ? getIdentifierName(declarator.id) : undefined;
      if (!localName) continue;

      const storeId = `${this.filePath}#${localName}`;
      this.registry.register({
        id: storeId,
        name: localName,
        filePath: this.filePath,
        creationApi:
          calleeName === 'createStore'
            ? 'createStore'
            : calleeName === 'createWithEqualityFn'
              ? 'createWithEqualityFn'
              : 'create',
        stateFields: [],
        actions: [],
        readsFrom: [],
        writesTo: [],
        subscribesTo: [],
      });
      this.resolver.recordStoreDefinition(this.filePath, localName, storeId);
      this.localStoreNames.add(localName);
    }
  }

  private scanMemberCalls(): void {
    const memberCalls = findAll(this.ast, (n): n is EsCallExpression =>
      n.type === 'CallExpression' && this.isMemberExpressionCall(n),
    );

    for (const call of memberCalls) {
      const member = call.callee as EsMemberExpression;
      const object = member.object;
      const objectName = getIdentifierName(object);
      if (!objectName) continue;

      const propertyName =
        member.property.type === 'Identifier' && !member.computed
          ? (member.property as EsIdentifier).name
          : null;
      if (!propertyName || !STORE_METHODS.has(propertyName)) continue;

      const resolution = this.resolver.resolve(this.filePath, objectName);
      if (!resolution) continue;

      const via = propertyName === 'getState' ? 'read' : propertyName === 'setState' ? 'write' : 'subscribe';

      this.violations.push({
        node: member,
        message: '',
        storeName: '',
        targetStore: resolution.storeName,
        targetFile: resolution.storeId.split('#')[0],
        via,
        confidence: resolution.confidence,
      });
    }
  }

  private isMemberExpressionCall(node: EsNode): node is EsCallExpression {
    if (node.type !== 'CallExpression') return false;
    return (node as EsCallExpression).callee.type === 'MemberExpression';
  }

  private findEnclosingVariableDeclarator(root: EsNode, target: EsNode): EsVariableDeclarator | null {
    let result: EsVariableDeclarator | null = null;
    const visited = new Set<EsNode>();
    (function walkNode(node: EsNode | null | undefined): void {
      if (!node || result || visited.has(node)) return;
      visited.add(node);
      if (node.type === 'VariableDeclaration') {
        for (const decl of (node as EsVariableDeclaration).declarations) {
          if (nodeContains(decl.init, target)) {
            result = decl;
            return;
          }
        }
      }
      for (const key of Object.keys(node)) {
        const value = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          for (const item of value) walkNode(item as EsNode);
        } else if (value && typeof value === 'object' && 'type' in value) {
          walkNode(value as EsNode);
        }
      }
    })(root);
    return result;
  }
}

function nodeContains(container: EsNode | null | undefined, target: EsNode): boolean {
  if (!container) return false;
  if (container === target) return true;
  const visited = new Set<EsNode>();
  let found = false;
  (function walkNode(node: EsNode | null | undefined): void {
    if (!node || found || visited.has(node)) return;
    visited.add(node);
    if (node === target) { found = true; return; }
    for (const key of Object.keys(node)) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) walkNode(item as EsNode);
      } else if (value && typeof value === 'object' && 'type' in value) {
        walkNode(value as EsNode);
      }
    }
  })(container);
  return found;
}