const fs = require('fs');
const dataset = JSON.parse(fs.readFileSync('data/benchmark_lineage.json', 'utf8'));

for (let i = 0; i < dataset.length; i++) {
  const item = dataset[i];
  console.log(`[${i+1}/40] ID: ${item.case_id} | Repo: ${item.repository} (${item.language})`);
  console.log(`  Type: ${item.evolution_type} | ValidPred: ${item.is_valid_predecessor}`);
  console.log(`  Cur:  ${item.current_symbol.name} (${item.current_symbol.symbolType}) @ ${item.current_symbol.commitHash?.slice(0,8)} in ${item.current_symbol.filePath}`);
  console.log(`  Pred: ${item.predecessor_symbol.name} (${item.predecessor_symbol.symbolType}) @ ${item.predecessor_symbol.commitHash?.slice(0,8)} in ${item.predecessor_symbol.filePath}`);
  console.log(`  Rationale: ${item.rationale}`);
  console.log('');
}
