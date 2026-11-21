import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow duplicate state/action keys during slice composition',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      duplicateSliceKeys:
        'Duplicate slice key "{{key}}" detected during slice composition. Key is spread from multiple sources.',
    },
  },
  create(context) {
    // sliceFunctionName -> Set of keys returned by that slice function
    const sliceReturnKeys = new Map<string, Set<string>>();
    // Track object literal compositions with spreads
    const violations: { node: Rule.Node; key: string }[] = [];

    return {
      // Detect slice function definitions: `function createX() { return { a, b } }`
      FunctionDeclaration(node: any) {
        if (node.id?.type === 'Identifier' && node.body?.type === 'BlockStatement') {
          const returnObj = findReturnObjectLiteral(node.body);
          if (returnObj) {
            const keys = extractObjectLiteralKeys(returnObj);
            sliceReturnKeys.set(node.id.name, new Set(keys));
          }
        }
      },
      // Detect arrow slice functions: `const createX = () => ({ a, b })`
      VariableDeclarator(node: any) {
        if (
          node.id.type === 'Identifier' &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' ||
            node.init.type === 'FunctionExpression')
        ) {
          const body = node.init.body;
          let returnObj: any = null;
          if (body.type === 'ObjectExpression') {
            // Implicit return: `() => ({ a: 1 })`
            returnObj = body;
          } else if (body.type === 'BlockStatement') {
            const found = findReturnObjectLiteral(body);
            if (found) returnObj = found;
          }
          if (returnObj) {
            const keys = extractObjectLiteralKeys(returnObj);
            sliceReturnKeys.set(node.id.name, new Set(keys));
          }
        }
      },
      // Detect object spread compositions: `{ ...slice1(), ...slice2() }`
      ObjectExpression(node: any) {
        const spreads = node.properties.filter((p: any) => p.type === 'SpreadElement');

        if (spreads.length < 2) return;

        // Collect all keys from all spread sources
        const keySources = new Map<string, string[]>(); // key -> [sourceName]

        for (const spread of spreads) {
          const arg = spread.argument;
          if (arg.type === 'CallExpression' && arg.callee.type === 'Identifier') {
            const sliceName = arg.callee.name;
            const keys = sliceReturnKeys.get(sliceName);
            if (keys) {
              for (const key of keys) {
                if (!keySources.has(key)) keySources.set(key, []);
                keySources.get(key)!.push(sliceName);
              }
            }
          }
        }

        // Report keys that appear in more than one source
        for (const [key, sources] of keySources) {
          if (sources.length > 1) {
            violations.push({ node, key });
          }
        }
      },
      'Program:exit'() {
        for (const v of violations) {
          context.report({
            node: v.node,
            messageId: 'duplicateSliceKeys',
            data: { key: v.key },
          });
        }
      },
    };
  },
};

export default rule;

/** Find a `return { ... }` object literal inside a block statement. */
function findReturnObjectLiteral(body: any): any {
  for (const stmt of body.body) {
    if (stmt.type === 'ReturnStatement' && stmt.argument?.type === 'ObjectExpression') {
      return stmt.argument;
    }
  }
  return null;
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