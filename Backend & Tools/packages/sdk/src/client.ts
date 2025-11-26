import { z } from 'zod';
import type {
  InternalRequestOptions,
  NormalizeErrorOptions,
  SDKConfig,
  SDKErrorObject,
} from './types.js';
import {
  withRetry,
  shouldRetryError,
  type RetryConfig,
} from './utils/retry.js';
import { Cache, generateCacheKey } from './utils/cache.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { CircuitBreaker } from './utils/circuit-breaker.js';
import {
  InterceptorManager,
  type RequestInterceptor,
  type ResponseInterceptor,
  type ErrorInterceptor,
} from './utils/interceptors.js';
import { EventEmitter, type SDKEventMap } from './utils/events.js';

const ErrorResponseSchema = z
  .object({
    success: z.boolean().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    errorCode: z.string().optional(),
    code: z.string().optional(),
    status: z.number().optional(),
    statusCode: z.number().optional(),
    reason: z.string().optional(),
    requestId: z.string().optional(),
    traceId: z.string().optional(),
    details: z.unknown().optional(),
  })
  .passthrough();

export class SDKError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(message: string, info?: SDKErrorObject) {
    super(message);
    this.name = 'SDKError';
    this.code = info?.code;
    this.status = info?.status;
    this.details = info?.details;
    this.requestId = info?.requestId;
  }
}

