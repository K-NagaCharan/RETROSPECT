const LanguageAdapter = require('./LanguageAdapter');
const SymbolRecord = require('../model/SymbolRecord');

class JavaScriptAdapter extends LanguageAdapter {
  constructor(languageId = 'javascript') {
    super(languageId);
  }

  getFileExtensions() {
    return ['.js', '.jsx', '.mjs', '.cjs'];
  }

  extractSymbols(sourceCode, tree, filePath = '') {
    const symbols = [];
    const hasSyntaxError = tree.rootNode.hasError();

    const traverse = (node, scopeStack = []) => {
      if (!node) return;

      // Handle class declaration or expression
      if (node.type === 'class_declaration' || node.type === 'class') {
        const nameNode = node.childForFieldName('name');
        const className = nameNode ? this._nodeText(nameNode, sourceCode) : 'AnonymousClass';
        const docstring = this._extractLeadingComment(node, sourceCode);
        const range = this._nodeRange(node);
        const source = this._nodeText(node, sourceCode);
        const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${className}` : className;

        const classSymbol = new SymbolRecord({
          name: className,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters: [],
          normalizedSignature: `class ${className}`,
          range,
          source,
          language: this.languageId,
          filePath,
          symbolType: 'class',
          docstring,
          metadata: { isClass: true },
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(classSymbol);

        const newScope = [...scopeStack, className];
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          for (let i = 0; i < bodyNode.childCount; i++) {
            traverse(bodyNode.child(i), newScope);
          }
        }
        return;
      }

      // Handle method definition inside class
      if (node.type === 'method_definition') {
        const nameNode = node.childForFieldName('name');
        const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
        const isConstructor = name === 'constructor';
        const symbolType = isConstructor ? 'constructor' : 'method';
        
        const paramsNode = node.childForFieldName('parameters');
        const parameters = this._extractParameters(paramsNode, sourceCode);
        const normalizedSignature = this.normalizeSignature(name, parameters, null);
        const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;
        const docstring = this._extractLeadingComment(node, sourceCode);
        const calls = this._extractCalls(node, sourceCode);
        
        // Modifiers (static, async, etc.)
        const modifiers = [];
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (['static', 'async', 'get', 'set'].includes(child.type)) {
            modifiers.push(child.type);
          }
        }

        const symbol = new SymbolRecord({
          name,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters,
          normalizedSignature,
          range: this._nodeRange(node),
          source: this._nodeText(node, sourceCode),
          language: this.languageId,
          filePath,
          symbolType,
          modifiers,
          docstring,
          calls,
          astSummary: { nodeType: node.type },
          metadata: { isConstructor },
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(symbol);

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          traverse(bodyNode, [...scopeStack, name]);
        }
        return;
      }

      // Handle function declaration
      if (node.type === 'function_declaration' || node.type === 'function') {
        const nameNode = node.childForFieldName('name');
        const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
        const paramsNode = node.childForFieldName('parameters');
        const parameters = this._extractParameters(paramsNode, sourceCode);
        const normalizedSignature = this.normalizeSignature(name, parameters, null);
        const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;
        const docstring = this._extractLeadingComment(node, sourceCode);
        const calls = this._extractCalls(node, sourceCode);
        
        const modifiers = [];
        if (node.text.startsWith('async')) modifiers.push('async');

        const symbol = new SymbolRecord({
          name,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters,
          normalizedSignature,
          range: this._nodeRange(node),
          source: this._nodeText(node, sourceCode),
          language: this.languageId,
          filePath,
          symbolType: 'function',
          modifiers,
          docstring,
          calls,
          astSummary: { nodeType: node.type },
          metadata: {},
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(symbol);

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          traverse(bodyNode, [...scopeStack, name]);
        }
        return;
      }

      // Handle variable declarator with arrow function or function expression: const foo = () => {}
      if (node.type === 'variable_declarator') {
        const nameNode = node.childForFieldName('name');
        const rawValueNode = node.childForFieldName('value');
        const valueNode = this._unwrapFunctionValue(rawValueNode);
        if (valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression' || valueNode.type === 'function')) {
          const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
          const paramsNode = valueNode.childForFieldName('parameters');
          const parameters = this._extractParameters(paramsNode, sourceCode);
          const normalizedSignature = this.normalizeSignature(name, parameters, null);
          const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;
          const symbolType = valueNode.type === 'arrow_function' ? 'arrow_function' : 'function';
          const docstring = this._extractLeadingComment(node, sourceCode);
          const calls = this._extractCalls(valueNode, sourceCode);

          const modifiers = [];
          if (valueNode.text.startsWith('async')) modifiers.push('async');

          const symbol = new SymbolRecord({
            name,
            qualifiedName,
            enclosingScope: [...scopeStack],
            parameters,
            normalizedSignature,
            range: this._nodeRange(node),
            source: this._nodeText(node, sourceCode),
            language: this.languageId,
            filePath,
            symbolType,
            modifiers,
            docstring,
            calls,
            astSummary: { nodeType: valueNode.type },
            metadata: {},
            extractionStatus: hasSyntaxError ? 'partial' : 'success'
          });
          symbols.push(symbol);

          const bodyNode = valueNode.childForFieldName('body');
          if (bodyNode) {
            traverse(bodyNode, [...scopeStack, name]);
          }
          return;
        }
      }

      // Handle assignment expression: obj.method = function() {} or exports.foo = () => {}
      if (node.type === 'assignment_expression') {
        const leftNode = node.childForFieldName('left');
        const rawRightNode = node.childForFieldName('right');
        const rightNode = this._unwrapFunctionValue(rawRightNode);
        if (rightNode && (rightNode.type === 'arrow_function' || rightNode.type === 'function_expression' || rightNode.type === 'function')) {
          const name = leftNode ? this._nodeText(leftNode, sourceCode).replace(/^(exports\.|module\.exports\.)/, '') : 'anonymous';
          const paramsNode = rightNode.childForFieldName('parameters');
          const parameters = this._extractParameters(paramsNode, sourceCode);
          const normalizedSignature = this.normalizeSignature(name, parameters, null);
          const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;
          const docstring = this._extractLeadingComment(node, sourceCode);
          const calls = this._extractCalls(rightNode, sourceCode);

          const symbol = new SymbolRecord({
            name,
            qualifiedName,
            enclosingScope: [...scopeStack],
            parameters,
            normalizedSignature,
            range: this._nodeRange(node),
            source: this._nodeText(node, sourceCode),
            language: this.languageId,
            filePath,
            symbolType: rightNode.type === 'arrow_function' ? 'arrow_function' : 'function',
            modifiers: [],
            docstring,
            calls,
            astSummary: { nodeType: rightNode.type },
            metadata: {},
            extractionStatus: hasSyntaxError ? 'partial' : 'success'
          });
          symbols.push(symbol);

          const bodyNode = rightNode.childForFieldName('body');
          if (bodyNode) {
            traverse(bodyNode, [...scopeStack, name]);
          }
          return;
        }
      }

      // Handle defineGetter(target, 'property', function) pattern
      if (node.type === 'call_expression') {
        const fnNode = node.childForFieldName('function');
        const fnName = fnNode ? (fnNode.type === 'identifier' ? this._nodeText(fnNode, sourceCode).trim() : (fnNode.type === 'member_expression' ? this._nodeText(fnNode.childForFieldName('property'), sourceCode).trim() : '')) : '';
        if (fnName === 'defineGetter') {
          const argsNode = node.childForFieldName('arguments');
          if (argsNode && argsNode.namedChildCount >= 3) {
            const targetNode = argsNode.namedChild(0);
            const propNode = argsNode.namedChild(1);
            const rawGetterNode = argsNode.namedChild(2);
            const getterNode = this._unwrapFunctionValue(rawGetterNode);

            if (getterNode && (getterNode.type === 'function_expression' || getterNode.type === 'arrow_function' || getterNode.type === 'function')) {
              let propName = this._nodeText(propNode, sourceCode).trim();
              if ((propName.startsWith("'") && propName.endsWith("'")) ||
                  (propName.startsWith('"') && propName.endsWith('"')) ||
                  (propName.startsWith('`') && propName.endsWith('`'))) {
                propName = propName.slice(1, -1);
              }

              if (propName) {
                const targetText = targetNode ? this._nodeText(targetNode, sourceCode).trim() : '';
                const paramsNode = getterNode.childForFieldName('parameters');
                const parameters = this._extractParameters(paramsNode, sourceCode);
                const normalizedSignature = this.normalizeSignature(propName, parameters, null);
                const qualifiedName = scopeStack.length > 0
                  ? `${scopeStack.join('.')}.${propName}`
                  : (targetText ? `${targetText}.${propName}` : propName);
                const docstring = this._extractLeadingComment(node, sourceCode);
                const calls = this._extractCalls(getterNode, sourceCode);

                const modifiers = ['get'];
                if (getterNode.text && getterNode.text.startsWith('async')) modifiers.push('async');

                const symbol = new SymbolRecord({
                  name: propName,
                  qualifiedName,
                  enclosingScope: [...scopeStack],
                  parameters,
                  normalizedSignature,
                  range: this._nodeRange(node),
                  source: this._nodeText(node, sourceCode),
                  language: this.languageId,
                  filePath,
                  symbolType: 'getter',
                  modifiers,
                  docstring,
                  calls,
                  astSummary: { nodeType: 'call_expression', pattern: 'defineGetter' },
                  metadata: { getterTarget: targetText },
                  extractionStatus: hasSyntaxError ? 'partial' : 'success'
                });
                symbols.push(symbol);

                const bodyNode = getterNode.childForFieldName('body');
                if (bodyNode) {
                  traverse(bodyNode, [...scopeStack, propName]);
                }
                return;
              }
            }
          }
        }
      }

      // Recurse for all children
      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i), scopeStack);
      }
    };

    traverse(tree.rootNode, []);
    return symbols;
  }

  _extractCalls(node, sourceCode) {
    const calls = new Set();
    const walk = (n) => {
      if (!n) return;
      if (n.type === 'call_expression') {
        const funcNode = n.childForFieldName('function');
        if (funcNode) {
          if (funcNode.type === 'identifier') {
            calls.add(this._nodeText(funcNode, sourceCode).trim());
          } else if (funcNode.type === 'member_expression') {
            const propNode = funcNode.childForFieldName('property');
            if (propNode) calls.add(this._nodeText(propNode, sourceCode).trim());
          }
        }
      }
      for (let i = 0; i < n.childCount; i++) {
        walk(n.child(i));
      }
    };

    const bodyNode = node.childForFieldName('body') || node;
    walk(bodyNode);
    return Array.from(calls);
  }

  extractImports(tree, sourceCode) {
    const imports = [];
    if (!tree || !tree.rootNode) return imports;

    const walk = (n) => {
      if (!n) return;
      if (n.type === 'import_statement') {
        const srcNode = n.childForFieldName('source');
        if (srcNode) {
          const mod = this._nodeText(srcNode, sourceCode).replace(/['"]/g, '').trim();
          imports.push(mod);
        }
      } else if (n.type === 'call_expression') {
        const funcNode = n.childForFieldName('function');
        if (funcNode && this._nodeText(funcNode, sourceCode) === 'require') {
          const argsNode = n.childForFieldName('arguments');
          if (argsNode && argsNode.childCount > 1) {
            const firstArg = argsNode.child(1);
            if (firstArg && (firstArg.type === 'string' || firstArg.type === 'string_fragment')) {
              imports.push(this._nodeText(firstArg, sourceCode).replace(/['"]/g, '').trim());
            }
          }
        }
      }
      for (let i = 0; i < n.childCount; i++) {
        walk(n.child(i));
      }
    };

    walk(tree.rootNode);
    return imports;
  }

  _extractParameters(paramsNode, sourceCode) {
    if (!paramsNode) return [];
    const params = [];

    for (let i = 0; i < paramsNode.childCount; i++) {
      const child = paramsNode.child(i);
      if (['(', ')', ',', '{', '}'].includes(child.type)) continue;

      if (child.type === 'identifier') {
        params.push({ name: this._nodeText(child, sourceCode), type: null });
      } else if (child.type === 'assignment_pattern') {
        const left = child.childForFieldName('left');
        const right = child.childForFieldName('right');
        params.push({
          name: left ? this._nodeText(left, sourceCode) : '',
          defaultValue: right ? this._nodeText(right, sourceCode) : null
        });
      } else if (child.type === 'rest_pattern') {
        params.push({
          name: this._nodeText(child, sourceCode),
          type: 'rest'
        });
      } else if (child.type === 'formal_parameters') {
        return this._extractParameters(child, sourceCode);
      }
    }

    return params;
  }

  _unwrapFunctionValue(node) {
    let curr = node;
    while (curr) {
      if (curr.type === 'parenthesized_expression') {
        curr = curr.firstNamedChild || (curr.childCount > 1 ? curr.child(1) : null);
      } else if (curr.type === 'as_expression' || curr.type === 'satisfies_expression') {
        curr = curr.childForFieldName('expression') || curr.firstNamedChild;
      } else if (curr.type === 'type_assertion') {
        curr = curr.childForFieldName('expression') || (curr.namedChildCount > 1 ? curr.namedChild(curr.namedChildCount - 1) : null);
      } else {
        break;
      }
    }
    return curr;
  }
}

module.exports = JavaScriptAdapter;
