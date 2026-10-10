const HistoryEvaluator = require('../../src/evaluation/HistoryEvaluator');
const fs = require('fs');
const path = require('path');

describe('HistoryEvaluator Unit Tests', () => {
  const evaluator = new HistoryEvaluator();

  test('Evaluates benchmark dataset and returns valid metric summary', () => {
    const datasetPath = path.resolve(__dirname, '../../src/evaluation/benchmarks/labeled_dataset.json');
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

    const report = evaluator.evaluate(dataset);

    expect(Number(report.totalExamples)).toBe(dataset.length);
    expect(Number(report.top1AccuracyPercent)).toBeGreaterThanOrEqual(90);
    expect(Number(report.categoryAccuracyPercent)).toBeGreaterThanOrEqual(90);
    expect(Number(report.falseHistoricalMatchRatePercent)).toBeLessThan(10);
    expect(report.byLanguage).toHaveProperty('python');
    expect(report.byLanguage).toHaveProperty('javascript');
    expect(report.byLanguage).toHaveProperty('typescript');
    expect(report.byLanguage).toHaveProperty('java');
  });

  test('Rejects invalid dataset input', () => {
    expect(() => evaluator.evaluate([])).toThrow();
    expect(() => evaluator.evaluate(null)).toThrow();
  });
});
