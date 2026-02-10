export interface AsyncQueueOptions {
  concurrency?: number;
  timeout?: number;
  onTaskComplete?: (taskId: string, duration: number) => void;
  onTaskError?: (taskId: string, error: Error) => void;
  onDrain?: () => void;
}

export interface QueuedTask<T = unknown> {
  id: string;
  priority: number;
  executor: () => Promise<T>;
  createdAt: number;
}

export type TaskHandler<T = unknown> = (taskId: string, ...args: unknown[]) => Promise<T>;

export class AsyncQueue<T = unknown> {
  private queue: QueuedTask<T>[] = [];
  private runningCount = 0;
  private isProcessing = false;
  private taskCounter = 0;

  private readonly concurrency: number;
  private readonly timeout?: number;
  private readonly onTaskComplete?: (taskId: string, duration: number) => void;
  private readonly onTaskError?: (taskId: string, error: Error) => void;
  private readonly onDrain?: () => void;

  constructor(options: AsyncQueueOptions = {}) {
    this.concurrency = options.concurrency ?? 1;
    this.timeout = options.timeout;
    this.onTaskComplete = options.onTaskComplete;
    this.onTaskError = options.onTaskError;
    this.onDrain = options.onDrain;
  }

  enqueue(handler: TaskHandler<T>, taskId?: string, priority = 0): Promise<T> {
    const id = taskId ?? `task-${++this.taskCounter}`;

    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = {
        id,
        priority,
        executor: async () => handler(id),
        createdAt: Date.now(),
      };

      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);

      this.processNext(id, resolve, reject);
    });
  }

  enqueueWithArgs<A extends unknown[]>(
    handler: (...args: A) => Promise<T>,
    args: A,
    taskId?: string,
    priority = 0
  ): Promise<T> {
    return this.enqueue(async (tid) => handler(...args), taskId, priority);
  }

  private processNext(id: string, resolve: (value: T) => void, reject: (error: Error) => void): void {
    if (this.runningCount >= this.concurrency) return;
    if (this.queue.length === 0) {
      if (this.onDrain && this.runningCount === 0) {
        this.onDrain();
      }
      return;
    }

    const task = this.queue.shift()!;
    this.runningCount++;

    const startTime = Date.now();

    const executeTask = async (): Promise<void> => {
      try {
        const timeoutMs = this.timeout;
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const taskPromise = (async () => {
          return task.executor();
        })();

        if (timeoutMs) {
          const timeoutPromise = new Promise<never>((_, rejectTimeout) => {
            timeoutHandle = setTimeout(() => rejectTimeout(new Error(`Task ${task.id} timed out after ${timeoutMs}ms`)), timeoutMs);
          });

          await Promise.race([taskPromise, timeoutPromise]);
        } else {
          await taskPromise;
        }

        clearTimeout(timeoutHandle);
        resolve(taskPromise as unknown as T);
        this.onTaskComplete?.(task.id, Date.now() - startTime);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reject(err);
        this.onTaskError?.(task.id, err);
      } finally {
        this.runningCount--;
        if (this.queue.length > 0) {
          const nextTask = this.queue[0]!;
          this.processNext(nextTask.id, resolve, reject);
        } else if (this.onDrain && this.runningCount === 0) {
          this.onDrain();
        }
      }
    };

    executeTask();
  }

  get length(): number {
    return this.queue.length;
  }

  get running(): number {
    return this.runningCount;
  }

  get pending(): number {
    return this.queue.length;
  }

  clear(): void {
    const error = new Error('Queue was cleared');
    for (const task of this.queue) {
      this.queue = [];
    }
    this.queue = [];
  }

  pause(): void {
    this.isProcessing = false;
  }

  resume(): void {
    if (!this.isProcessing) {
      this.isProcessing = true;
    }
  }

  getStats(): { length: number; running: number; pending: number } {
    return {
      length: this.queue.length,
      running: this.runningCount,
      pending: this.queue.length,
    };
  }

  peek(): QueuedTask<T> | undefined {
    return this.queue[0];
  }

  remove(taskId: string): boolean {
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
  }
}

export class PriorityAsyncQueue<T = unknown> extends AsyncQueue<T> {
  enqueueHigh(handler: TaskHandler<T>, taskId?: string): Promise<T> {
    return this.enqueue(handler, taskId, 2);
  }

  enqueueNormal(handler: TaskHandler<T>, taskId?: string): Promise<T> {
    return this.enqueue(handler, taskId, 1);
  }

  enqueueLow(handler: TaskHandler<T>, taskId?: string): Promise<T> {
    return this.enqueue(handler, taskId, 0);
  }
}

export function createAsyncQueue<T = unknown>(options?: AsyncQueueOptions): AsyncQueue<T> {
  return new AsyncQueue<T>(options);
}

export function createPriorityQueue<T = unknown>(options?: AsyncQueueOptions): PriorityAsyncQueue<T> {
  return new PriorityAsyncQueue<T>(options);
}
