const LanguageAdapter = require('./LanguageAdapter');
const SymbolRecord = require('../model/SymbolRecord');

class PythonAdapter extends LanguageAdapter {
  constructor() {
    super('python');
  }

  getFileExtensions() {
    return ['.py'];
  }

  extractSymbols(sourceCode, tree, filePath = '') {
    const symbols = [];
    const hasSyntaxError = tree.rootNode.hasError();

    const traverse = (node, scopeStack = []) => {
      if (!node) return;

      if (node.type === 'class_definition') {
        const classNameNode = node.childForFieldName('name');
        const className = classNameNode ? this._nodeText(classNameNode, sourceCode) : 'AnonymousClass';
        let docstring = this._extractPythonDocstring(node, sourceCode);
        const bodyNode = node.childForFieldName('body');
        if (!docstring && bodyNode) {
          for (let i = 0; i < bodyNode.childCount; i++) {
            const child = bodyNode.child(i);
            if (child.type === 'function_definition') {
              const nameNode = child.childForFieldName('name');
              if (nameNode && this._nodeText(nameNode, sourceCode) === '__init__') {
                docstring = this._extractPythonDocstring(child, sourceCode);
                if (docstring) break;
              }
            }
          }
        }
        const range = this._nodeRange(node);
        const source = this._nodeText(node, sourceCode);
        const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${className}` : className;

        const superclassesNode = node.childForFieldName('superclasses');
        const baseClasses = superclassesNode ? this._nodeText(superclassesNode, sourceCode).replace(/[()]/g, '').split(',').map(s => s.trim()).filter(Boolean) : [];

        const classSymbol = new SymbolRecord({
          name: className,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters: [],
          normalizedSignature: `class ${className}`,
          range,
          source,
          language: 'python',
          filePath,
          symbolType: 'class',
          docstring,
          metadata: {
            isClass: true,
            baseClasses
          },
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(classSymbol);

        const newScope = [...scopeStack, className];
        if (bodyNode) {
          for (let i = 0; i < bodyNode.childCount; i++) {
            traverse(bodyNode.child(i), newScope);
          }
        }
        return;
      }

      if (node.type === 'decorated_definition') {
        // Collect decorators
        const decorators = [];
        let targetDef = null;

        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === 'decorator') {
            decorators.push(this._nodeText(child, sourceCode).trim());
          } else if (child.type === 'function_definition') {
            targetDef = child;
          }
        }

        if (targetDef) {
          this._processFunctionDef(targetDef, decorators, scopeStack, sourceCode, filePath, symbols, hasSyntaxError);
        }
        return;
      }

      if (node.type === 'function_definition') {
        this._processFunctionDef(node, [], scopeStack, sourceCode, filePath, symbols, hasSyntaxError);
        return;
      }

      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i), scopeStack);
      }
    };

    traverse(tree.rootNode, []);
    return symbols;
  }

  _processFunctionDef(node, decorators, scopeStack, sourceCode, filePath, symbols, hasSyntaxError) {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
    const paramsNode = node.childForFieldName('parameters');
    const returnTypeNode = node.childForFieldName('return_type');
    const returnType = returnTypeNode ? this._nodeText(returnTypeNode, sourceCode).trim() : null;

    const parameters = this._extractParameters(paramsNode, sourceCode);
    const normalizedSignature = this.normalizeSignature(name, parameters, returnType);
    const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;
    const isMethod = scopeStack.length > 0;
    const symbolType = isMethod ? 'method' : 'function';

    const source = this._nodeText(node, sourceCode);
    const range = this._nodeRange(node);
    const docstring = this._extractPythonDocstring(node, sourceCode);
    const calls = this._extractCalls(node, sourceCode);

    const symbol = new SymbolRecord({
      name,
      qualifiedName,
      enclosingScope: [...scopeStack],
      parameters,
      normalizedSignature,
      returnType,
      range,
      source,
      language: 'python',
      filePath,
      symbolType,
      modifiers: [],
      decorators,
      docstring,
      calls,
      astSummary: {
        nodeType: node.type,
        childCount: node.childCount
      },
      metadata: {
        isMethod,
        hasDecorators: decorators.length > 0
      },
      extractionStatus: hasSyntaxError ? 'partial' : 'success'
    });

    symbols.push(symbol);

    // Recursively process nested functions in the function body
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      const newScope = [...scopeStack, name];
      for (let i = 0; i < bodyNode.childCount; i++) {
        const child = bodyNode.child(i);
        if (child.type === 'function_definition' || child.type === 'decorated_definition') {
          if (child.type === 'function_definition') {
            this._processFunctionDef(child, [], newScope, sourceCode, filePath, symbols, hasSyntaxError);
          } else {
            // decorated
            const decs = [];
            let innerFunc = null;
            for (let j = 0; j < child.childCount; j++) {
              const c = child.child(j);
              if (c.type === 'decorator') decs.push(this._nodeText(c, sourceCode).trim());
              else if (c.type === 'function_definition') innerFunc = c;
            }
            if (innerFunc) {
              this._processFunctionDef(innerFunc, decs, newScope, sourceCode, filePath, symbols, hasSyntaxError);
            }
          }
        }
      }
    }
  }

  _extractParameters(paramsNode, sourceCode) {
    if (!paramsNode) return [];
    const params = [];

    for (let i = 0; i < paramsNode.childCount; i++) {
      const child = paramsNode.child(i);
      if (child.type === '(' || child.type === ')' || child.type === ',') continue;

      if (child.type === 'identifier') {
        params.push({ name: this._nodeText(child, sourceCode), type: null });
      } else if (child.type === 'default_parameter') {
        const nameNode = child.childForFieldName('name');
        const valueNode = child.childForFieldName('value');
        params.push({
          name: nameNode ? this._nodeText(nameNode, sourceCode) : '',
          defaultValue: valueNode ? this._nodeText(valueNode, sourceCode) : null
        });
      } else if (child.type === 'typed_parameter') {
        const nameNode = child.child(0);
        const typeNode = child.childForFieldName('type');
        params.push({
          name: nameNode ? this._nodeText(nameNode, sourceCode) : '',
          type: typeNode ? this._nodeText(typeNode, sourceCode) : null
        });
      } else if (child.type === 'typed_default_parameter') {
        const nameNode = child.childForFieldName('name');
        const typeNode = child.childForFieldName('type');
        const valueNode = child.childForFieldName('value');
        params.push({
          name: nameNode ? this._nodeText(nameNode, sourceCode) : '',
          type: typeNode ? this._nodeText(typeNode, sourceCode) : null,
          defaultValue: valueNode ? this._nodeText(valueNode, sourceCode) : null
        });
      } else if (child.type === 'list_splat_pattern') {
        params.push({ name: this._nodeText(child, sourceCode), type: 'splat' });
      } else if (child.type === 'dictionary_splat_pattern') {
        params.push({ name: this._nodeText(child, sourceCode), type: 'dict_splat' });
      }
    }

    return params;
  }

  _extractPythonDocstring(node, sourceCode) {
    // Check inside function/class body for docstring
    const bodyNode = node.childForFieldName('body');
    if (bodyNode && bodyNode.childCount > 0) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const child = bodyNode.child(i);
        if (child.type === 'expression_statement') {
          const expr = child.child(0);
          if (expr && (expr.type === 'string' || expr.type === 'concatenated_string')) {
            const raw = this._nodeText(expr, sourceCode).trim();
            // Strip quotes
            return raw.replace(/^("""|'''|"|')|("""|'''|"|')$/g, '').trim();
          }
        }
        // If not a comment or empty statement, stop looking for docstring
        if (child.type !== 'comment') break;
      }
    }

    // Fallback: check leading comments above symbol
    return this._extractLeadingComment(node, sourceCode);
  }

  _extractCalls(node, sourceCode) {
    const calls = new Set();
    const walk = (n) => {
      if (!n) return;
      if (n.type === 'call') {
        const funcNode = n.childForFieldName('function');
        if (funcNode) {
          if (funcNode.type === 'identifier') {
            calls.add(this._nodeText(funcNode, sourceCode).trim());
          } else if (funcNode.type === 'attribute') {
            const attrNode = funcNode.childForFieldName('attribute');
            if (attrNode) calls.add(this._nodeText(attrNode, sourceCode).trim());
          }
        }
      }
      for (let i = 0; i < n.childCount; i++) {
        walk(n.child(i));
      }
    };

    const bodyNode = node.childForFieldName('body');
    if (bodyNode) walk(bodyNode);
    return Array.from(calls);
  }

  extractImports(tree, sourceCode) {
    const imports = [];
    if (!tree || !tree.rootNode) return imports;

    for (let i = 0; i < tree.rootNode.childCount; i++) {
      const child = tree.rootNode.child(i);
      if (child.type === 'import_statement') {
        // e.g. import os, sys
        const text = this._nodeText(child, sourceCode).replace(/^import\s+/, '').trim();
        imports.push(...text.split(',').map(s => s.trim()).filter(Boolean));
      } else if (child.type === 'import_from_statement') {
        // e.g. from math import sqrt
        const modNode = child.childForFieldName('module_name');
        if (modNode) {
          imports.push(this._nodeText(modNode, sourceCode).trim());
        }
      }
    }
    return imports;
  }
}

module.exports = PythonAdapter;
