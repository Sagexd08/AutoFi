import type { Middleware, MiddlewareContext, MiddlewareFunction } from './types';

/**
 * Internal type for middleware with insertion tracking.
 */
type MiddlewareWithInsertion = Middleware & { _insertionIndex?: number };

/**
 * Middleware chain for executing middleware in order.
 */
export class MiddlewareChain {
  private middlewares: MiddlewareWithInsertion[] = [];
  private insertionCounter = 0;

  /**
   * Adds a middleware to the chain.
   * 
   * @param middleware - Middleware to add
   */
  add(middleware: Middleware): void {
    this.middlewares.push({ ...middleware, _insertionIndex: this.insertionCounter++ });
    // Sort by order (lower numbers first), then by insertion order
    this.middlewares.sort((a, b) => {
      const orderA = a.config.order ?? 100;
      const orderB = b.config.order ?? 100;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a._insertionIndex ?? 0) - (b._insertionIndex ?? 0);
    });
  }

  /**
   * Removes a middleware from the chain.
   * 
   * @param name - Name of middleware to remove
   */
  remove(name: string): void {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
  }

  /**
   * Executes the middleware chain.
   * 
   * @param context - Middleware context
   */
  async execute(context: MiddlewareContext): Promise<void> {
    const enabledMiddlewares = this.middlewares.filter((m) => m.config.enabled !== false);
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= enabledMiddlewares.length) {
        return;
      }

      const middleware = enabledMiddlewares[index++]!;
      await middleware.execute(context, next);
    };

    await next();
  }

  /**
   * Creates a middleware function from the chain.
   */
  toMiddleware(): MiddlewareFunction {
    return async (context: MiddlewareContext, next: () => Promise<void>): Promise<void> => {
      await this.execute(context);
      await next();
    };
  }

  /**
   * Clears all middlewares.
   */
  clear(): void {
    this.middlewares = [];
    this.insertionCounter = 0;
  }

  /**
   * Gets all registered middlewares.
   */
  getMiddlewares(): readonly Middleware[] {
    return this.middlewares.map(({ _insertionIndex, ...middleware }) => middleware);
  }
}
