/**
 * Regression stress test for the Tree-sitter WASM memory leak (trees and parsers were never freed; the WASM heap
 * filled and the runtime aborted with ExitStatus exit(1), after which every parse in the process failed).
 *
 * For each language, one large real source file (~60 KB) is extracted 6,000 times through the production path
 * (FunctionExtractor.extract), about 360 MB of source per language. Before the fix, the same loop failed well
 * before 6,000 (see the parser-fix deviation note in the evaluation workspace).
 *
 * The files come from local clones (the evaluation repositories). Override the paths with RETROSPECT_STRESS_<LANG>;
 * a language whose file is missing is skipped with a console warning rather than silently passing.
 * Slow (several minutes); run on its own with: npx jest --runInBand tests/stress
 */
const fs = require('fs');
const FunctionExtractor = require('../../src/parser/FunctionExtractor');

const ITERATIONS = 6000;
const FILES = {
  java: process.env.RETROSPECT_STRESS_JAVA || 'D:/clones/guava/guava/src/com/google/common/collect/Synchronized.java',
  python: process.env.RETROSPECT_STRESS_PYTHON || 'D:/clones/black/src/black/__init__.py',
  javascript: process.env.RETROSPECT_STRESS_JAVASCRIPT || 'D:/clones/svelte/packages/svelte/src/compiler/migrate/index.js',
  typescript: process.env.RETROSPECT_STRESS_TYPESCRIPT || 'D:/clones/typeorm/packages/typeorm/src/driver/postgres/PostgresDriver.ts'
};

describe('WASM leak stress: 6,000 extractions per language do not abort', () => {
  for (const [lang, file] of Object.entries(FILES)) {
    const present = fs.existsSync(file);
    (present ? test : test.skip)(`${lang}: ${file}`, async () => {
      const src = fs.readFileSync(file, 'utf8');
      const extractor = new FunctionExtractor();
      const first = await extractor.extract(src, file, lang);
      expect(first.symbols.length).toBeGreaterThan(0);
      const expected = JSON.stringify(first.symbols);
      for (let i = 2; i <= ITERATIONS; i++) {
        const r = await extractor.extract(src, file, lang);
        if (i % 1000 === 0 || i === ITERATIONS) expect(JSON.stringify(r.symbols)).toBe(expected);
      }
    }, 30 * 60 * 1000);
    if (!present) console.warn(`[wasm_leak_stress] ${lang} skipped: ${file} not found (set RETROSPECT_STRESS_${lang.toUpperCase()})`);
  }
});
