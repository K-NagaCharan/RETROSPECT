const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { HistoryGraph } = require('../model/HistoryGraph');

class HistoryStore {
  constructor(storageDir) {
    this.storageDir = storageDir;
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getGraphPath(repoKey, commitHash) {
    const safeKey = repoKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${safeKey}_${commitHash}.jsonl`);
  }

  getMetadataPath(repoKey) {
    const safeKey = repoKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${safeKey}_metadata.json`);
  }

  /**
   * Save graph to JSONL using atomic write
   */
  async saveGraph(repoKey, commitHash, graph) {
    const filePath = this.getGraphPath(repoKey, commitHash);
    const tempPath = `${filePath}.${Date.now()}.tmp`;

    const records = graph.toRecords();
    const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';

    await fs.promises.writeFile(tempPath, content, 'utf8');
    await fs.promises.rename(tempPath, filePath);

    // Save metadata
    const metaPath = this.getMetadataPath(repoKey);
    const metaTemp = `${metaPath}.${Date.now()}.tmp`;
    const metadata = {
      repoKey,
      lastCommit: commitHash,
      updatedAt: new Date().toISOString(),
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.length,
      ...graph.metadata
    };
    await fs.promises.writeFile(metaTemp, JSON.stringify(metadata, null, 2), 'utf8');
    await fs.promises.rename(metaTemp, metaPath);
  }

  /**
   * Load graph from JSONL with resilience against corrupted lines
   */
  async loadGraph(repoKey, commitHash) {
    const filePath = this.getGraphPath(repoKey, commitHash);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const records = [];
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = JSON.parse(trimmed);
        records.push(record);
      } catch (err) {
        // Skip corrupted lines gracefully
        console.warn(`[HistoryStore] Skipping corrupted record line in ${filePath}`);
      }
    }

    return HistoryGraph.fromRecords(records);
  }

  /**
   * Query full predecessor chain for a given function version
   */
  async getFunctionHistory(repoKey, commitHash, versionId, maxDepth = 50) {
    const graph = await this.loadGraph(repoKey, commitHash);
    if (!graph) return null;

    const history = [];
    let currentId = versionId;
    let depth = 0;

    const startNode = graph.getNode(currentId);
    if (!startNode) return null;
    history.push({ node: startNode, edge: null });

    while (depth < maxDepth) {
      const preds = graph.getPredecessors(currentId);
      if (!preds || preds.length === 0) break;

      // Pick top predecessor
      const next = preds[0];
      history.push({ node: next.node, edge: next.edge });
      currentId = next.node.versionId;
      depth++;

      // Stop if reached origin 'new' or boundary
      if (next.edge.changeClassification === 'new') break;
    }

    return history;
  }
}

module.exports = HistoryStore;
