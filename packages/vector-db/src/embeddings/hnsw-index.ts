/**
 * HNSW (Hierarchical Navigable Small World) Vector Index
 * In-memory implementation for fast approximate nearest neighbor search
 */

import { LocalEmbeddings } from './local-embeddings.js';

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  distance: number;
}

export interface HNSWConfig {
  dimensions: number;
  maxElements: number;
  efConstruction: number;
  M: number;
  efSearch: number;
}

interface HNSWNode {
  id: string;
  vector: number[];
  level: number;
  neighbors: Map<number, Set<string>>; // level -> neighbor ids
}

export class HNSWIndex {
  private config: HNSWConfig;
  private nodes: Map<string, HNSWNode>;
  private documents: Map<string, VectorDocument>;
  private entryPoint: string | null;
  private maxLevel: number;
  private embeddings: LocalEmbeddings;

  constructor(config: Partial<HNSWConfig> = {}) {
    this.config = {
      dimensions: config.dimensions || 256,
      maxElements: config.maxElements || 100000,
      efConstruction: config.efConstruction || 200,
      M: config.M || 16,
      efSearch: config.efSearch || 100,
    };

    this.nodes = new Map();
    this.documents = new Map();
    this.entryPoint = null;
    this.maxLevel = 0;
    this.embeddings = new LocalEmbeddings({ dimensions: this.config.dimensions });
  }

  /**
   * Calculate random level for new node using exponential distribution
   */
  private getRandomLevel(): number {
    let level = 0;
    while (Math.random() < (1 / this.config.M) && level < 16) {
      level++;
    }
    return level;
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private distance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Search for nearest neighbors at a specific level
   */
  private searchLayer(
    query: number[],
    entryPoints: Set<string>,
    ef: number,
    level: number
  ): Map<string, number> {
    const visited = new Set<string>();
    const candidates = new Map<string, number>(); // id -> distance
    const results = new Map<string, number>();

    // Initialize with entry points
    for (const ep of entryPoints) {
      const node = this.nodes.get(ep);
      if (!node) continue;

      const dist = this.distance(query, node.vector);
      candidates.set(ep, dist);
      results.set(ep, dist);
      visited.add(ep);
    }

    while (candidates.size > 0) {
      // Get closest candidate
      let closestId: string | null = null;
      let closestDist = Infinity;

      for (const [id, dist] of candidates) {
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      }

      if (!closestId) break;
      candidates.delete(closestId);

      // Get furthest result
      let furthestDist = 0;
      for (const dist of results.values()) {
        if (dist > furthestDist) furthestDist = dist;
      }

      if (closestDist > furthestDist && results.size >= ef) break;

      // Explore neighbors
      const node = this.nodes.get(closestId);
      if (!node) continue;

      const neighbors = node.neighbors.get(level) || new Set();
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const dist = this.distance(query, neighborNode.vector);

        // Update furthest distance
        furthestDist = 0;
        for (const d of results.values()) {
          if (d > furthestDist) furthestDist = d;
        }

        if (results.size < ef || dist < furthestDist) {
          candidates.set(neighborId, dist);
          results.set(neighborId, dist);

          if (results.size > ef) {
            // Remove furthest
            let furthestId: string | null = null;
            let maxDist = 0;
            for (const [id, d] of results) {
              if (d > maxDist) {
                maxDist = d;
                furthestId = id;
              }
            }
            if (furthestId) results.delete(furthestId);
          }
        }
      }
    }

    return results;
  }

  /**
   * Select neighbors using simple greedy selection
   */
  private selectNeighbors(
    _query: number[],
    candidates: Map<string, number>,
    M: number
  ): Set<string> {
    const sorted = [...candidates.entries()].sort((a, b) => a[1] - b[1]);
    return new Set(sorted.slice(0, M).map(([id]) => id));
  }

