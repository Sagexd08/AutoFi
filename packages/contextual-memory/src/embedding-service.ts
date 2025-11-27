import { ContextualMemoryConfig } from './types';

interface LSTMState {
    h: number[];
    c: number[]; 
}

/**
 * Custom LSTM-based Embedding Service
 * 
 * Uses a pure JavaScript LSTM implementation to generate embeddings
 * without any external LLM providers (OpenAI, Anthropic, etc.)
 */
export class EmbeddingService {
    private embeddingDimension = 256;
    private hiddenSize = 128;
    private vocabSize = 256; 
    private maxSequenceLength = 512;
    private Wf: number[][] = []; 
    private Wi: number[][] = []; 
    private Wc: number[][] = []; 
    private Wo: number[][] = [];
    private bf: number[] = [];   
    private bi: number[] = [];  
    private bc: number[] = [];  
    private bo: number[] = [];   
    private Wp: number[][] = [];
    private bp: number[] = [];

    constructor(_config?: ContextualMemoryConfig) {
        // Config can be used for future customization of LSTM parameters
        this.initializeWeights();
    }

    private initializeWeights(): void {
        const inputSize = this.vocabSize;
        const hiddenSize = this.hiddenSize;
        const scale = Math.sqrt(2.0 / (inputSize + hiddenSize));
        this.Wf = this.createMatrix(hiddenSize, inputSize + hiddenSize, scale, 1);
        this.Wi = this.createMatrix(hiddenSize, inputSize + hiddenSize, scale, 2);
        this.Wc = this.createMatrix(hiddenSize, inputSize + hiddenSize, scale, 3);
        this.Wo = this.createMatrix(hiddenSize, inputSize + hiddenSize, scale, 4);
        this.bf = this.createVector(hiddenSize, 1.0, 5);
        this.bi = this.createVector(hiddenSize, 0.0, 6);
        this.bc = this.createVector(hiddenSize, 0.0, 7);
        this.bo = this.createVector(hiddenSize, 0.0, 8);
        const projScale = Math.sqrt(2.0 / (hiddenSize + this.embeddingDimension));
        this.Wp = this.createMatrix(this.embeddingDimension, hiddenSize, projScale, 9);
        this.Wp = this.createMatrix(this.embeddingDimension, hiddenSize, projScale, 9);
        this.bp = this.createVector(this.embeddingDimension, 0.0, 10);
    }
    private createMatrix(rows: number, cols: number, scale: number, seed: number): number[][] {
        const matrix: number[][] = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                const x = Math.sin(seed * 10000 + i * 1000 + j) * 10000;
                matrix[i][j] = (x - Math.floor(x) - 0.5) * 2 * scale;
            }
        }
        return matrix;
    }

     private createVector(size: number, initValue: number, seed: number): number[] {
        const vector: number[] = [];
        for (let i = 0; i < size; i++) {
            if (initValue !== 0) {
                vector[i] = initValue;
            } else {
                const x = Math.sin(seed * 10000 + i) * 10000;
                vector[i] = (x - Math.floor(x) - 0.5) * 0.1;
            }
        }
        return vector;
    }

    private tokenize(text: string): number[] {
        const tokens: number[] = [];
        const cleanText = text.toLowerCase().slice(0, this.maxSequenceLength);
        
        for (let i = 0; i < cleanText.length; i++) {
            const charCode = cleanText.charCodeAt(i);
            tokens.push(Math.min(charCode, this.vocabSize - 1));
        }
        
        return tokens;
    }
    private oneHotEncode(token: number): number[] {
        const encoded = new Array(this.vocabSize).fill(0);
        encoded[token] = 1;
        return encoded;
    }

        private sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    }

   
    private tanh(x: number): number {
        const clampedX = Math.max(-500, Math.min(500, x));
        const exp2x = Math.exp(2 * clampedX);
        return (exp2x - 1) / (exp2x + 1);
    }

    
    private matVecMul(matrix: number[][], vector: number[]): number[] {
        const result: number[] = new Array(matrix.length).fill(0);
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < vector.length; j++) {
                result[i] += matrix[i][j] * vector[j];
            }
        }
        return result;
    }

   
    private vecAdd(a: number[], b: number[]): number[] {
        return a.map((val, i) => val + b[i]);
    }

    private vecMul(a: number[], b: number[]): number[] {
        return a.map((val, i) => val * b[i]);
    }


    private lstmStep(input: number[], prevState: LSTMState): LSTMState {
        const concat = [...input, ...prevState.h];
        const fGate = this.vecAdd(this.matVecMul(this.Wf, concat), this.bf).map(this.sigmoid);
        const iGate = this.vecAdd(this.matVecMul(this.Wi, concat), this.bi).map(this.sigmoid);
        const cCandidate = this.vecAdd(this.matVecMul(this.Wc, concat), this.bc).map(this.tanh);
        const oGate = this.vecAdd(this.matVecMul(this.Wo, concat), this.bo).map(this.sigmoid);
        const newC = this.vecAdd(
            this.vecMul(fGate, prevState.c),
            this.vecMul(iGate, cCandidate)
        );
        const newH = this.vecMul(oGate, newC.map(this.tanh));
        
        return { h: newH, c: newC };
    }

    async embed(text: string): Promise<number[]> {
        if (!text || text.trim().length === 0) {
            return new Array(this.embeddingDimension).fill(0);
        }
        const tokens = this.tokenize(text);
        
        if (tokens.length === 0) {
            return new Array(this.embeddingDimension).fill(0);
        }
        let state: LSTMState = {
            h: new Array(this.hiddenSize).fill(0),
            c: new Array(this.hiddenSize).fill(0),
        };
        for (const token of tokens) {
            const input = this.oneHotEncode(token);
            state = this.lstmStep(input, state);
        }
        let embedding = this.vecAdd(this.matVecMul(this.Wp, state.h), this.bp);
        embedding = embedding.map(this.tanh);
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            embedding = embedding.map(val => val / magnitude);
        }

        return embedding;
    }
    async embedBatch(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(t => this.embed(t)));
    }


    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Embeddings must have same dimension');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 0 ? dotProduct / denom : 0;
    }

    /**
     * Find most similar embeddings
     */
    findMostSimilar(
        query: number[],
        candidates: { id: string; embedding: number[] }[],
        topK: number = 10
    ): { id: string; similarity: number }[] {
        const similarities = candidates.map(c => ({
            id: c.id,
            similarity: this.cosineSimilarity(query, c.embedding),
        }));

        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    /**
     * Get embedding dimension
     */
    getDimension(): number {
        return this.embeddingDimension;
    }

    /**
     * Get model info
     */
    getModelInfo(): { type: string; dimension: number; hiddenSize: number; vocabSize: number } {
        return {
            type: 'custom-lstm',
            dimension: this.embeddingDimension,
            hiddenSize: this.hiddenSize,
            vocabSize: this.vocabSize,
        };
    }
}
