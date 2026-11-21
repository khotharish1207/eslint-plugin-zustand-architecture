import type { StoreMetadata, Dependency, FileAnalysis, StateField, ActionMetadata, Confidence } from '../types';
import { StoreRegistry } from './store-registry';
import { SymbolResolver } from './symbol-resolution';
import {
  EsVariableDeclaration,
  EsVariableDeclarator,
  EsCallExpression,
  EsMemberExpression,
  EsIdentifier,
  EsObjectExpression,
  getIdentifierName,
  getCalleeName,
  findAll,
  isMemberAccess,
  EsNode,
} from '../utils/ast';

const STATE_CREATE_APIS = new Set(['create', 'createStore', 'createWithEqualityFn']);

const DEFAULT_CONFIDENCE: Confidence = 'medium';

/**
 * Discover Zustand stores and slice composition in a single source file.
 *
 * Returns stores defined in the file plus dependency edges from those stores to
 * other stores they read from / write to / subscribe to via getState/setState/
 * subscribe calls on resolved store identifiers.
 */
export function discoverStores(
  ast: EsNode,
  filePath: string,
  registry: StoreRegistry,
  resolver: SymbolResolver,
): FileAnalysis {
  const stores: StoreMetadata[] = [];
  const dependencies: Dependency[] = [];

  // 2. Find store creation calls.
  const storeCalls = findAll(ast, (n): n is EsCallExpression =>
    n.type === 'CallExpression' && STATE_CREATE_APIS.has(getCalleeName(n) ?? ''),
  );

  // Identify local store variable names defined in this file.
  const localStoreNames = new Set<string>();
  const storeDefinitions: { localName: string; store: StoreMetadata }[] = [];

  for (const call of storeCalls) {
    const calleeName = getCalleeName(call)!;
    // Find the enclosing variable declarator to get the local name.
    const declarator = findEnclosingVariableDeclarator(ast, call);
    const localName = declarator ? getIdentifierName(declarator.id) : undefined;

    if (!localName) continue;

    let creationApi: StoreMetadata['creationApi'] = 'create';
    if (calleeName === 'createStore') creationApi = 'createStore';
    if (calleeName === 'createWithEqualityFn') creationApi = 'createWithEqualityFn';

    const storeId = `${filePath}#${localName}`;
    const store: StoreMetadata = {
      id: storeId,
      name: localName,
      filePath,
      creationApi,
      stateFields: extractStateFields(call),
      actions: extractActions(call),
      readsFrom: [],
      writesTo: [],
      subscribesTo: [],
    };

    registry.register(store);
    resolver.recordStoreDefinition(filePath, localName, storeId);
    localStoreNames.add(localName);
    storeDefinitions.push({ localName, store });
    stores.push(store);
  }

  // 3. Scan for getState / setState / subscribe calls on store identifiers.
  //    Build dependency edges from the store defined in this file to other stores.
  const currentStoreId = stores.length === 1 ? stores[0].id : undefined;

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

    // Resolve the object identifier to a store.
    const resolution = resolver.resolve(filePath, objectName);
    if (!resolution) continue;

    // Self-access is not a cross-store dependency.
    if (localStoreNames.has(objectName)) continue;

    const via = propertyName === 'getState' ? 'read' : propertyName === 'setState' ? 'write' : 'subscribe';

    // Only report when we can identify the reading/writing store.
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

  return { filePath, stores, dependencies };
}
/** Extract state field names from a create(...) call argument (best effort). */
function extractStateFields(call: EsCallExpression): StateField[] {
  const arg = call.arguments[0];
  if (!arg) return [];
  // If it's an object literal, collect top-level keys.
  if (arg.type === 'ObjectExpression') {
    return extractObjectKeys(arg as EsObjectExpression).map((name) => ({ name, confidence: 'medium' as const }));
  }
  // If it's a function (set, get) => ({ ... }), we cannot statically know fields.
  return [];
}

/** Extract action names (heuristic: keys whose value is a function). */
function extractActions(call: EsCallExpression): ActionMetadata[] {
  const arg = call.arguments[0];
  if (!arg || arg.type !== 'ObjectExpression') return [];
  const actions: ActionMetadata[] = [];
  for (const prop of (arg as EsObjectExpression).properties) {
    if (prop.type === 'Property' && prop.value.type === 'ArrowFunctionExpression') {
      const key = getIdentifierName(prop.key);
      if (key) actions.push({ name: key, confidence: 'medium' });
    }
  }
  return actions;
}

function extractObjectKeys(obj: EsObjectExpression): string[] {
  const keys: string[] = [];
  for (const prop of obj.properties) {
    if (prop.type === 'Property') {
      const k = prop.key;
      if (k.type === 'Identifier') {
        keys.push((k as EsIdentifier).name);
      } else if (k.type === 'Literal') {
        keys.push(String((k as unknown as { value: string }).value));
      }
    }
  }
  return keys;
}

/** True when the call is a member expression call like `obj.method()`. */
function isMemberExpressionCall(node: EsNode): node is EsCallExpression {
  if (node.type !== 'CallExpression') return false;
  return (node as EsCallExpression).callee.type === 'MemberExpression';
}

/**
 * Find the VariableDeclarator that directly encloses a given node, by walking
 * up through the AST. We re-walk from root looking for a declarator whose init
 * (or nested init) contains the target node.
 */
function findEnclosingVariableDeclarator(root: EsNode, target: EsNode): EsVariableDeclarator | null {
  let result: EsVariableDeclarator | null = null;
  const visited = new Set<EsNode>();
  (function walk(node: EsNode | null | undefined): void {
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
        for (const item of value) walk(item as EsNode);
      } else if (value && typeof value === 'object' && 'type' in value) {
        walk(value as EsNode);
      }
    }
  })(root);
  return result;
}

function nodeContains(container: EsNode | null | undefined, target: EsNode): boolean {
  if (!container) return false;
  if (container === target) return true;
  const visited = new Set<EsNode>();
  let found = false;
  (function walk(node: EsNode | null | undefined): void {
    if (!node || found || visited.has(node)) return;
    visited.add(node);
    if (node === target) { found = true; return; }
    for (const key of Object.keys(node)) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) walk(item as EsNode);
      } else if (value && typeof value === 'object' && 'type' in value) {
        walk(value as EsNode);
      }
    }
  })(container);
  return found;
}