  /**
   * Add a document to the index
   */
  async add(document: Omit<VectorDocument, 'embedding'>): Promise<VectorDocument> {
    // Generate embedding if not provided
    const embeddingResult = await this.embeddings.embed(document.content);
    const vector = embeddingResult.embedding;

    const fullDocument: VectorDocument = {
      ...document,
      embedding: vector,
    };

    // Store document
    this.documents.set(document.id, fullDocument);

    // Create HNSW node
    const level = this.getRandomLevel();
    const node: HNSWNode = {
      id: document.id,
      vector,
      level,
      neighbors: new Map(),
    };

    // Initialize neighbor sets for all levels
    for (let l = 0; l <= level; l++) {
      node.neighbors.set(l, new Set());
    }

    this.nodes.set(document.id, node);

    // If first node, set as entry point
    if (!this.entryPoint) {
      this.entryPoint = document.id;
      this.maxLevel = level;
      return fullDocument;
    }

    // Find entry point at max level
    let currentEntry = new Set([this.entryPoint]);

    // Traverse from max level down to node's level + 1
    for (let l = this.maxLevel; l > level; l--) {
      const nearest = this.searchLayer(vector, currentEntry, 1, l);
      if (nearest.size > 0) {
        const [closestId] = [...nearest.entries()].sort((a, b) => a[1] - b[1])[0];
        currentEntry = new Set([closestId]);
      }
    }

    // For each level from node's level down to 0
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const candidates = this.searchLayer(
        vector,
        currentEntry,
        this.config.efConstruction,
        l
      );

      // Select neighbors
      const neighbors = this.selectNeighbors(vector, candidates, this.config.M);
      node.neighbors.set(l, neighbors);

      // Add bidirectional connections
      for (const neighborId of neighbors) {
        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const neighborNeighbors = neighborNode.neighbors.get(l) || new Set();
        neighborNeighbors.add(document.id);

        // Prune if too many neighbors
        if (neighborNeighbors.size > this.config.M * 2) {
          const neighborCandidates = new Map<string, number>();
          for (const nId of neighborNeighbors) {
            const nNode = this.nodes.get(nId);
            if (nNode) {
              neighborCandidates.set(nId, this.distance(neighborNode.vector, nNode.vector));
            }
          }
          neighborNode.neighbors.set(
            l,
            this.selectNeighbors(neighborNode.vector, neighborCandidates, this.config.M * 2)
          );
        } else {
          neighborNode.neighbors.set(l, neighborNeighbors);
        }
      }

      currentEntry = neighbors;
    }

    // Update entry point if new node has higher level
    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPoint = document.id;
    }

    return fullDocument;
  }

  /**
   * Search for similar documents
   */
  async search(query: string, k: number = 10): Promise<SearchResult[]> {
    if (!this.entryPoint || this.nodes.size === 0) {
      return [];
    }

    // Generate query embedding
    const embeddingResult = await this.embeddings.embed(query);
    const queryVector = embeddingResult.embedding;

    // Find entry point
    let currentEntry = new Set([this.entryPoint]);

    // Traverse from max level down to level 1
    for (let l = this.maxLevel; l > 0; l--) {
      const nearest = this.searchLayer(queryVector, currentEntry, 1, l);
      if (nearest.size > 0) {
        const [closestId] = [...nearest.entries()].sort((a, b) => a[1] - b[1])[0];
        currentEntry = new Set([closestId]);
      }
    }

    // Search at level 0
    const candidates = this.searchLayer(
      queryVector,
      currentEntry,
      Math.max(k, this.config.efSearch),
      0
    );

    // Sort by distance and return top k
    const sorted = [...candidates.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, k);

    return sorted.map(([id, distance]) => {
      const document = this.documents.get(id)!;
      const score = 1 / (1 + distance); // Convert distance to similarity score
      return { document, score, distance };
    });
  }

  /**
   * Remove a document from the index
   */
  async remove(id: string): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from neighbors' lists
    for (const [level, neighbors] of node.neighbors) {
      for (const neighborId of neighbors) {
        const neighborNode = this.nodes.get(neighborId);
        if (neighborNode) {
          const neighborNeighbors = neighborNode.neighbors.get(level);
          if (neighborNeighbors) {
            neighborNeighbors.delete(id);
          }
        }
      }
    }

    // Remove node and document
    this.nodes.delete(id);
    this.documents.delete(id);

    // Update entry point if necessary
    if (this.entryPoint === id) {
      if (this.nodes.size > 0) {
        // Find new entry point with highest level
        let maxLevel = 0;
        let newEntry: string | null = null;
        for (const [nodeId, n] of this.nodes) {
          if (n.level >= maxLevel) {
            maxLevel = n.level;
            newEntry = nodeId;
          }
        }
        this.entryPoint = newEntry;
        this.maxLevel = maxLevel;
      } else {
        this.entryPoint = null;
        this.maxLevel = 0;
      }
    }

    return true;
  }

  /**
   * Get a document by ID
   */
  get(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Get all documents
   */
  getAll(): VectorDocument[] {
    return [...this.documents.values()];
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalDocuments: number;
    maxLevel: number;
    dimensions: number;
    memoryUsage: number;
  } {
    const memoryUsage = this.nodes.size * (this.config.dimensions * 8 + 200);
    return {
      totalDocuments: this.documents.size,
      maxLevel: this.maxLevel,
      dimensions: this.config.dimensions,
      memoryUsage,
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.nodes.clear();
    this.documents.clear();
    this.entryPoint = null;
    this.maxLevel = 0;
  }

  /**
   * Export index data for persistence
   */
  export(): {
    documents: VectorDocument[];
    config: HNSWConfig;
  } {
    return {
      documents: [...this.documents.values()],
      config: this.config,
    };
  }

  /**
   * Import index data
   */
  async import(data: { documents: VectorDocument[]; config?: HNSWConfig }): Promise<void> {
    this.clear();
    
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }

    for (const doc of data.documents) {
      await this.add(doc);
    }
  }
}

export default HNSWIndex;
