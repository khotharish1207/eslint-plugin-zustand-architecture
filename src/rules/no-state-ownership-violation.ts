import type { Rule } from 'eslint';

const STATE_CREATE_APIS = new Set(['create', 'createStore', 'createWithEqualityFn']);
const STORE_WRITE_METHODS = new Set(['setState']);

interface OwnershipRule {
  owner: string;
  allowedWriters: string[];
}

interface OwnershipConfig {
  [fieldName: string]: OwnershipRule;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow writes to state fields outside their declared ownership',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      stateOwnershipViolation:
        'State ownership violation: "{{storeName}}" writes to "{{field}}" which is owned by "{{owner}}". Allowed writers: {{allowedWriters}}.',
    },
  },
  create(context) {
    const settings = context.settings['zustand-architecture'] as
      | { ownership?: OwnershipConfig; allowedDependencies?: Record<string, string[]>; analysis?: Record<string, unknown> }
      | undefined;
    const ownership: OwnershipConfig = settings?.ownership ?? {};

    const storeNames = new Set<string>();
    const violations: {
      node: Rule.Node;
      storeName: string;
      field: string;
      owner: string;
      allowedWriters: string[];
    }[] = [];

    return {
      VariableDeclarator(node: any) {
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
      CallExpression(node: any) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          STORE_WRITE_METHODS.has(node.callee.property.name) &&
          node.callee.object.type === 'Identifier'
        ) {
          const objectName = node.callee.object.name;
          if (!storeNames.has(objectName)) return;

          const arg = node.arguments[0];
          if (!arg) return;

          // Object update: setState({ field: value })
          if (arg.type === 'ObjectExpression') {
            const keys = extractObjectLiteralKeys(arg);
            for (const key of keys) {
              checkOwnership(objectName, key, node, violations, ownership);
            }
          }
          // Updater callback: setState((state) => ({ field: value }))
          else if (
            arg.type === 'ArrowFunctionExpression' ||
            arg.type === 'FunctionExpression'
          ) {
            const fn = arg as any;
            const retObj = findReturnObjectInFunction(fn);
            if (retObj) {
              const keys = extractObjectLiteralKeys(retObj);
              for (const key of keys) {
                checkOwnership(objectName, key, node, violations, ownership);
              }
            }
          }
        }
      },
      'Program:exit'() {
        for (const v of violations) {
          context.report({
            node: v.node,
            messageId: 'stateOwnershipViolation',
            data: {
              storeName: v.storeName,
              field: v.field,
              owner: v.owner,
              allowedWriters: v.allowedWriters.join(', '),
            },
          });
        }
      },
    };
  },
};

export default rule;

/** Check whether a field write violates ownership rules. */
function checkOwnership(
  storeName: string,
  field: string,
  node: Rule.Node,
  violations: {
    node: Rule.Node;
    storeName: string;
    field: string;
    owner: string;
    allowedWriters: string[];
  }[],
  ownership: OwnershipConfig,
): void {
  const rule = ownership[field];
  if (!rule) return; // No ownership rule for this field — skip

  if (rule.allowedWriters && rule.allowedWriters.includes(storeName)) {
    return; // Store is an allowed writer
  }

  // Store is not the owner and not an allowed writer
  violations.push({
    node,
    storeName,
    field,
    owner: rule.owner,
    allowedWriters: rule.allowedWriters,
  });
}

/** Extract top-level keys from an object expression. */
function extractObjectLiteralKeys(obj: any): string[] {
  const keys: string[] = [];
  for (const prop of obj.properties) {
    if (prop.type === 'Property' && !prop.computed) {
      if (prop.key.type === 'Identifier') {
        keys.push(prop.key.name);
      } else if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') {
        keys.push(prop.key.value);
      }
    }
  }
  return keys;
}

/** Find the object literal returned by a function/arrow function body. */
function findReturnObjectInFunction(fn: any): any {
  const body = fn.body;
  if (body.type === 'ObjectExpression') {
    // Implicit return: `(state) => ({ field: value })`
    return body;
  }
  if (body.type === 'BlockStatement') {
    for (const stmt of body.body) {
      if (stmt.type === 'ReturnStatement' && stmt.argument?.type === 'ObjectExpression') {
        return stmt.argument;
      }
    }
  }
  return null;
}