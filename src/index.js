const GitHistoryReader = require('./git/GitHistoryReader');
const { LanguageAdapterRegistry, defaultRegistry } = require('./languages/LanguageAdapterRegistry');
const LanguageAdapter = require('./languages/LanguageAdapter');
const PythonAdapter = require('./languages/PythonAdapter');
const JavaScriptAdapter = require('./languages/JavaScriptAdapter');
const TypeScriptAdapter = require('./languages/TypeScriptAdapter');
const JavaAdapter = require('./languages/JavaAdapter');
const TreeSitterManager = require('./parser/TreeSitterManager');
const FunctionExtractor = require('./parser/FunctionExtractor');
const SymbolRecord = require('./model/SymbolRecord');
const { HistoryGraph, CHANGE_VOCABULARY } = require('./model/HistoryGraph');
const SimilarityUtils = require('./matcher/SimilarityUtils');
const FunctionMatcher = require('./matcher/FunctionMatcher');
const HistoryStore = require('./storage/HistoryStore');
const { HistoryCache, CACHE_SYSTEM_VERSION } = require('./storage/HistoryCache');
const HistoryTracker = require('./tracker/HistoryTracker');
const HistoricalRetriever = require('./retrieval/HistoricalRetriever');
const HistoryEvaluator = require('./evaluation/HistoryEvaluator');

module.exports = {
  GitHistoryReader,
  LanguageAdapterRegistry,
  defaultRegistry,
  LanguageAdapter,
  PythonAdapter,
  JavaScriptAdapter,
  TypeScriptAdapter,
  JavaAdapter,
  TreeSitterManager,
  FunctionExtractor,
  SymbolRecord,
  HistoryGraph,
  CHANGE_VOCABULARY,
  SimilarityUtils,
  FunctionMatcher,
  HistoryStore,
  HistoryCache,
  CACHE_SYSTEM_VERSION,
  HistoryTracker,
  HistoricalRetriever,
  HistoryEvaluator
};