export class SDKHttpClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout?: number;
  private readonly cache?: Cache<unknown>;
  private readonly rateLimiter?: RateLimiter;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly retryConfig?: RetryConfig | false;
  private readonly interceptors: InterceptorManager;
  private readonly events: EventEmitter<SDKEventMap>;

  constructor(config: SDKConfig) {
    if (!config.apiBaseUrl) {
      throw new SDKError('apiBaseUrl is required', {
        code: 'sdk_config_error',
      });
    }

    this.baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.defaultTimeout = config.timeoutMs;
    this.interceptors = new InterceptorManager();
    this.events = new EventEmitter();

    if (config.cache !== false) {
      this.cache = new Cache(config.cache);
    }

    if (config.rateLimit !== false && config.rateLimit) {
      this.rateLimiter = new RateLimiter(config.rateLimit);
    }

    if (config.circuitBreaker !== false) {
      this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    }

    this.retryConfig = config.retry;
  }

  getEvents(): EventEmitter<SDKEventMap> {
    return this.events;
  }

  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    return this.interceptors.addRequestInterceptor(interceptor);
  }

  addResponseInterceptor<T = unknown>(interceptor: ResponseInterceptor<T>): () => void {
    return this.interceptors.addResponseInterceptor(interceptor);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    return this.interceptors.addErrorInterceptor(interceptor);
  }

  getCache(): Cache<unknown> | undefined {
    return this.cache;
  }

  getRateLimiter(): RateLimiter | undefined {
    return this.rateLimiter;
  }

  getCircuitBreaker(): CircuitBreaker | undefined {
    return this.circuitBreaker;
  }

  async request<TResponse>(
    path: string,
    options: InternalRequestOptions = {}
  ): Promise<TResponse> {
    const method = options.method ?? 'GET';
    const cacheKey = this.cache
      ? generateCacheKey(method, path, options.query, options.body)
      : undefined;

    if (this.cache && method === 'GET' && cacheKey) {
      const cached = this.cache.get(cacheKey) as TResponse | undefined;
      if (cached !== undefined) {
        await this.events.emit('cache', { hit: true, key: cacheKey });
        return cached;
      }
      await this.events.emit('cache', { hit: false, key: cacheKey });
    }

    let finalOptions = await this.interceptors.applyRequestInterceptors(options);

    await this.events.emit('request', {
      path,
      method,
      options: finalOptions,
    });

    const executeRequest = async (): Promise<TResponse> => {

      if (this.rateLimiter) {
        await this.rateLimiter.check(path);
        const status = this.rateLimiter.getStatus(path);
        await this.events.emit('rateLimit', {
          key: path,
          status: { remaining: status.remaining, resetAt: status.resetAt },
        });
      }

      if (this.circuitBreaker) {
        const state = this.circuitBreaker.getState();
        await this.events.emit('circuitBreaker', { state });

        return this.circuitBreaker.execute(async () => {
          return this.executeRequest<TResponse>(path, finalOptions);
        });
      }

      return this.executeRequest<TResponse>(path, finalOptions);
    };

    const response = this.retryConfig !== false
      ? await withRetry(executeRequest, {
          ...this.retryConfig,
          shouldRetry: (error, attempt) => {

            this.events.emit('retry', { attempt, error }).catch(() => {});
            const config = this.retryConfig;
            if (config && typeof config === 'object' && config.shouldRetry) {
              return config.shouldRetry(error, attempt);
            }
            return shouldRetryError(error);
          },
        })
      : await executeRequest();

    const finalResponse = await this.interceptors.applyResponseInterceptors(
      response,
      finalOptions
    );

    if (this.cache && method === 'GET' && cacheKey) {
      this.cache.set(cacheKey, finalResponse);
    }

    await this.events.emit('response', {
      path,
      method,
      response: finalResponse,
    });

    return finalResponse;
  }

  private async executeRequest<TResponse>(
    path: string,
    options: InternalRequestOptions
  ): Promise<TResponse> {
    const method = options.method ?? 'GET';
    const url = this.buildUrl(path, options.query);
    const headers = this.buildHeaders(options.headers);

    const body =
      options.body !== undefined
        ? headers['Content-Type'] === 'application/json' || typeof options.body === 'object'
          ? JSON.stringify(options.body)
          : (options.body as string)
        : undefined;

    const controller = new AbortController();
    const timeout =
      options.timeoutMs !== undefined ? options.timeoutMs : this.defaultTimeout;

    let timeoutId: NodeJS.Timeout | undefined;
    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        await this.events.emit('error', { path, method, error });
        throw error;
      }

      if (response.status === 204) {
        return undefined as TResponse;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as TResponse;
      }

      const text = await response.text();
      return text as unknown as TResponse;
    } catch (error) {

      const processedError = await this.interceptors.applyErrorInterceptors(error, options);

      if (processedError instanceof SDKError) {
        throw processedError;
      }

      if (error instanceof SDKError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = new SDKError('Request timed out', {
          code: 'sdk_request_timeout',
        });
        await this.events.emit('error', { path, method, error: timeoutError });
        throw timeoutError;
      }

      const normalizedError = this.normalizeUnknownError(error);
      await this.events.emit('error', { path, method, error: normalizedError });
      throw normalizedError;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.append(key, String(value));
      }
    }

    return url.toString();
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...extra,
    };

    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private async parseError(response: Response): Promise<SDKError> {
    let payload: unknown;

    try {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        payload = { message: await response.text() };
      }
    } catch (parseError) {
      payload = { message: 'Failed to parse error response', details: parseError };
    }

    const parsed = ErrorResponseSchema.safeParse(payload);

    const message =
      parsed.success && parsed.data.error
        ? parsed.data.error
        : parsed.success && parsed.data.message
        ? parsed.data.message
        : typeof payload === 'string'
        ? payload
        : 'Request failed';

    const info: SDKErrorObject = {
      code:
        (parsed.success ? (parsed.data.errorCode || parsed.data.code) : undefined) ??
        'sdk_http_error',
      status:
        (parsed.success ? (parsed.data.status ?? parsed.data.statusCode) : undefined) ??
        response.status,
      details: parsed.success ? parsed.data.details : payload,
      requestId:
        (parsed.success ? (parsed.data.requestId || parsed.data.traceId) : undefined) ||
        response.headers.get('x-request-id') ||
        undefined,
      reason: parsed.success ? parsed.data.reason : undefined,
    };

    return new SDKError(message, info);
  }

  private normalizeUnknownError(error: unknown, options: NormalizeErrorOptions = {}): SDKError {
    if (error instanceof Error) {
      return new SDKError(error.message, {
        code: options.defaultCode ?? 'sdk_unknown_error',
        details: {
          name: error.name,
          stack: error.stack,
        },
      });
    }

    return new SDKError(options.fallbackMessage ?? 'Unknown SDK error', {
      code: options.defaultCode ?? 'sdk_unknown_error',
      details: error,
    });
  }
}
