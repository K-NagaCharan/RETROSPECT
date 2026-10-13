const { indexRepository } = require('../src/structural');
const path = require('path');

async function main() {
  const repos = [
    { name: 'bottle', lang: 'Python', path: path.resolve(__dirname, '../data/external_repos/bottle') },
    { name: 'express', lang: 'JavaScript', path: path.resolve(__dirname, '../data/external_repos/express') },
    { name: 'zod', lang: 'TypeScript', path: path.resolve(__dirname, '../data/external_repos/zod') },
    { name: 'gson', lang: 'Java', path: path.resolve(__dirname, '../data/external_repos/gson') }
  ];

  console.log('Indexing Authentic External Repositories:\n');

  for (const r of repos) {
    const t0 = Date.now();
    try {
      const idx = await indexRepository(r.path, { forceRebuild: true });
      const dt = Date.now() - t0;
      
      // Count symbol kinds
      const kindCounts = {};
      for (const sym of idx.symbols.values()) {
        kindCounts[sym.symbolType] = (kindCounts[sym.symbolType] || 0) + 1;
      }

      console.log(`Repository: ${r.name} (${r.lang})`);
      console.log(`  Path: ${r.path}`);
      console.log(`  Indexing Time: ${dt} ms`);
      console.log(`  Indexed Files: ${idx.files.size}`);
      console.log(`  Extracted Symbols: ${idx.symbols.size}`);
      console.log(`  Symbol Kinds: ${JSON.stringify(kindCounts)}`);
      console.log(`  Exact Names Indexed: ${idx.exactNameIndex.size}`);
      console.log(`  Inverted Index Terms: ${idx.invertedIndex.size}`);
      console.log(`  Call Graph Callers: ${idx.callGraph.forward.size}`);
      console.log('----------------------------------------------------');
    } catch (err) {
      console.error(`Failed to index ${r.name}:`, err);
    }
  }
}

main().catch(console.error);
