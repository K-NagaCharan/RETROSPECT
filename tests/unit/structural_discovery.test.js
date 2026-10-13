const fs = require('fs');
const path = require('path');
const os = require('os');
const RepoDiscoverer = require('../../src/structural/discovery/RepoDiscoverer');

describe('Structural Discovery Unit Tests', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-disc-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('discovers supported files across nested subdirectories', async () => {
    fs.mkdirSync(path.join(tempDir, 'src/nested'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src/main.py'), 'def main(): pass');
    fs.writeFileSync(path.join(tempDir, 'src/nested/app.ts'), 'export function app() {}');
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Readme');

    const discoverer = new RepoDiscoverer();
    const { files, stats } = await discoverer.discover(tempDir);

    expect(files.length).toBe(2);
    const relPaths = files.map(f => f.relativePath);
    expect(relPaths).toContain('src/main.py');
    expect(relPaths).toContain('src/nested/app.ts');
    expect(stats.totalDiscovered).toBe(2);
  });

  test('respects default exclusion rules (.git, node_modules, build outputs)', async () => {
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.git/config.py'), 'secret = 1');

    fs.mkdirSync(path.join(tempDir, 'node_modules/pkg'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'node_modules/pkg/index.js'), 'module.exports = {}');

    fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'dist/bundle.js'), 'var x = 1;');

    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src/valid.js'), 'function valid() {}');

    const discoverer = new RepoDiscoverer();
    const { files, stats } = await discoverer.discover(tempDir);

    expect(files.length).toBe(1);
    expect(files[0].relativePath).toBe('src/valid.js');
    expect(stats.skippedIgnored).toBeGreaterThan(0);
  });

  test('respects repository .gitignore rules', async () => {
    fs.writeFileSync(path.join(tempDir, '.gitignore'), `
# Comments
ignored_folder/
*.generated.py
temp_*.js
`);
    fs.mkdirSync(path.join(tempDir, 'ignored_folder'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'ignored_folder/secret.py'), 'x = 1');
    fs.writeFileSync(path.join(tempDir, 'data.generated.py'), 'data = []');
    fs.writeFileSync(path.join(tempDir, 'temp_worker.js'), 'run();');
    fs.writeFileSync(path.join(tempDir, 'real_service.py'), 'def serve(): pass');

    const discoverer = new RepoDiscoverer();
    const { files } = await discoverer.discover(tempDir);

    expect(files.length).toBe(1);
    expect(files[0].relativePath).toBe('real_service.py');
  });

  test('enforces maxFileSize and maxFiles limits', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    // Write a 2KB file
    const largeContent = 'x = 1\n'.repeat(500);
    fs.writeFileSync(path.join(tempDir, 'src/large.py'), largeContent);
    fs.writeFileSync(path.join(tempDir, 'src/small.py'), 'def small(): pass');

    const discoverer = new RepoDiscoverer({ maxFileSize: 500, maxFiles: 10 });
    const { files, stats } = await discoverer.discover(tempDir);

    expect(files.length).toBe(1);
    expect(files[0].relativePath).toBe('src/small.py');
    expect(stats.skippedSize).toBe(1);
  });

  test('handles empty directory and missing directory gracefully', async () => {
    const discoverer = new RepoDiscoverer();
    const { files } = await discoverer.discover(tempDir);
    expect(files.length).toBe(0);

    await expect(discoverer.discover(path.join(tempDir, 'non_existent'))).rejects.toThrow();
  });
});
