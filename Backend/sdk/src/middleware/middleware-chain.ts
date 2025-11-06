import type { Middleware, MiddlewareContext, MiddlewareFunction } from './types';

type MiddlewareWithInsertion = Middleware & { _insertionIndex?: number };

export class MiddlewareChain {

  private middlewares: MiddlewareWithInsertion[] = [];

  private insertionCounter = 0;

  add(middleware: Middleware): void {

    this.middlewares.push({ ...middleware, _insertionIndex: this.insertionCounter++ });


    this.middlewares.sort((a, b) => {

      const orderA = a.config.order ?? 100;

      const orderB = b.config.order ?? 100;

      if (orderA !== orderB) {

        return orderA - orderB;

      }

      return (a._insertionIndex ?? 0) - (b._insertionIndex ?? 0);

    });

  }

  remove(name: string): void {

    this.middlewares = this.middlewares.filter((m) => m.name !== name);

  }

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

  toMiddleware(): MiddlewareFunction {

    return async (context: MiddlewareContext, next: () => Promise<void>): Promise<void> => {

      await this.execute(context);

      await next();

    };

  }

  clear(): void {

    this.middlewares = [];

    this.insertionCounter = 0;

  }

  getMiddlewares(): readonly Middleware[] {

    return this.middlewares.map(({ _insertionIndex, ...middleware }) => middleware);

  }

}

