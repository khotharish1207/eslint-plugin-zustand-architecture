import type { Rule } from 'eslint';

const STATE_CREATE_APIS = new Set(['create', 'createStore', 'createWithEqualityFn']);
const STORE_READ_METHODS = new Set(['getState']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct cross-store state access via getState()',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      directGetStateCoupling:
        'Direct cross-store state access: "{{storeName}}" reads from "{{targetStore}}" via getState(). Use Zustand selectors instead.',
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
          STORE_READ_METHODS.has(node.callee.property.name) &&
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
            messageId: 'directGetStateCoupling',
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