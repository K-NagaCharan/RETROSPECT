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
        const valueNode = node.childForFieldName('value');
        if (valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression' || valueNode.type === 'function')) {
          const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
          const paramsNode = valueNode.childForFieldName('parameters');
          const parameters = this._extractParameters(paramsNode, sourceCode);
          const normalizedSignature = this.normalizeSignature(name, parameters, null);
          const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;
          const symbolType = valueNode.type === 'arrow_function' ? 'arrow_function' : 'function';

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
        const rightNode = node.childForFieldName('right');
        if (rightNode && (rightNode.type === 'arrow_function' || rightNode.type === 'function_expression' || rightNode.type === 'function')) {
          const name = leftNode ? this._nodeText(leftNode, sourceCode).replace(/^(exports\.|module\.exports\.)/, '') : 'anonymous';
          const paramsNode = rightNode.childForFieldName('parameters');
          const parameters = this._extractParameters(paramsNode, sourceCode);
          const normalizedSignature = this.normalizeSignature(name, parameters, null);
          const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;

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

      // Recurse for all children
      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i), scopeStack);
      }
    };

    traverse(tree.rootNode, []);
    return symbols;
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
}

module.exports = JavaScriptAdapter;
