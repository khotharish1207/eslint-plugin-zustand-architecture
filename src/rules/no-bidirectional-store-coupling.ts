import type { Rule } from 'eslint';

const STATE_CREATE_APIS = new Set(['create', 'createStore', 'createWithEqualityFn']);
const STORE_ACCESS_METHODS = new Set(['getState', 'setState', 'subscribe', 'subscribeWithSelector']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow bidirectional coupling between Zustand stores',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      bidirectionalStoreCoupling:
        'Bidirectional store coupling: "{{storeA}}" ↔ "{{storeB}}" — both stores depend on each other. Break the cycle by introducing a shared store or using selectors.',
    },
  },
  create(context) {
    const storeNames = new Set<string>();
    // storeName -> { initNode, dependencies }
    const stores = new Map<string, { initNode: any; dependencies: Set<string> }>();

    return {
      // Discover stores defined in this file
      VariableDeclarator(node: any) {
        if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          STATE_CREATE_APIS.has(node.init.callee.name) &&
          node.id.type === 'Identifier'
        ) {
          storeNames.add(node.id.name);
          stores.set(node.id.name, {
            initNode: node.init,
            dependencies: new Set(),
          });
        }
      },
      'Program:exit'() {
        // For each store, walk its init callback body to find cross-store accesses
        for (const [sourceStore, info] of stores) {
          const visited = new Set<any>();
          findCrossStoreAccesses(info.initNode, sourceStore, storeNames, info.dependencies, visited);
        }

        // Check for bidirectional pairs: A depends on B AND B depends on A
        const checked = new Set<string>();
        for (const [a, infoA] of stores) {
          for (const b of infoA.dependencies) {
            const key = [a, b].sort().join('::');
            if (checked.has(key)) continue;
            checked.add(key);
            const infoB = stores.get(b);
            if (infoB && infoB.dependencies.has(a)) {
              context.report({
                node: infoA.initNode,
                messageId: 'bidirectionalStoreCoupling',
                data: {
                  storeA: a,
                  storeB: b,
                },
              });
            }
          }
        }
      },
    };
  },
};

export default rule;

/**
 * Walk an AST node looking for storeX.method() calls where storeX is a known store
 * (and different from sourceStore). Records dependencies in the provided set.
 */
function findCrossStoreAccesses(
  node: any,
  sourceStore: string,
  storeNames: Set<string>,
  dependencies: Set<string>,
  visited: Set<any>,
): void {
  if (!node || typeof node !== 'object') return;
  if (visited.has(node)) return;
  visited.add(node);

  // Check if this node is a storeX.method() call
  if (
    node.type === 'CallExpression' &&
    node.callee &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property &&
    node.callee.property.type === 'Identifier' &&
    STORE_ACCESS_METHODS.has(node.callee.property.name) &&
    node.callee.object &&
    node.callee.object.type === 'Identifier'
  ) {
    const targetStore = node.callee.object.name;
    if (targetStore !== sourceStore && storeNames.has(targetStore)) {
      dependencies.add(targetStore);
    }
  }

  // Recurse into child nodes
  for (const key of Object.keys(node)) {
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        findCrossStoreAccesses(item, sourceStore, storeNames, dependencies, visited);
      }
    } else if (value && typeof value === 'object' && value.type) {
      findCrossStoreAccesses(value, sourceStore, storeNames, dependencies, visited);
    }
  }
}