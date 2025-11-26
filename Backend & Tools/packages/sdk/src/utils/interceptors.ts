import type { InternalRequestOptions } from '../types.js';

export type RequestInterceptor = (
  options: InternalRequestOptions
) => InternalRequestOptions | Promise<InternalRequestOptions>;

export type ResponseInterceptor<T = unknown> = (
  response: T,
  options: InternalRequestOptions
) => T | Promise<T>;

export type ErrorInterceptor = (
  error: unknown,
  options: InternalRequestOptions
) => unknown | Promise<unknown>;

export class InterceptorManager {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  addResponseInterceptor<T = unknown>(interceptor: ResponseInterceptor<T>): () => void {
    this.responseInterceptors.push(interceptor as ResponseInterceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor as ResponseInterceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.errorInterceptors.splice(index, 1);
      }
    };
  }

  async applyRequestInterceptors(
    options: InternalRequestOptions
  ): Promise<InternalRequestOptions> {
    let result = options;
    for (const interceptor of this.requestInterceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  async applyResponseInterceptors<T>(
    response: T,
    options: InternalRequestOptions
  ): Promise<T> {
    let result = response;
    for (const interceptor of this.responseInterceptors) {
      result = (await interceptor(result, options)) as T;
    }
    return result;
  }

  async applyErrorInterceptors(
    error: unknown,
    options: InternalRequestOptions
  ): Promise<unknown> {
    let result = error;
    for (const interceptor of this.errorInterceptors) {
      result = await interceptor(result, options);
    }
    return result;
  }

  clear(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }
}

