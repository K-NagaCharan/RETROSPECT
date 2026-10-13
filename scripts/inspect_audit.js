const fs = require('fs');
const report = JSON.parse(fs.readFileSync('data/audit_lineage_report.json', 'utf8'));
for (const r of report) {
  const issues = [];
  if (!r.cur_file_exists) issues.push('cur_file_missing');
  if (!r.cur_symbol_found) issues.push('cur_symbol_missing');
  if (r.pred_hash && !r.pred_file_exists) issues.push('pred_file_missing');
  if (r.pred_hash && r.pred_name && !r.pred_symbol_found) issues.push('pred_symbol_missing');
  if (r.claimed_type !== r.actual_evolution_type) issues.push(`type_changed(${r.claimed_type}->${r.actual_evolution_type})`);
  console.log(`${r.case_id} (${r.repo}): issues=[${issues.join(', ')}] notes=[${r.audit_notes.join('; ')}]`);
}
