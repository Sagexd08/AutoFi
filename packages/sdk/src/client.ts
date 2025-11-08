import { z } from 'zod';
import type {
  InternalRequestOptions,
  NormalizeErrorOptions,
  SDKConfig,
  SDKErrorObject,
} from './types.js';

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
  }

  async request<TResponse>(
    path: string,
    options: InternalRequestOptions = {}
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
        throw await this.parseError(response);
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
      if (error instanceof SDKError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new SDKError('Request timed out', {
          code: 'sdk_request_timeout',
        });
      }

      throw this.normalizeUnknownError(error);
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
