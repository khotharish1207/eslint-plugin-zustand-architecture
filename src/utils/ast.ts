/**
 * Lightweight AST traversal helpers.
 *
 * We avoid a hard dependency on @typescript-eslint/utils so the plugin stays
 * light. Nodes are accessed structurally with narrow type assertions.
 */

export interface EsNode {
  type: string;
}

export interface EsIdentifier extends EsNode {
  type: 'Identifier';
  name: string;
}

export interface EsCallExpression extends EsNode {
  type: 'CallExpression';
  callee: EsNode;
  arguments: EsNode[];
  optional?: boolean;
}

export interface EsMemberExpression extends EsNode {
  type: 'MemberExpression';
  object: EsNode;
  property: EsNode;
  computed: boolean;
  optional?: boolean;
}

export interface EsVariableDeclarator extends EsNode {
  type: 'VariableDeclarator';
  id: EsNode;
  init: EsNode | null;
}

export interface EsVariableDeclaration extends EsNode {
  type: 'VariableDeclaration';
  declarations: EsVariableDeclarator[];
  kind: 'const' | 'let' | 'var';
}

export interface EsImportSpecifier extends EsNode {
  type: 'ImportSpecifier';
  local: EsIdentifier;
  imported: EsIdentifier;
}

export interface EsImportDefaultSpecifier extends EsNode {
  type: 'ImportDefaultSpecifier';
  local: EsIdentifier;
}

export interface EsImportNamespaceSpecifier extends EsNode {
  type: 'ImportNamespaceSpecifier';
  local: EsIdentifier;
}

export interface EsImportDeclaration extends EsNode {
  type: 'ImportDeclaration';
  source: { type: 'Literal'; value: string };
  specifiers: (EsImportSpecifier | EsImportDefaultSpecifier | EsImportNamespaceSpecifier)[];
}

export interface EsExportSpecifier extends EsNode {
  type: 'ExportSpecifier';
  local: EsIdentifier;
  exported: EsIdentifier;
}

export interface EsExportNamedDeclaration extends EsNode {
  type: 'ExportNamedDeclaration';
  source: { type: 'Literal'; value: string } | null;
  specifiers: EsExportSpecifier[];
  declaration: EsNode | null;
}

export interface EsExportAllDeclaration extends EsNode {
  type: 'ExportAllDeclaration';
  source: { type: 'Literal'; value: string };
  exported: EsIdentifier | null;
}

export interface EsExpressionStatement extends EsNode {
  type: 'ExpressionStatement';
  expression: EsNode;
}

export interface EsArrowFunctionExpression extends EsNode {
  type: 'ArrowFunctionExpression';
  params: EsNode[];
  body: EsNode;
  returnType?: EsNode;
}

export interface EsFunctionDeclaration extends EsNode {
  type: 'FunctionDeclaration';
  id: EsIdentifier | null;
  params: EsNode[];
  body: EsNode;
}

export interface EsProperty extends EsNode {
  type: 'Property';
  key: EsNode;
  value: EsNode;
  computed: boolean;
  method: boolean;
  shorthand: boolean;
}

export interface EsObjectExpression extends EsNode {
  type: 'ObjectExpression';
  properties: EsProperty[];
}

export interface EsSpreadElement extends EsNode {
  type: 'SpreadElement';
  argument: EsNode;
}

export interface EsArrayExpression extends EsNode {
  type: 'ArrayExpression';
  elements: (EsNode | null)[];
}

/** Get the name of a call expression's callee, e.g. `createStore` from `createStore(...)`. */
export function getCalleeName(node: EsNode): string | null {
  if (node.type === 'CallExpression') {
    const callee = (node as EsCallExpression).callee;
    if (callee.type === 'Identifier') {
      return (callee as EsIdentifier).name;
    }
    if (callee.type === 'MemberExpression') {
      const member = callee as EsMemberExpression;
      if (member.property.type === 'Identifier' && !member.computed) {
        return (member.property as EsIdentifier).name;
      }
    }
  }
  return null;
}

/** Get the name of an identifier node, or null. */
export function getIdentifierName(node: EsNode): string | null {
  return node.type === 'Identifier' ? (node as EsIdentifier).name : null;
}

/** Recursively walk every node in the tree, calling `visitor` on each. */
export function walk(node: EsNode | null | undefined, visitor: (n: EsNode) => void): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  const visited = new Set<EsNode>();
  (function walkNode(n: EsNode | null | undefined): void {
    if (!n || typeof n !== 'object' || visited.has(n)) {
      return;
    }
    visited.add(n);
    visitor(n);
    for (const key of Object.keys(n)) {
      const value = (n as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          walkNode(item as EsNode);
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        walkNode(value as EsNode);
      }
    }
  })(node);
}

/** Find all nodes matching a predicate anywhere under `root`. */
export function findAll<T extends EsNode>(root: EsNode, predicate: (n: EsNode) => n is T): T[] {
  const results: T[] = [];
  walk(root, (n) => {
    if (predicate(n)) {
      results.push(n);
    }
  });
  return results;
}

/** Find the first node matching a predicate. */
export function findFirst<T extends EsNode>(root: EsNode, predicate: (n: EsNode) => n is T): T | null {
  let result: T | null = null;
  walk(root, (n) => {
    if (!result && predicate(n)) {
      result = n;
    }
  });
  return result;
}

/** Check whether a node is a MemberExpression whose property is a given name. */
export function isMemberAccess(node: EsNode, propertyName: string): node is EsMemberExpression {
  if (node.type !== 'MemberExpression') {
    return false;
  }
  const member = node as EsMemberExpression;
  return (
    !member.computed &&
    member.property.type === 'Identifier' &&
    (member.property as EsIdentifier).name === propertyName
  );
}