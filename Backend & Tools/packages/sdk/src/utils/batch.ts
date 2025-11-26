
export interface BatchItem<TRequest, TResponse> {
  request: TRequest;
  resolve: (value: TResponse) => void;
  reject: (error: unknown) => void;
}

export interface BatchConfig {

  maxSize?: number;

  waitMs?: number;

  continueOnError?: boolean;
}

const DEFAULT_BATCH_CONFIG: Required<BatchConfig> = {
  maxSize: 10,
  waitMs: 100,
  continueOnError: true,
};

export class BatchProcessor<TRequest, TResponse> {
  private queue: BatchItem<TRequest, TResponse>[] = [];
  private timer?: NodeJS.Timeout;
  private config: Required<BatchConfig>;
  private processor: (requests: TRequest[]) => Promise<TResponse[]>;

  constructor(
    processor: (requests: TRequest[]) => Promise<TResponse[]>,
    config: BatchConfig = {}
  ) {
    this.processor = processor;
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  async add(request: TRequest): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.schedule();
    });
  }

  private schedule(): void {

    if (this.queue.length >= this.config.maxSize) {
      this.execute();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.execute();
      }, this.config.waitMs);
    }
  }

  private async execute(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.config.maxSize);
    const requests = batch.map((item) => item.request);

    try {
      const responses = await this.processor(requests);

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const response = responses[i];
        if (response !== undefined) {
          item.resolve(response);
        } else if (this.config.continueOnError) {
          item.reject(new Error('No response received for batch item'));
        } else {
          throw new Error('No response received for batch item');
        }
      }
    } catch (error) {

      if (!this.config.continueOnError) {
        batch.forEach((item) => item.reject(error));
      } else {

        batch.forEach((item) => {

          item.reject(error);
        });
      }
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    while (this.queue.length > 0) {
      await this.execute();
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

