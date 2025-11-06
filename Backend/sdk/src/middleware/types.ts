export interface MiddlewareContext {
  request: {
    id: string;
    timestamp: number;
    path?: string;
    metadata?: Record<string, unknown>;
  };
  response?: {
    timestamp: number;
    duration?: number;
    metadata?: Record<string, unknown>;
  };
  error?: unknown;
  [key: string]: unknown;
}
export type MiddlewareFunction = (
  context: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;
export interface MiddlewareConfig {
  enabled: boolean;
  order?: number;
  [key: string]: unknown;
}
export interface Middleware {
  name: string;
  execute: MiddlewareFunction;
  config: MiddlewareConfig;
}
export type RequestInterceptor<T = unknown> = (request: T) => T | Promise<T>;
export type ResponseInterceptor<T = unknown> = (response: T) => T | Promise<T>;
export type ErrorInterceptor = (error: unknown) => unknown | Promise<unknown>;
