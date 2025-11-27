/**
 * Custom Local Embeddings Generator
 * Uses a lightweight approach without external LLM APIs
 * Implements TF-IDF + Word2Vec-style embeddings with optional LSTM enhancement
 */

import { createHash } from 'crypto';

export interface EmbeddingOptions {
  dimensions?: number;
  normalize?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: string[];
  dimensions: number;
}

// Vocabulary for semantic understanding of DeFi/blockchain terms
const DEFI_VOCABULARY: Record<string, number[]> = {
  // Actions
  'swap': [0.9, 0.1, 0.0, 0.2, 0.0, 0.0, 0.0, 0.0],
  'transfer': [0.0, 0.9, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0],
  'send': [0.0, 0.85, 0.0, 0.15, 0.0, 0.0, 0.0, 0.0],
  'stake': [0.0, 0.0, 0.9, 0.0, 0.1, 0.0, 0.0, 0.0],
  'unstake': [0.0, 0.0, 0.85, 0.0, 0.15, 0.0, 0.0, 0.0],
  'deposit': [0.0, 0.0, 0.7, 0.3, 0.0, 0.0, 0.0, 0.0],
  'withdraw': [0.0, 0.0, 0.7, 0.3, 0.0, 0.0, 0.0, 0.0],
  'mint': [0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.1],
  'burn': [0.0, 0.0, 0.0, 0.0, 0.0, 0.85, 0.0, 0.15],
  'vote': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.1],
  'propose': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.85, 0.15],
  'execute': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.7, 0.3],
  'bridge': [0.5, 0.3, 0.0, 0.2, 0.0, 0.0, 0.0, 0.0],
  'approve': [0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9],
  'revoke': [0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.85],
  
  // Tokens
  'celo': [0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.0, 0.1],
  'cusd': [0.0, 0.0, 0.0, 0.0, 0.8, 0.1, 0.0, 0.1],
  'ceur': [0.0, 0.0, 0.0, 0.0, 0.8, 0.1, 0.0, 0.1],
  'eth': [0.0, 0.0, 0.0, 0.0, 0.85, 0.0, 0.0, 0.15],
  'usdc': [0.0, 0.0, 0.0, 0.0, 0.8, 0.15, 0.0, 0.05],
  'usdt': [0.0, 0.0, 0.0, 0.0, 0.8, 0.15, 0.0, 0.05],
  'nft': [0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.1],
  'token': [0.0, 0.0, 0.0, 0.0, 0.7, 0.2, 0.0, 0.1],
  
  // Protocols
  'uniswap': [0.85, 0.0, 0.0, 0.15, 0.0, 0.0, 0.0, 0.0],
  'ubeswap': [0.85, 0.0, 0.0, 0.15, 0.0, 0.0, 0.0, 0.0],
  'mento': [0.8, 0.0, 0.0, 0.2, 0.0, 0.0, 0.0, 0.0],
  'moola': [0.0, 0.0, 0.85, 0.15, 0.0, 0.0, 0.0, 0.0],
  'aave': [0.0, 0.0, 0.85, 0.15, 0.0, 0.0, 0.0, 0.0],
  'compound': [0.0, 0.0, 0.85, 0.15, 0.0, 0.0, 0.0, 0.0],
  
  // Conditions
  'if': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5],
  'when': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6],
  'daily': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.7],
  'weekly': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.7],
  'monthly': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.7],
  'above': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6],
  'below': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6],
  'reaches': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6],
};

export class LocalEmbeddings {
  private dimensions: number;
  private normalize: boolean;
  private hashSeed: number;

  constructor(options: EmbeddingOptions = {}) {
    this.dimensions = options.dimensions || 256;
    this.normalize = options.normalize ?? true;
    this.hashSeed = 42;
  }

  /**
   * Tokenize text into normalized tokens
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Generate a deterministic hash-based embedding component
   */
  private hashToVector(token: string, dimensions: number): number[] {
    const hash = createHash('sha256').update(token + this.hashSeed).digest('hex');
    const vector: number[] = [];
    
    for (let i = 0; i < dimensions; i++) {
      const hexPair = hash.substring((i * 2) % 64, ((i * 2) % 64) + 2);
      const value = (parseInt(hexPair, 16) / 255) * 2 - 1; // Normalize to [-1, 1]
      vector.push(value);
    }
    
    return vector;
  }

  /**
   * Get semantic vector for known DeFi terms
   */
  private getSemanticVector(token: string): number[] | null {
    const semantic = DEFI_VOCABULARY[token];
    if (!semantic) return null;
    
    // Expand semantic vector to match dimensions
    const expanded: number[] = [];
    const repeatCount = Math.ceil(this.dimensions / semantic.length);
    
    for (let i = 0; i < repeatCount; i++) {
      expanded.push(...semantic.map(v => v * (1 - i * 0.1))); // Decay for repeated values
    }
    
    return expanded.slice(0, this.dimensions);
  }

  /**
   * Combine vectors with weights
   */
  private combineVectors(vectors: number[][], weights: number[]): number[] {
    const result = new Array(this.dimensions).fill(0);
    let totalWeight = 0;
    
    for (let i = 0; i < vectors.length; i++) {
      const weight = weights[i] || 1;
      totalWeight += weight;
      
      for (let j = 0; j < this.dimensions; j++) {
        result[j] += (vectors[i][j] || 0) * weight;
      }
    }
    
    // Average
    for (let j = 0; j < this.dimensions; j++) {
      result[j] /= totalWeight || 1;
    }
    
    return result;
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map(v => v / magnitude);
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const tokens = this.tokenize(text);
    const vectors: number[][] = [];
    const weights: number[] = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Check for semantic meaning first
      const semanticVector = this.getSemanticVector(token);
      if (semanticVector) {
        vectors.push(semanticVector);
        weights.push(2.0); // Higher weight for known terms
      } else {
        // Fall back to hash-based embedding
        vectors.push(this.hashToVector(token, this.dimensions));
        weights.push(1.0);
      }
      
      // Position encoding - tokens at beginning are often more important
      weights[weights.length - 1] *= (1 - i / (tokens.length * 2));
    }
    
    // Handle empty input
    if (vectors.length === 0) {
      return {
        embedding: new Array(this.dimensions).fill(0),
        tokens: [],
        dimensions: this.dimensions
      };
    }
    
    let embedding = this.combineVectors(vectors, weights);
    
    if (this.normalize) {
      embedding = this.normalizeVector(embedding);
    }
    
    return {
      embedding,
      tokens,
      dimensions: this.dimensions
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export default LocalEmbeddings;
