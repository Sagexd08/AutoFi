import {
    UserAction,
    ActionType,
    MarketCondition,
    ModelMetadata,
} from './types';

type Tensor = any;
type LayersModel = any;

/**
 * IntentModel - TensorFlow.js based ML model for intent prediction
 * 
 * Uses a feedforward neural network to classify user intents
 * based on contextual features.
 */
export class IntentModel {
    private model: LayersModel | null = null;
    private tf: any = null;
    private isInitialized = false;
    private metadata: ModelMetadata | null = null;

    // Feature normalization parameters
    private featureMeans: number[] = [];
    private featureStds: number[] = [];

    // Action type mapping
    private actionTypeToIndex: Map<ActionType, number> = new Map();
    private indexToActionType: Map<number, ActionType> = new Map();

    constructor() {
        // Initialize action type mappings
        const actionTypes = Object.values(ActionType);
        actionTypes.forEach((type, index) => {
            this.actionTypeToIndex.set(type, index);
            this.indexToActionType.set(index, type);
        });
    }

    /**
     * Initialize TensorFlow.js
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.tf = await import('@tensorflow/tfjs-node').catch(() => null);

            if (this.tf) {
                await this.buildModel();
            }
            
            this.isInitialized = true;
        } catch (error) {
            this.isInitialized = true;
        }
    }

    /**
     * Build the neural network model
     */
    private async buildModel(): Promise<void> {
        if (!this.tf) return;

        const tf = this.tf;
        const numFeatures = 12; // See extractFeatures
        const numClasses = Object.values(ActionType).length;

        this.model = tf.sequential({
            layers: [
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    inputShape: [numFeatures],
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu',
                }),
                tf.layers.dropout({ rate: 0.1 }),
                tf.layers.dense({
                    units: numClasses,
                    activation: 'softmax',
                }),
            ],
        });

        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy'],
        });
    }

    /**
     * Extract features from a user action for model input
     */
    extractFeatures(action: Partial<UserAction>, marketCondition?: MarketCondition): number[] {
        const now = new Date();
        
        return [
            // Time features (cyclical encoding)
            Math.sin(2 * Math.PI * (action.hourOfDay ?? now.getHours()) / 24),
            Math.cos(2 * Math.PI * (action.hourOfDay ?? now.getHours()) / 24),
            Math.sin(2 * Math.PI * (action.dayOfWeek ?? now.getDay()) / 7),
            Math.cos(2 * Math.PI * (action.dayOfWeek ?? now.getDay()) / 7),
            
            // Amount features
            Math.log10((action.amountUsd ?? 100) + 1) / 6, // Normalized log amount
            
            // Gas features
            (action.gasPrice ?? 30) / 200, // Normalized gas price
            
            // Market condition features
            (marketCondition?.ethPrice ?? 2500) / 5000, // Normalized ETH price
            (marketCondition?.gasPrice ?? 30) / 200, // Normalized market gas
            (marketCondition?.volatilityIndex ?? 50) / 100, // Volatility
            
            // Market trend (one-hot-ish encoding)
            marketCondition?.marketTrend === 'bullish' ? 1 : 0,
            marketCondition?.marketTrend === 'bearish' ? 1 : 0,
            marketCondition?.marketTrend === 'neutral' ? 1 : 0,
        ];
    }

    /**
     * Train the model on user action history
     */
    async train(actions: UserAction[], epochs: number = 50): Promise<{ accuracy: number; loss: number }> {
        if (!this.tf || !this.model) {
            return { accuracy: 0, loss: 0 };
        }

        const tf = this.tf;

        // Prepare training data
        const dataPoints = actions.map(action => ({
            features: this.extractFeatures(action, action.marketCondition),
            label: this.actionTypeToIndex.get(action.actionType) ?? 0,
        }));

        // Calculate normalization parameters
        this.calculateNormalizationParams(dataPoints.map(d => d.features));

        // Normalize features
        const normalizedFeatures = dataPoints.map(d => this.normalizeFeatures(d.features));

        // Convert to tensors
        const xs = tf.tensor2d(normalizedFeatures);
        const ys = tf.oneHot(
            tf.tensor1d(dataPoints.map(d => d.label), 'int32'),
            Object.values(ActionType).length
        );

        // Train
        const history = await this.model.fit(xs, ys, {
            epochs,
            batchSize: 32,
            validationSplit: 0.2,
            shuffle: true,
            callbacks: {
                onEpochEnd: (epoch: number, logs: any) => {
                    if (epoch % 10 === 0) {
                        console.log(`Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, accuracy=${logs.acc.toFixed(4)}`);
                    }
                },
            },
        });

        // Cleanup
        xs.dispose();
        ys.dispose();

        const finalLoss = history.history.loss[epochs - 1] as number;
        const finalAcc = history.history.acc[epochs - 1] as number;

        this.metadata = {
            version: '1.0.0',
            trainedAt: Date.now(),
            dataPoints: actions.length,
            accuracy: finalAcc,
            actionTypes: Object.values(ActionType),
        };

        return { accuracy: finalAcc, loss: finalLoss };
    }

    /**
     * Predict action probabilities for given context
     */
    async predict(
        context: Partial<UserAction>,
        marketCondition?: MarketCondition
    ): Promise<Map<ActionType, number>> {
        const probabilities = new Map<ActionType, number>();

        if (!this.tf || !this.model) {
            // Return mock predictions
            return this.mockPredict(context);
        }

        const tf = this.tf;

        const features = this.extractFeatures(context, marketCondition);
        const normalized = this.normalizeFeatures(features);
        
        const input = tf.tensor2d([normalized]);
        const prediction = this.model.predict(input) as Tensor;
        const probs = await prediction.data();

        input.dispose();
        prediction.dispose();

        Object.values(ActionType).forEach((type, index) => {
            probabilities.set(type, probs[index]);
        });

        return probabilities;
    }

    /**
     * Mock predictions when TensorFlow is not available
     */
    private mockPredict(context: Partial<UserAction>): Map<ActionType, number> {
        const probabilities = new Map<ActionType, number>();
        const hour = context.hourOfDay ?? new Date().getHours();
        const dayOfWeek = context.dayOfWeek ?? new Date().getDay();

        // Simple heuristic-based predictions
        // Morning patterns (6-10 AM) - checking/claiming
        if (hour >= 6 && hour <= 10) {
            probabilities.set(ActionType.CLAIM_REWARDS, 0.35);
            probabilities.set(ActionType.COMPOUND, 0.25);
            probabilities.set(ActionType.SWAP, 0.15);
        }
        // Afternoon (10 AM - 4 PM) - active trading
        else if (hour >= 10 && hour <= 16) {
            probabilities.set(ActionType.SWAP, 0.35);
            probabilities.set(ActionType.PROVIDE_LIQUIDITY, 0.20);
            probabilities.set(ActionType.STAKE, 0.15);
        }
        // Evening (4 PM - 10 PM) - rebalancing
        else if (hour >= 16 && hour <= 22) {
            probabilities.set(ActionType.REBALANCE, 0.30);
            probabilities.set(ActionType.SWAP, 0.25);
            probabilities.set(ActionType.UNSTAKE, 0.15);
        }
        // Night (10 PM - 6 AM) - low activity
        else {
            probabilities.set(ActionType.CLAIM_REWARDS, 0.20);
            probabilities.set(ActionType.TRANSFER, 0.15);
            probabilities.set(ActionType.SWAP, 0.10);
        }

        // Weekend adjustments
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            probabilities.set(ActionType.REBALANCE, (probabilities.get(ActionType.REBALANCE) ?? 0) + 0.15);
        }

        // Fill remaining action types with low probabilities
        Object.values(ActionType).forEach(type => {
            if (!probabilities.has(type)) {
                probabilities.set(type, 0.05);
            }
        });

        // Normalize
        const newTotal = [...probabilities.values()].reduce((a, b) => a + b, 0);
        probabilities.forEach((value, key) => {
            probabilities.set(key, value / newTotal);
        });

        return probabilities;
    }

    /**
     * Calculate normalization parameters from training data
     */
    private calculateNormalizationParams(features: number[][]): void {
        if (features.length === 0) return;

        const numFeatures = features[0].length;
        this.featureMeans = new Array(numFeatures).fill(0);
        this.featureStds = new Array(numFeatures).fill(1);

        // Calculate means
        for (let i = 0; i < numFeatures; i++) {
            const values = features.map(f => f[i]);
            this.featureMeans[i] = values.reduce((a, b) => a + b, 0) / values.length;
        }

        // Calculate standard deviations
        for (let i = 0; i < numFeatures; i++) {
            const values = features.map(f => f[i]);
            const mean = this.featureMeans[i];
            const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
            this.featureStds[i] = Math.sqrt(variance) || 1;
        }
    }

    /**
     * Normalize a feature vector
     */
    private normalizeFeatures(features: number[]): number[] {
        if (this.featureMeans.length === 0) {
            return features; // No normalization params yet
        }

        return features.map((f, i) => (f - this.featureMeans[i]) / this.featureStds[i]);
    }

    /**
     * Save model to file
     */
    async saveModel(path: string): Promise<void> {
        if (!this.model || !this.tf) {
            console.warn('No model to save');
            return;
        }

        await this.model.save(`file://${path}`);
        console.log(`Model saved to ${path}`);
    }

    /**
     * Load model from file
     */
    async loadModel(path: string): Promise<void> {
        if (!this.tf) {
            console.warn('TensorFlow not available');
            return;
        }

        this.model = await this.tf.loadLayersModel(`file://${path}/model.json`);
        console.log(`Model loaded from ${path}`);
    }

    /**
     * Get model metadata
     */
    getMetadata(): ModelMetadata | null {
        return this.metadata;
    }

    /**
     * Dispose of model resources
     */
    dispose(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
    }
}
