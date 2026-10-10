const FunctionMatcher = require('../matcher/FunctionMatcher');
const SymbolRecord = require('../model/SymbolRecord');

class HistoryEvaluator {
  constructor(matcher = new FunctionMatcher()) {
    this.matcher = matcher;
  }

  evaluate(dataset) {
    if (!Array.isArray(dataset) || dataset.length === 0) {
      throw new Error('HistoryEvaluator: dataset must be a non-empty array');
    }

    let correctMatches = 0;
    let correctCategories = 0;
    let falseMatches = 0;
    let uncertainCount = 0;
    let totalMatchingTimeMs = 0;

    const byLanguage = {};
    const byCategory = {};

    for (const item of dataset) {
      const lang = item.language;
      const cat = item.category;

      if (!byLanguage[lang]) {
        byLanguage[lang] = { total: 0, correctMatch: 0, correctCategory: 0, falseMatches: 0, uncertain: 0 };
      }
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, correctMatch: 0, correctCategory: 0, falseMatches: 0, uncertain: 0 };
      }

      byLanguage[lang].total++;
      byCategory[cat].total++;

      // Create SymbolRecords
      const currentSymbol = new SymbolRecord({
        ...item.current,
        language: item.language
      });

      const candidates = (item.candidates || []).map(c => new SymbolRecord({
        ...c,
        language: item.language
      }));

      const isNewFile = item.category === 'new' && candidates.length === 0;

      const t0 = process.hrtime.bigint();
      const matchResult = this.matcher.match(currentSymbol, candidates, {
        isNewFile,
        filePath: item.current.filePath
      });
      const t1 = process.hrtime.bigint();
      totalMatchingTimeMs += Number(t1 - t0) / 1e6;

      const predictedSelectedId = matchResult.selected ? matchResult.selected.id : null;
      const predictedCategory = matchResult.changeClassification;

      // Evaluation checks
      const isMatchCorrect = predictedSelectedId === item.expectedSelectedId;
      const isCategoryCorrect = predictedCategory === item.expectedClassification;

      if (isMatchCorrect) {
        correctMatches++;
        byLanguage[lang].correctMatch++;
        byCategory[cat].correctMatch++;
      }

      if (isCategoryCorrect) {
        correctCategories++;
        byLanguage[lang].correctCategory++;
        byCategory[cat].correctCategory++;
      }

      // Check false historical match
      if (item.expectedSelectedId === null && predictedSelectedId !== null) {
        falseMatches++;
        byLanguage[lang].falseMatches++;
        byCategory[cat].falseMatches++;
      }

      if (matchResult.decisionStatus === 'uncertain' || matchResult.decisionStatus === 'no_match') {
        uncertainCount++;
        byLanguage[lang].uncertain++;
        byCategory[cat].uncertain++;
      }
    }

    const total = dataset.length;
    const top1Accuracy = correctMatches / total;
    const categoryAccuracy = correctCategories / total;
    const falseMatchRate = falseMatches / total;
    const uncertainRate = uncertainCount / total;
    const avgLatencyMs = totalMatchingTimeMs / total;

    // Compute metrics grouped by language
    const languageBreakdown = {};
    for (const [lang, stats] of Object.entries(byLanguage)) {
      languageBreakdown[lang] = {
        total: stats.total,
        top1Accuracy: (stats.correctMatch / stats.total) * 100,
        categoryAccuracy: (stats.correctCategory / stats.total) * 100,
        falseMatchRate: (stats.falseMatches / stats.total) * 100,
        uncertainRate: (stats.uncertain / stats.total) * 100
      };
    }

    // Compute metrics grouped by category
    const categoryBreakdown = {};
    for (const [category, stats] of Object.entries(byCategory)) {
      categoryBreakdown[category] = {
        total: stats.total,
        top1Accuracy: (stats.correctMatch / stats.total) * 100,
        categoryAccuracy: (stats.correctCategory / stats.total) * 100,
        falseMatchRate: (stats.falseMatches / stats.total) * 100
      };
    }

    return {
      totalExamples: total,
      top1AccuracyPercent: (top1Accuracy * 100).toFixed(2),
      categoryAccuracyPercent: (categoryAccuracy * 100).toFixed(2),
      falseHistoricalMatchRatePercent: (falseMatchRate * 100).toFixed(2),
      uncertainRatePercent: (uncertainRate * 100).toFixed(2),
      avgLatencyMs: avgLatencyMs.toFixed(3),
      byLanguage: languageBreakdown,
      byCategory: categoryBreakdown
    };
  }
}

module.exports = HistoryEvaluator;
