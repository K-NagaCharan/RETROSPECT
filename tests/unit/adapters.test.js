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
