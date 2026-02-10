/**
 * Graceful Shutdown Handler
 *
 * Provides coordinated shutdown handling for SIGTERM and SIGINT signals,
 * enabling safe termination of the MCP server with proper cleanup.
 */

export type ShutdownHandler = () => Promise<void> | void;

export interface ShutdownOptions {
  /**
   * Maximum time in milliseconds to wait for handlers to complete
   * @default 30000
   */
  timeout?: number;

  /**
   * Signal to listen for (default: SIGTERM)
   * @default 'SIGTERM'
   */
  signal?: NodeJS.Signals;

  /**
   * Whether to exit the process after handlers complete
   * @default true
   */
  exit?: boolean;

  /**
   * Exit code to use when exiting
   * @default 0
   */
  exitCode?: number;
}

export interface ShutdownState {
  /**
   * Whether shutdown has been initiated
   */
  readonly isShuttingDown: boolean;

  /**
   * Timestamp when shutdown was initiated
   */
  readonly shutdownInitiatedAt?: Date;

  /**
   * Timestamp when shutdown completed
   */
  readonly shutdownCompletedAt?: Date;

  /**
   * Number of handlers executed
   */
  readonly handlersExecuted: number;

  /**
   * Whether shutdown completed successfully
   */
  readonly success: boolean;

  /**
   * Error if shutdown failed
   */
  readonly error?: Error;
}

export interface GracefulShutdown {
  /**
   * Current shutdown state
   */
  readonly state: ShutdownState;

  /**
   * Register a handler to be called during shutdown
   * @param name - Unique identifier for the handler
   * @param handler - Function to execute during shutdown
   * @returns Unsubscribe function
   */
  register(name: string, handler: ShutdownHandler): () => void;

  /**
   * Manually trigger shutdown
   */
  shutdown(): Promise<void>;

  /**
   * Get list of registered handler names
   */
  getRegisteredHandlers(): string[];

  /**
   * Get count of registered handlers
   */
  getHandlerCount(): number;
}

interface RegisteredHandler {
  name: string;
  handler: ShutdownHandler;
  registeredAt: Date;
}

function createShutdownState(initiatedAt: Date): ShutdownState {
  return {
    isShuttingDown: true,
    shutdownInitiatedAt: initiatedAt,
    handlersExecuted: 0,
    success: false,
  };
}

function createCompletedState(
  initiatedAt: Date,
  handlersExecuted: number,
  success: boolean,
  error?: Error
): ShutdownState {
  return {
    isShuttingDown: false,
    shutdownInitiatedAt: initiatedAt,
    shutdownCompletedAt: new Date(),
    handlersExecuted,
    success,
    error,
  };
}

/**
 * Create a graceful shutdown handler instance
 *
 * @example
 * ```typescript
 * const shutdown = createGracefulShutdown({
 *   timeout: 15000,
 *   exitCode: 1
 * });
 *
 * shutdown.register('database', async () => {
 *   await db.close();
 * });
 *
 * shutdown.register('cache', async () => {
 *   await cache.flush();
 * });
 * ```
 */
export function createGracefulShutdown(options: ShutdownOptions = {}): GracefulShutdown {
  const timeout = options.timeout ?? 30000;
  const shouldExit = options.exit ?? true;
  const exitCode = options.exitCode ?? 0;
  const signal = options.signal ?? 'SIGTERM';

  const handlers: Map<string, RegisteredHandler> = new Map();

  let state: ShutdownState = {
    isShuttingDown: false,
    handlersExecuted: 0,
    success: true,
  };

  let shutdownPromise: Promise<void> | null = null;

  const updateState = (newState: Partial<ShutdownState>): void => {
    state = { ...state, ...newState };
  };

  const executeHandlers = async (): Promise<{ executed: number; errors: Error[] }> => {
    const sortedHandlers = Array.from(handlers.values()).sort(
      (a, b) => a.registeredAt.getTime() - b.registeredAt.getTime()
    );

    let executed = 0;
    const errors: Error[] = [];

    for (const { name, handler } of sortedHandlers) {
      const startTime = Date.now();

      try {
        const handlerPromise = handler();

        if (handlerPromise instanceof Promise) {
          const remainingTime = timeout - (Date.now() - startTime);

          if (remainingTime <= 0) {
            throw new Error(`Handler "${name}" timeout exceeded before execution`);
          }

          const timeoutPromise = new Promise<never>((_, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Handler "${name}" exceeded ${timeout}ms timeout`));
            }, Math.max(remainingTime, 1));
          });

          await Promise.race([handlerPromise, timeoutPromise]);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(new Error(`Handler "${name}" failed: ${errorMessage}`));
        continue;
      }

      executed++;
    }

    return { executed, errors };
  };

  const triggerShutdown = async (): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    const initiatedAt = new Date();
    updateState(createShutdownState(initiatedAt));

    shutdownPromise = (async () => {
      try {
        const { executed, errors } = await executeHandlers();

        const firstError = errors.length > 0 ? errors[0] : undefined;

        updateState(
          createCompletedState(initiatedAt, executed, errors.length === 0, firstError)
        );

        if (errors.length > 0) {
          for (const error of errors) {
            console.error(`Shutdown handler error: ${error.message}`);
          }
        }

        if (shouldExit) {
          process.exit(errors.length > 0 ? 1 : exitCode);
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        updateState(
          createCompletedState(
            initiatedAt,
            state.handlersExecuted,
            false,
            errorObj
          )
        );

        if (shouldExit) {
          console.error(`Shutdown failed: ${errorObj.message}`);
          process.exit(1);
        }
      }
    })();

    return shutdownPromise;
  };

  process.on(signal, () => {
    triggerShutdown().catch((error) => {
      console.error(`Shutdown handler error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  return {
    get state() {
      return state;
    },

    register(name: string, handler: ShutdownHandler): () => void {
      if (state.isShuttingDown) {
        throw new Error('Cannot register handlers while shutting down');
      }

      const registered: RegisteredHandler = {
        name,
        handler,
        registeredAt: new Date(),
      };

      handlers.set(name, registered);

      return () => {
        handlers.delete(name);
      };
    },

    async shutdown(): Promise<void> {
      await triggerShutdown();
    },

    getRegisteredHandlers(): string[] {
      return Array.from(handlers.keys());
    },

    getHandlerCount(): number {
      return handlers.size;
    },
  };
}

/**
 * Create a simple shutdown handler with sensible defaults
 *
 * @example
 * ```typescript
 * const cleanup = onShutdown(async () => {
 *   await logger.flush();
 * });
 * ```
 */
export function onShutdown(handler: ShutdownHandler): () => void {
  const shutdown = createGracefulShutdown();

  return shutdown.register(handler.name || 'anonymous', handler);
}
