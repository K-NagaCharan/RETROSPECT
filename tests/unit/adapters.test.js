const FunctionExtractor = require('../../src/parser/FunctionExtractor');
const { defaultRegistry } = require('../../src/languages/LanguageAdapterRegistry');

describe('Multi-Language Symbol Extraction Adapters', () => {
  const extractor = new FunctionExtractor(defaultRegistry);

  describe('PythonAdapter', () => {
    test('extracts module-level functions, class methods, nested functions, and decorators', async () => {
      const code = `
@app.route("/api")
@auth_required
def get_data(query: str, limit: int = 10, *args, **kwargs) -> dict:
    def helper_transform(item):
        return item.strip()
    return {"status": "ok"}

class DataProcessor:
    def __init__(self, config):
        self.config = config

    @property
    def is_ready(self) -> bool:
        return True

    def process(self, batch_size=100):
        pass
`;
      const result = await extractor.extract(code, 'app/processor.py');
      expect(result.language).toBe('python');
      expect(result.hasSyntaxError).toBe(false);
      
      const names = result.symbols.map(s => s.name);
      expect(names).toContain('get_data');
      expect(names).toContain('helper_transform');
      expect(names).toContain('__init__');
      expect(names).toContain('is_ready');
      expect(names).toContain('process');

      // Check get_data details
      const getData = result.symbols.find(s => s.name === 'get_data');
      expect(getData.decorators).toEqual(['@app.route("/api")', '@auth_required']);
      expect(getData.returnType).toBe('dict');
      expect(getData.parameters.length).toBe(4);
      expect(getData.normalizedSignature).toContain('query: str');
      expect(getData.enclosingScope).toEqual([]);

      // Check nested function
      const helper = result.symbols.find(s => s.name === 'helper_transform');
      expect(helper.enclosingScope).toEqual(['get_data']);
      expect(helper.qualifiedName).toBe('get_data.helper_transform');

      // Check class method
      const isReady = result.symbols.find(s => s.name === 'is_ready');
      expect(isReady.enclosingScope).toEqual(['DataProcessor']);
      expect(isReady.qualifiedName).toBe('DataProcessor.is_ready');
      expect(isReady.symbolType).toBe('method');
    });

    test('handles syntax errors without crashing', async () => {
      const brokenCode = `
def valid_one():
    return 1

def broken_syntax(
    print("missing closing paren"
`;
      const result = await extractor.extract(brokenCode, 'broken.py');
      expect(result.hasSyntaxError).toBe(true);
      expect(result.symbols.length).toBeGreaterThan(0);
      expect(result.symbols[0].name).toBe('valid_one');
      expect(result.symbols[0].extractionStatus).toBe('partial');
    });
  });

  describe('JavaScriptAdapter', () => {
    test('extracts function declarations, expressions, arrows, and class methods', async () => {
      const code = `
export function computeTotal(price, tax = 0.1) {
  function innerDiscount(p) { return p * 0.9; }
  return innerDiscount(price) * (1 + tax);
}

const formatNumber = (num, decimals = 2) => {
  return num.toFixed(decimals);
};

const multiplier = function(a, b) {
  return a * b;
};

class OrderService {
  constructor(db) {
    this.db = db;
  }

  async fetchOrder(orderId) {
    return this.db.find(orderId);
  }
}
`;
      const result = await extractor.extract(code, 'src/order.js');
      expect(result.language).toBe('javascript');
      expect(result.hasSyntaxError).toBe(false);

      const names = result.symbols.map(s => s.name);
      expect(names).toContain('computeTotal');
      expect(names).toContain('innerDiscount');
      expect(names).toContain('formatNumber');
      expect(names).toContain('multiplier');
      expect(names).toContain('constructor');
      expect(names).toContain('fetchOrder');

      const computeTotal = result.symbols.find(s => s.name === 'computeTotal');
      expect(computeTotal.symbolType).toBe('function');
      expect(computeTotal.parameters.length).toBe(2);

      const formatArrow = result.symbols.find(s => s.name === 'formatNumber');
      expect(formatArrow.symbolType).toBe('arrow_function');

      const fetchOrder = result.symbols.find(s => s.name === 'fetchOrder');
      expect(fetchOrder.symbolType).toBe('method');
      expect(fetchOrder.enclosingScope).toEqual(['OrderService']);
      expect(fetchOrder.qualifiedName).toBe('OrderService.fetchOrder');
      expect(fetchOrder.modifiers).toContain('async');
    });

    test('extracts defineGetter calls as getter symbols for protocol and fresh', async () => {
      const code = `
const req = {};

/**
 * Return the protocol string "http" or "https"
 * when properly sub-classed.
 */
defineGetter(req, 'protocol', function protocol(){
  var proto = this.connection.encrypted ? 'https' : 'http';
  return proto;
});

/**
 * Check if the request is fresh.
 */
defineGetter(req, 'fresh', function(){
  var method = this.method;
  var res = this.res;
  return true;
});
`;
      const result = await extractor.extract(code, 'lib/request.js');
      expect(result.language).toBe('javascript');
      expect(result.hasSyntaxError).toBe(false);

      const names = result.symbols.map(s => s.name);
      expect(names).toContain('protocol');
      expect(names).toContain('fresh');

      const protocolSym = result.symbols.find(s => s.name === 'protocol');
      expect(protocolSym.symbolType).toBe('getter');
      expect(protocolSym.qualifiedName).toBe('req.protocol');
      expect(protocolSym.modifiers).toContain('get');
      expect(protocolSym.docstring).toContain('Return the protocol string');
      expect(protocolSym.normalizedSignature).toBe('protocol()');

      const freshSym = result.symbols.find(s => s.name === 'fresh');
      expect(freshSym.symbolType).toBe('getter');
      expect(freshSym.qualifiedName).toBe('req.fresh');
      expect(freshSym.modifiers).toContain('get');
      expect(freshSym.docstring).toContain('Check if the request is fresh');
      expect(freshSym.normalizedSignature).toBe('fresh()');
    });

    test('unwraps parenthesized expressions around function initializers without extracting non-functions', async () => {
      const code = `
const wrappedArrow = ((a, b) => a + b);
const regularConst = (42);
const regexConst = (/^[a-z]+$/);
`;
      const result = await extractor.extract(code, 'src/helpers.js');
      const names = result.symbols.map(s => s.name);
      expect(names).toContain('wrappedArrow');
      expect(names).not.toContain('regularConst');
      expect(names).not.toContain('regexConst');
    });

    test('extracts named function expressions assigned to module.exports and preserves anonymous CommonJS exports', async () => {
      const code = `
module.exports = function lookupFiles(filepath, extensions = [], recursive = false) {
  return filepath;
};

module.exports.helperMethod = function(a, b) {
  return a + b;
};

exports.standaloneHelper = function(x) {
  return x * 2;
};
`;
      const result = await extractor.extract(code, 'lib/cli/lookup-files.js');
      expect(result.language).toBe('javascript');
      expect(result.hasSyntaxError).toBe(false);

      const names = result.symbols.map(s => s.name);
      expect(names).toContain('lookupFiles');
      expect(names).toContain('helperMethod');
      expect(names).toContain('standaloneHelper');
      expect(names).not.toContain('module.exports');

      const lookupSym = result.symbols.find(s => s.name === 'lookupFiles');
      expect(lookupSym.symbolType).toBe('function');
      expect(lookupSym.qualifiedName).toBe('lookupFiles');
      expect(lookupSym.parameters.map(p => p.name)).toEqual(['filepath', 'extensions', 'recursive']);
      expect(lookupSym.normalizedSignature).toBe('lookupFiles(filepath, extensions, recursive)');

      // Anonymous function assigned directly to module.exports
      const anonCode = `
module.exports = function(filepath) {
  return filepath;
};
`;
      const anonResult = await extractor.extract(anonCode, 'lib/anon.js');
      const anonNames = anonResult.symbols.map(s => s.name);
      expect(anonNames).toContain('module.exports');
      const anonSym = anonResult.symbols.find(s => s.name === 'module.exports');
      expect(anonSym.symbolType).toBe('function');
      expect(anonSym.qualifiedName).toBe('module.exports');

      // Anonymous arrow function assigned directly to module.exports
      const arrowCode = `
module.exports = (filepath) => filepath;
`;
      const arrowResult = await extractor.extract(arrowCode, 'lib/arrow.js');
      const arrowNames = arrowResult.symbols.map(s => s.name);
      expect(arrowNames).toContain('module.exports');
      const arrowSym = arrowResult.symbols.find(s => s.name === 'module.exports');
      expect(arrowSym.symbolType).toBe('arrow_function');

      // Object method assignment preserves method name
      const objMethodCode = `
obj.method = function customHandler(req, res) {
  return true;
};
`;
      const objResult = await extractor.extract(objMethodCode, 'lib/obj.js');
      const objNames = objResult.symbols.map(s => s.name);
      expect(objNames).toContain('obj.method');
    });
  });

  describe('TypeScriptAdapter', () => {
    test('extracts typed functions, modifiers, return types, and interface signatures', async () => {
      const code = `
export interface Logger {
  log(msg: string): void;
}

export class AppLogger implements Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  public log(msg: string): void {
    console.log(this.prefix + msg);
  }

  protected async sendMetrics<T>(data: T, retryCount: number = 3): Promise<boolean> {
    return true;
  }
}

export function parsePayload<T>(raw: string): T {
  return JSON.parse(raw);
}
`;
      const result = await extractor.extract(code, 'src/logger.ts');
      expect(result.language).toBe('typescript');
      expect(result.hasSyntaxError).toBe(false);

      const logMethod = result.symbols.find(s => s.name === 'log' && s.enclosingScope.includes('AppLogger'));
      expect(logMethod).toBeDefined();
      expect(logMethod.returnType).toBe('void');
      expect(logMethod.modifiers).toContain('public');
      expect(logMethod.parameters[0]).toEqual({ name: 'msg', type: 'string', defaultValue: null });

      const sendMetrics = result.symbols.find(s => s.name === 'sendMetrics');
      expect(sendMetrics).toBeDefined();
      expect(sendMetrics.modifiers).toContain('protected');
      expect(sendMetrics.modifiers).toContain('async');
      expect(sendMetrics.returnType).toBe('Promise<boolean>');
      expect(sendMetrics.metadata.typeParameters).toBe('<T>');

      const parsePayload = result.symbols.find(s => s.name === 'parsePayload');
      expect(parsePayload.returnType).toBe('T');
    });

    test('extracts Zod-style validate arrow function wrapped in as_expression and parenthesized_expression', async () => {
      const code = `
export type $Validate = <T>(schema: T, value: unknown) => boolean;

// Deliberately tiny helper for schema parsing
export const validate: $Validate = ((
  schema: any,
  value: unknown,
  _ctx?: any
): boolean => {
  return true;
}) as $Validate;

export const legacyCast = <any>((x: number) => x * 2);
export const regexConst = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/ as any;
export const numberConst = 100 as number;
`;
      const result = await extractor.extract(code, 'packages/zod/src/v4/core/parse.ts');
      expect(result.language).toBe('typescript');
      expect(result.hasSyntaxError).toBe(false);

      const names = result.symbols.map(s => s.name);
      expect(names).toContain('validate');
      expect(names).toContain('legacyCast');
      expect(names).not.toContain('regexConst');
      expect(names).not.toContain('numberConst');

      const validateSym = result.symbols.find(s => s.name === 'validate');
      expect(validateSym.symbolType).toBe('arrow_function');
      expect(validateSym.returnType).toBe('boolean');
      expect(validateSym.parameters.length).toBe(3);
      expect(validateSym.parameters[0].name).toBe('schema');
      expect(validateSym.parameters[1].name).toBe('value');
      expect(validateSym.parameters[2].name).toBe('_ctx');
      expect(validateSym.docstring).toContain('Deliberately tiny helper');
    });
  });

  describe('JavaAdapter', () => {
    test('extracts methods, constructors, overloaded methods, and modifiers', async () => {
      const code = `
package com.retrospect.demo;

import java.util.List;

public class RepositoryService {
  private final String repoName;

  @Deprecated
  public RepositoryService(String repoName) {
    this.repoName = repoName;
  }

  public int findIndex(String key) {
    return 0;
  }

  public int findIndex(String key, int startIndex) throws IllegalArgumentException {
    return startIndex;
  }

  @Override
  public synchronized void syncAll(List<String> items) {
    // sync
  }
}
`;
      const result = await extractor.extract(code, 'src/com/retrospect/demo/RepositoryService.java');
      expect(result.language).toBe('java');
      expect(result.hasSyntaxError).toBe(false);

      const constructor = result.symbols.find(s => s.symbolType === 'constructor');
      expect(constructor).toBeDefined();
      expect(constructor.name).toBe('RepositoryService');
      expect(constructor.decorators).toContain('@Deprecated');
      expect(constructor.parameters[0]).toEqual({ name: 'repoName', type: 'String' });

      // Check overloaded findIndex methods
      const findIndexMethods = result.symbols.filter(s => s.name === 'findIndex');
      expect(findIndexMethods.length).toBe(2);

      const singleParam = findIndexMethods.find(m => m.parameters.length === 1);
      const multiParam = findIndexMethods.find(m => m.parameters.length === 2);
      expect(singleParam.normalizedSignature).toBe('int findIndex(String key)');
      expect(multiParam.normalizedSignature).toBe('int findIndex(String key, int startIndex)');
      expect(multiParam.metadata.thrownExceptions).toBe('IllegalArgumentException');

      const syncAll = result.symbols.find(s => s.name === 'syncAll');
      expect(syncAll.modifiers).toContain('public');
      expect(syncAll.modifiers).toContain('synchronized');
      expect(syncAll.decorators).toContain('@Override');
    });
  });
});
