const CHANGE_VOCABULARY = [
  'unchanged',
  'modified',
  'renamed',
  'moved',
  'renamed_and_moved',
  'new',
  'deleted',
  'uncertain'
];

class HistoryGraph {
  constructor(metadata = {}) {
    this.metadata = {
      repository: metadata.repository || '',
      targetCommit: metadata.targetCommit || '',
      createdAt: metadata.createdAt || new Date().toISOString(),
      ...metadata
    };
    this.nodes = new Map(); // versionId -> Node
    this.edges = []; // array of Edge objects
    this._outgoing = new Map(); // sourceId -> array of edges
    this._incoming = new Map(); // targetId -> array of edges
  }

  addNode(node) {
    if (!node || !node.versionId) {
      throw new Error('HistoryGraph: node must have a valid versionId');
    }
    const nodeRecord = {
      type: 'node',
      versionId: node.versionId,
      commitHash: node.commitHash || '',
      filePath: node.filePath || '',
      language: node.language || 'unknown',
      name: node.name || '',
      qualifiedName: node.qualifiedName || node.name,
      normalizedSignature: node.normalizedSignature || '',
      enclosingScope: Array.isArray(node.enclosingScope) ? node.enclosingScope : [],
      range: node.range || {},
      sourceHash: node.sourceHash || '',
      normalizedTokens: Array.isArray(node.normalizedTokens) ? node.normalizedTokens : [],
      extractionStatus: node.extractionStatus || 'success',
      metadata: node.metadata || {}
    };

    this.nodes.set(node.versionId, nodeRecord);
    return nodeRecord;
  }

  addEdge(edge) {
    if (!edge.sourceVersionId || !edge.targetVersionId) {
      throw new Error('HistoryGraph: edge must have sourceVersionId and targetVersionId');
    }

    const classification = CHANGE_VOCABULARY.includes(edge.changeClassification)
      ? edge.changeClassification
      : 'uncertain';

    const edgeRecord = {
      type: 'edge',
      sourceVersionId: edge.sourceVersionId,
      targetVersionId: edge.targetVersionId,
      childCommit: edge.childCommit || '',
      parentCommit: edge.parentCommit || '',
      changeClassification: classification,
      matchingScore: edge.matchingScore ?? 0,
      matchingMethod: edge.matchingMethod || 'unknown',
      evidence: edge.evidence || {},
      confidence: edge.confidence || 'unknown'
    };

    this.edges.push(edgeRecord);

    if (!this._outgoing.has(edge.sourceVersionId)) {
      this._outgoing.set(edge.sourceVersionId, []);
    }
    this._outgoing.get(edge.sourceVersionId).push(edgeRecord);

    if (!this._incoming.has(edge.targetVersionId)) {
      this._incoming.set(edge.targetVersionId, []);
    }
    this._incoming.get(edge.targetVersionId).push(edgeRecord);

    return edgeRecord;
  }

  getNode(versionId) {
    return this.nodes.get(versionId) || null;
  }

  getPredecessorEdges(versionId) {
    // Edge where source is versionId and target is predecessor version in parent commit
    return this._outgoing.get(versionId) || [];
  }

  getSuccessorEdges(versionId) {
    return this._incoming.get(versionId) || [];
  }

  getPredecessors(versionId) {
    const edges = this.getPredecessorEdges(versionId);
    return edges.map(e => ({
      edge: e,
      node: this.getNode(e.targetVersionId)
    })).filter(item => item.node !== null);
  }

  toRecords() {
    const records = [];
    records.push({ type: 'metadata', ...this.metadata });
    for (const node of this.nodes.values()) {
      records.push(node);
    }
    for (const edge of this.edges) {
      records.push(edge);
    }
    return records;
  }

  static fromRecords(records) {
    let metadata = {};
    const graph = new HistoryGraph();

    for (const record of records) {
      if (record.type === 'metadata') {
        const { type, ...rest } = record;
        graph.metadata = rest;
      } else if (record.type === 'node') {
        graph.addNode(record);
      } else if (record.type === 'edge') {
        graph.addEdge(record);
      }
    }
    return graph;
  }
}

module.exports = {
  HistoryGraph,
  CHANGE_VOCABULARY
};
