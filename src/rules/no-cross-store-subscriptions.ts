import type { Rule } from 'eslint';

const STATE_CREATE_APIS = new Set(['create', 'createStore', 'createWithEqualityFn']);
const STORE_SUBSCRIBE_METHODS = new Set(['subscribe', 'subscribeWithSelector']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow store-to-store subscriptions via subscribe()',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      crossStoreSubscriptions:
        'Cross-store subscription: "{{storeName}}" subscribes to "{{targetStore}}". Use selectors or derived stores instead.',
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
          STORE_SUBSCRIBE_METHODS.has(node.callee.property.name) &&
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
            messageId: 'crossStoreSubscriptions',
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