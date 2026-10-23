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

      // Handle class declaration, interface declaration, or enum declaration
      if (node.type === 'class_declaration' || node.type === 'class' || node.type === 'interface_declaration' || node.type === 'enum_declaration') {
        const nameNode = node.childForFieldName('name');
        const className = nameNode ? this._nodeText(nameNode, sourceCode) : 'AnonymousType';
        const docstring = this._extractLeadingComment(node, sourceCode);
        const range = this._nodeRange(node);
        const source = this._nodeText(node, sourceCode);
        const qualifiedName = scopeStack.length > 0 ? `${scopeStack.join('.')}.${className}` : className;
        const symbolType = node.type === 'interface_declaration' ? 'interface' : (node.type === 'enum_declaration' ? 'enum' : 'class');

        const classSymbol = new SymbolRecord({
          name: className,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters: [],
          normalizedSignature: `${symbolType} ${className}`,
          range,
          source,
          language: 'typescript',
          filePath,
          symbolType,
          docstring,
          metadata: { isType: true, symbolType },
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
        const docstring = this._extractLeadingComment(node, sourceCode);
        const calls = this._extractCalls(node, sourceCode);

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
          docstring,
          calls,
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
        const docstring = this._extractLeadingComment(node, sourceCode);
        const calls = this._extractCalls(node, sourceCode);

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
          docstring,
          calls,
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
        const rawValueNode = node.childForFieldName('value');
        const valueNode = this._unwrapFunctionValue(rawValueNode);
        if (valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression')) {
          const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
          const paramsNode = valueNode.childForFieldName('parameters');
          const parameters = this._extractParameters(paramsNode, sourceCode);

          const returnTypeNode = valueNode.childForFieldName('return_type') || this._findChildType(valueNode, 'type_annotation') || node.childForFieldName('type');
          let returnType = null;
          if (returnTypeNode) {
            returnType = this._nodeText(returnTypeNode, sourceCode).replace(/^:\s*/, '').trim();
          }

          const normalizedSignature = this.normalizeSignature(name, parameters, returnType);
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
            returnType,
            range: this._nodeRange(node),
            source: this._nodeText(node, sourceCode),
            language: 'typescript',
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

        // Exported module-level factory definition: export const X = f(..., () => {...}). Adds one
        // symbol for X; traversal then continues unchanged so nested symbols keep their names and ids.
        const callback = scopeStack.length === 0 && this._isExportedDeclarator(node) ? this._findFactoryCallback(valueNode) : null;
        if (callback && nameNode) {
          symbols.push(this._factorySymbol(node, nameNode, valueNode, callback, sourceCode, filePath, hasSyntaxError));
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i), scopeStack);
      }
    };

    traverse(tree.rootNode, []);
    return this._collapseOverloadSignatures(symbols);
  }

  /**
   * Overload signatures (`function f(a: A): X; function f(b: B): Y; function f(x) {...}`) are one
   * callable. Drop signature-only entries when an implementation with the same qualified name exists;
   * otherwise keep only the first signature. Single signatures (e.g. interface members) are untouched.
   */
  _collapseOverloadSignatures(symbols) {
    const groups = new Map();
    for (const s of symbols) {
      if (!['function', 'method', 'constructor'].includes(s.symbolType)) continue;
      if (!groups.has(s.qualifiedName)) groups.set(s.qualifiedName, []);
      groups.get(s.qualifiedName).push(s);
    }
    const drop = new Set();
    for (const group of groups.values()) {
      const sigs = group.filter(s => s.metadata && s.metadata.isSignatureOnly);
      if (sigs.length === 0 || group.length < 2) continue;
      const impls = group.filter(s => !(s.metadata && s.metadata.isSignatureOnly));
      const keep = impls.length > 0 ? impls[0] : sigs[0];
      keep.metadata = { ...(keep.metadata || {}), overloadCount: sigs.length };
      for (const s of sigs) {
        if (s !== keep) drop.add(s);
      }
    }
    return drop.size ? symbols.filter(s => !drop.has(s)) : symbols;
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
