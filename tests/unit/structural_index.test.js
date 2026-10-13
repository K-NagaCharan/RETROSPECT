const fs = require('fs');
const path = require('path');
const os = require('os');
const { StructuralIndex } = require('../../src/structural/index/StructuralIndex');

describe('Structural Index Unit Tests', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-idx-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('indexes multi-language source files and extracts symbols', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'src/math.py'), `
def add(a: int, b: int) -> int:
    """Adds two integers."""
    return a + b
`);
    fs.writeFileSync(path.join(tempDir, 'src/client.ts'), `
export class ApiClient {
  public connect(): boolean {
    return true;
  }
}
`);

    const index = new StructuralIndex();
    await index.build(tempDir);

    expect(index.files.size).toBe(2);
    expect(index.symbols.size).toBeGreaterThanOrEqual(3); // add, ApiClient, connect

    const addSymbol = Array.from(index.symbols.values()).find(s => s.name === 'add');
    expect(addSymbol).toBeDefined();
    expect(addSymbol.language).toBe('python');
    expect(addSymbol.docstring).toContain('Adds two integers');
    expect(addSymbol.range.startLine).toBeGreaterThan(0);

    const clientClass = Array.from(index.symbols.values()).find(s => s.name === 'ApiClient');
    expect(clientClass).toBeDefined();
    expect(clientClass.symbolType).toBe('class');
  });

  test('disambiguates symbols with identical names across different files', async () => {
    fs.mkdirSync(path.join(tempDir, 'pkg1'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'pkg2'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'pkg1/service.py'), 'def process(): pass');
    fs.writeFileSync(path.join(tempDir, 'pkg2/service.py'), 'def process(): pass');

    const index = new StructuralIndex();
    await index.build(tempDir);

    const processSymbols = Array.from(index.symbols.values()).filter(s => s.name === 'process');
    expect(processSymbols.length).toBe(2);
    // Distinct IDs
    expect(processSymbols[0].id).not.toBe(processSymbols[1].id);
    expect(processSymbols[0].filePath).not.toBe(processSymbols[1].filePath);
  });

  test('builds forward and reverse call graph relationships', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src/workflow.js'), `
function stepOne() {
  return 1;
}

function runWorkflow() {
  stepOne();
}
`);

    const index = new StructuralIndex();
    await index.build(tempDir);

    const runSym = Array.from(index.symbols.values()).find(s => s.name === 'runWorkflow');
    expect(runSym).toBeDefined();
    expect(runSym.calls).toContain('stepOne');

    const related = index.getRelatedSymbols(runSym.id);
    expect(related.callees.some(c => c.name === 'stepOne')).toBe(true);

    const stepOneSym = Array.from(index.symbols.values()).find(s => s.name === 'stepOne');
    const stepOneRelated = index.getRelatedSymbols(stepOneSym.id);
    expect(stepOneRelated.callers.some(c => c.name === 'runWorkflow')).toBe(true);
  });

  test('performs incremental reindexing for modified, added, and deleted files', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    const file1 = path.join(tempDir, 'src/first.py');
    const file2 = path.join(tempDir, 'src/second.py');

    fs.writeFileSync(file1, 'def alpha(): pass');
    fs.writeFileSync(file2, 'def beta(): pass');

    const index = new StructuralIndex();
    await index.build(tempDir);
    expect(index.symbols.size).toBe(2);

    // 1. Modify first.py (rename alpha to gamma)
    // Wait small tick to ensure mtime changes
    await new Promise(r => setTimeout(r, 20));
    fs.writeFileSync(file1, 'def gamma(): pass');

    // 2. Delete second.py
    fs.unlinkSync(file2);

    // 3. Add third.py
    const file3 = path.join(tempDir, 'src/third.py');
    fs.writeFileSync(file3, 'def delta(): pass');

    const updateStats = await index.updateIncremental();

    expect(updateStats.modifiedCount).toBe(1);
    expect(updateStats.deletedCount).toBe(1);
    expect(updateStats.addedCount).toBe(1);

    const symbolNames = Array.from(index.symbols.values()).map(s => s.name);
    expect(symbolNames).toContain('gamma');
    expect(symbolNames).toContain('delta');
    expect(symbolNames).not.toContain('alpha');
    expect(symbolNames).not.toContain('beta'); // deleted file leaves no stale symbols
  });

  test('saves and restores index snapshot from disk cleanly', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src/calc.py'), 'def compute(): pass');

    const index = new StructuralIndex();
    await index.build(tempDir);

    const snapPath = path.join(tempDir, 'index.json');
    index.save(snapPath);
    expect(fs.existsSync(snapPath)).toBe(true);

    const loaded = StructuralIndex.load(snapPath);
    expect(loaded.schemaVersion).toBe(index.schemaVersion);
    expect(loaded.symbols.size).toBe(index.symbols.size);
    expect(Array.from(loaded.symbols.values())[0].name).toBe('compute');
  });
});
