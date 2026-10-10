const LanguageAdapter = require('./LanguageAdapter');
const SymbolRecord = require('../model/SymbolRecord');

class JavaAdapter extends LanguageAdapter {
  constructor() {
    super('java');
  }

  getFileExtensions() {
    return ['.java'];
  }

  extractSymbols(sourceCode, tree, filePath = '') {
    const symbols = [];
    const hasSyntaxError = tree.rootNode.hasError();

    // Track package name
    let packageName = '';
    const packageNode = this._findChildType(tree.rootNode, 'package_declaration');
    if (packageNode) {
      for (let i = 0; i < packageNode.childCount; i++) {
        const c = packageNode.child(i);
        if (c.type === 'scoped_identifier' || c.type === 'identifier') {
          packageName = this._nodeText(c, sourceCode).trim();
          break;
        }
      }
    }

    const traverse = (node, scopeStack = []) => {
      if (!node) return;

      // Handle class, interface, enum, record
      if (['class_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration'].includes(node.type)) {
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

      // Handle constructor declaration
      if (node.type === 'constructor_declaration') {
        const nameNode = node.childForFieldName('name');
        const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'constructor';
        const paramsNode = node.childForFieldName('parameters');
        const parameters = this._extractParameters(paramsNode, sourceCode);

        const { modifiers, annotations } = this._extractModifiersAndAnnotations(node, sourceCode);
        const normalizedSignature = this._formatJavaSignature(name, parameters, null);
        
        // Scope & qualified name
        const fullScope = scopeStack.length > 0 ? scopeStack.join('.') : '';
        const qualifiedBase = packageName ? `${packageName}.${fullScope}` : fullScope;
        const qualifiedName = qualifiedBase ? `${qualifiedBase}.${name}` : name;

        const symbol = new SymbolRecord({
          name,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters,
          normalizedSignature,
          returnType: null,
          range: this._nodeRange(node),
          source: this._nodeText(node, sourceCode),
          language: 'java',
          filePath,
          symbolType: 'constructor',
          modifiers,
          decorators: annotations,
          astSummary: { nodeType: node.type },
          metadata: {
            packageName,
            isOverloaded: true // checked later or flag
          },
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(symbol);
        return;
      }

      // Handle method declaration
      if (node.type === 'method_declaration') {
        const nameNode = node.childForFieldName('name');
        const name = nameNode ? this._nodeText(nameNode, sourceCode) : 'anonymous';
        const paramsNode = node.childForFieldName('parameters');
        const parameters = this._extractParameters(paramsNode, sourceCode);
        
        const typeNode = node.childForFieldName('type');
        const returnType = typeNode ? this._nodeText(typeNode, sourceCode).trim() : 'void';

        const { modifiers, annotations } = this._extractModifiersAndAnnotations(node, sourceCode);
        const normalizedSignature = this._formatJavaSignature(name, parameters, returnType);

        // Throws clause
        const throwsNode = node.childForFieldName('throws') || this._findChildType(node, 'throws');
        const thrownExceptions = throwsNode ? this._nodeText(throwsNode, sourceCode).replace(/^throws\s+/, '').trim() : null;

        const fullScope = scopeStack.length > 0 ? scopeStack.join('.') : '';
        const qualifiedBase = packageName ? `${packageName}.${fullScope}` : fullScope;
        const qualifiedName = qualifiedBase ? `${qualifiedBase}.${name}` : name;

        const symbol = new SymbolRecord({
          name,
          qualifiedName,
          enclosingScope: [...scopeStack],
          parameters,
          normalizedSignature,
          returnType,
          range: this._nodeRange(node),
          source: this._nodeText(node, sourceCode),
          language: 'java',
          filePath,
          symbolType: 'method',
          modifiers,
          decorators: annotations,
          astSummary: { nodeType: node.type },
          metadata: {
            packageName,
            thrownExceptions
          },
          extractionStatus: hasSyntaxError ? 'partial' : 'success'
        });
        symbols.push(symbol);

        // Method bodies can have local classes with methods
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          traverse(bodyNode, [...scopeStack, name]);
        }
        return;
      }

      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i), scopeStack);
      }
    };

    traverse(tree.rootNode, []);
    return symbols;
  }

  _formatJavaSignature(name, parameters, returnType) {
    const paramsStr = (parameters || []).map(p => {
      if (p.type) return `${p.type} ${p.name}`.trim();
      return p.name || '';
    }).join(', ');

    if (returnType) {
      return `${returnType} ${name}(${paramsStr})`.trim();
    }
    return `${name}(${paramsStr})`;
  }

  _extractModifiersAndAnnotations(node, sourceCode) {
    const modifiers = [];
    const annotations = [];

    const modNode = this._findChildType(node, 'modifiers');
    if (modNode) {
      for (let i = 0; i < modNode.childCount; i++) {
        const child = modNode.child(i);
        if (child.type === 'marker_annotation' || child.type === 'annotation') {
          annotations.push(this._nodeText(child, sourceCode).trim());
        } else {
          const modText = this._nodeText(child, sourceCode).trim();
          if (modText) modifiers.push(modText);
        }
      }
    }

    return { modifiers, annotations };
  }

  _findChildType(node, typeName) {
    if (!node) return null;
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
      if (['(', ')', ','].includes(child.type)) continue;

      if (child.type === 'formal_parameter') {
        const typeNode = child.childForFieldName('type');
        const nameNode = child.childForFieldName('name');
        params.push({
          name: nameNode ? this._nodeText(nameNode, sourceCode) : '',
          type: typeNode ? this._nodeText(typeNode, sourceCode).trim() : null
        });
      } else if (child.type === 'spread_parameter') {
        // e.g. String... args
        const nameNode = child.childForFieldName('name');
        const typeNode = child.child(0);
        params.push({
          name: nameNode ? this._nodeText(nameNode, sourceCode) : '',
          type: typeNode ? `${this._nodeText(typeNode, sourceCode).trim()}...` : '...'
        });
      }
    }

    return params;
  }
}

module.exports = JavaAdapter;
