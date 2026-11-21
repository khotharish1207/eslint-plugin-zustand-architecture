import type { Rule } from 'eslint';

const STATE_CREATE_APIS = new Set(['create', 'createStore', 'createWithEqualityFn']);
const STORE_WRITE_METHODS = new Set(['setState']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow cross-store writes via setState()',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      crossStoreWrites:
        'Cross-store write: "{{storeName}}" writes to "{{targetStore}}" via setState(). Stores should only manage their own state.',
    },
  },
  create(context) {
    const storeNames = new Set<string>();
    const violations: { node: Rule.Node; targetStore: string }[] = [];

    return {
      VariableDeclarator(node) {
        if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          STATE_CREATE_APIS.has(node.init.callee.name) &&
          node.id.type === 'Identifier'
        ) {
          storeNames.add(node.id.name);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          STORE_WRITE_METHODS.has(node.callee.property.name) &&
          node.callee.object.type === 'Identifier'
        ) {
          const objectName = node.callee.object.name;
          if (storeNames.size > 1 && storeNames.has(objectName)) {
            violations.push({
              node,
              targetStore: objectName,
            });
          }
        }
      },
      'Program:exit'() {
        if (storeNames.size <= 1) return;
        for (const v of violations) {
          context.report({
            node: v.node,
            messageId: 'crossStoreWrites',
            data: {
              storeName: v.targetStore,
              targetStore: v.targetStore,
            },
          });
        }
      },
    };
  },
};

export default rule;