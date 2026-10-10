const JavaScriptAdapter = require('./JavaScriptAdapter');
const SymbolRecord = require('../model/SymbolRecord');

class TypeScriptAdapter extends JavaScriptAdapter {
  constructor() {
    super('typescript');
  }

  getFileExtensions() {
    return ['.ts', '.tsx', '.mts', '.cts'];
  }

  extractSymbols(sourceCode, tree, filePath = '') {
    const symbols = [];
    const hasSyntaxError = tree.rootNode.hasError();

    const traverse = (node, scopeStack = []) => {
      if (!node) return;

      // Handle class declaration or interface declaration
      if (node.type === 'class_declaration' || node.type === 'class' || node.type === 'interface_declaration') {
        const nameNode = node.childForFieldName('name');
        const className = nameNode ? this._nodeText(nameNode, sourceCode) : 'AnonymousType';
        const newScope = [...scopeStack, className];
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          for (let i = 0; i < bodyNode.childCount; i++) {
            traverse(bodyNode.child(i), newScope);
          }
        }
        return;
      }

      // Handle method definition and method signature (in interface or abstract class)
      if (node.type === 'method_definition' || node.type === 'method_signature') {
        const nameNode = node.childForFieldName('name');
        const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
        const isConstructor = name === 'constructor';
        const symbolType = isConstructor ? 'constructor' : 'method';

        const paramsNode = node.childForFieldName('parameters');
        const parameters = this._extractParameters(paramsNode, sourceCode);
        
        // Return type annotation
        const returnTypeNode = node.childForFieldName('return_type') || this._findChildType(node, 'type_annotation');
        let returnType = null;
        if (returnTypeNode) {
          returnType = this._nodeText(returnTypeNode, sourceCode).replace(/^:\s*/, '').trim();
        }

        const normalizedSignature = this.normalizeSignature(name, parameters, returnType);
        const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;

        // Modifiers (accessibility, static, async, abstract, readonly)
        const modifiers = [];
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === 'accessibility_modifier') {
            modifiers.push(this._nodeText(child, sourceCode).trim());
          } else if (['static', 'async', 'abstract', 'readonly', 'override'].includes(child.type)) {
            modifiers.push(child.type);
          }
        }

        // Type parameters e.g. <T>
        const typeParamsNode = node.childForFieldName('type_parameters') || this._findChildType(node, 'type_parameters');
        const typeParameters = typeParamsNode ? this._nodeText(typeParamsNode, sourceCode).trim() : null;

        const symbol = new SymbolRecord({
          name,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters,
          normalizedSignature,
          returnType,
          range: this._nodeRange(node),
          source: this._nodeText(node, sourceCode),
          language: 'typescript',
          filePath,
          symbolType,
          modifiers,
          astSummary: { nodeType: node.type },
          metadata: {
            isConstructor,
            typeParameters,
            isSignatureOnly: node.type === 'method_signature'
          },
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(symbol);

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          traverse(bodyNode, [...scopeStack, name]);
        }
        return;
      }

      // Handle function declaration or function signature
      if (node.type === 'function_declaration' || node.type === 'function_signature') {
        const nameNode = node.childForFieldName('name');
        const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
        const paramsNode = node.childForFieldName('parameters');
        const parameters = this._extractParameters(paramsNode, sourceCode);

        const returnTypeNode = node.childForFieldName('return_type') || this._findChildType(node, 'type_annotation');
        let returnType = null;
        if (returnTypeNode) {
          returnType = this._nodeText(returnTypeNode, sourceCode).replace(/^:\s*/, '').trim();
        }

        const normalizedSignature = this.normalizeSignature(name, parameters, returnType);
        const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${name}` : name;

        const modifiers = [];
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (['async', 'export'].includes(child.type)) {
            modifiers.push(child.type);
          }
        }

        const typeParamsNode = node.childForFieldName('type_parameters') || this._findChildType(node, 'type_parameters');
        const typeParameters = typeParamsNode ? this._nodeText(typeParamsNode, sourceCode).trim() : null;

        const symbol = new SymbolRecord({
          name,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters,
          normalizedSignature,
          returnType,
          range: this._nodeRange(node),
          source: this._nodeText(node, sourceCode),
          language: 'typescript',
          filePath,
          symbolType: 'function',
          modifiers,
          astSummary: { nodeType: node.type },
          metadata: {
            typeParameters,
            isSignatureOnly: node.type === 'function_signature'
          },
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(symbol);

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          traverse(bodyNode, [...scopeStack, name]);
        }
        return;
      }

      // Handle variable declarator: const foo = (...) => ...
      if (node.type === 'variable_declarator') {
        const nameNode = node.childForFieldName('name');
        const valueNode = node.childForFieldName('value');
        if (valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression')) {
          const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
          const paramsNode = valueNode.childForFieldName('parameters');
          const parameters = this._extractParameters(paramsNode, sourceCode);

          const returnTypeNode = valueNode.childForFieldName('return_type') || this._findChildType(valueNode, 'type_annotation');
          let returnType = null;
          if (returnTypeNode) {
            returnType = this._nodeText(returnTypeNode, sourceCode).replace(/^:\s*/, '').trim();
          }

          const normalizedSignature = this.normalizeSignature(name, parameters, returnType);
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
            returnType,
            range: this._nodeRange(node),
            source: this._nodeText(node, sourceCode),
            language: 'typescript',
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

      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i), scopeStack);
      }
    };

    traverse(tree.rootNode, []);
    return symbols;
  }

  _findChildType(node, typeName) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === typeName) return node.child(i);
    }
    return null;
  }

  _extractParameters(paramsNode, sourceCode) {
    if (!paramsNode) return [];
    const params = [];

    for (let i = 0; i < paramsNode.childCount; i++) {
      const child = paramsNode.child(i);
      if (['(', ')', ',', '{', '}', ';'].includes(child.type)) continue;

      if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
        const patternNode = child.childForFieldName('pattern');
        const typeNode = child.childForFieldName('type');
        const valueNode = child.childForFieldName('value');
        params.push({
          name: patternNode ? this._nodeText(patternNode, sourceCode) : '',
          type: typeNode ? this._nodeText(typeNode, sourceCode).replace(/^:\s*/, '').trim() : null,
          defaultValue: valueNode ? this._nodeText(valueNode, sourceCode) : null
        });
      } else if (child.type === 'identifier') {
        params.push({ name: this._nodeText(child, sourceCode), type: null });
      } else if (child.type === 'rest_pattern') {
        params.push({
          name: this._nodeText(child, sourceCode),
          type: 'rest'
        });
      }
    }

    return params;
  }
}

module.exports = TypeScriptAdapter;
