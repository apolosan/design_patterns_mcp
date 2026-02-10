export type ReadyStatus = "pending" | "ready" | "timeout";

export interface ReadinessState {
  status: ReadyStatus;
  readyAt?: Date;
  pendingSince: Date;
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export interface InitializeOptions {
  timeoutMs?: number;
}

export class StartupReadiness {
  private state: ReadinessState;
  private readyCallbacks: Array<() => void> = [];
  private readyPromise?: Promise<void>;
  private readyResolve?: () => void;
  private readyReject?: (error: Error) => void;
  private initializationPromise?: Promise<void>;
  private initializationResolve?: () => void;
  private initializationReject?: (error: Error) => void;

  constructor() {
    this.state = {
      status: "pending",
      pendingSince: new Date(),
    };
  }

  public markAsReady(): void {
    if (this.state.status === "ready") {
      return;
    }

    this.state = {
      status: "ready",
      readyAt: new Date(),
      pendingSince: this.state.pendingSince,
    };

    if (this.readyResolve) {
      this.readyResolve();
    }

    for (const callback of this.readyCallbacks) {
      try {
        callback();
      } catch {
      }
    }

    this.readyCallbacks = [];
  }

  public markAsFailed(error: Error): void {
    const shouldReject = this.state.status !== "ready";

    this.state = {
      status: "pending",
      pendingSince: new Date(),
    };

    if (shouldReject && this.readyReject) {
      this.readyReject(error);
    }

    this.readyPromise = undefined;
    this.readyResolve = undefined;
    this.readyReject = undefined;
  }

  public isReady(): boolean {
    return this.state.status === "ready";
  }

  public getStatus(): Readonly<ReadinessState> {
    return { ...this.state };
  }

  public async waitForReady(options?: WaitOptions): Promise<void> {
    if (this.state.status === "ready") {
      return;
    }

    const timeoutMs = options?.timeoutMs ?? Infinity;
    const intervalMs = options?.intervalMs ?? 100;

    if (!this.readyPromise) {
      this.readyPromise = new Promise((resolve, reject) => {
        this.readyResolve = resolve;
        this.readyReject = reject;
      });
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Startup readiness timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const checkIntervalPromise = new Promise<void>((resolve) => {
      const intervalId = setInterval(() => {
        if (this.state.status === "ready") {
          clearInterval(intervalId);
          resolve();
        }
      }, intervalMs);
    });

    await Promise.race([this.readyPromise, checkIntervalPromise, timeoutPromise]);
  }

  public async initialize(
    initializer: () => Promise<void> | void,
    options?: InitializeOptions
  ): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    const timeoutMs = options?.timeoutMs ?? 30000;

    this.initializationPromise = new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Initialization timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = initializer();

        if (result instanceof Promise) {
          await result;
        }

        clearTimeout(timeoutId);
        this.markAsReady();
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);
        this.markAsFailed(error instanceof Error ? error : new Error(String(error)));
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  public onReady(callback: () => void): void {
    if (this.state.status === "ready") {
      callback();
      return;
    }

    this.readyCallbacks.push(callback);
  }

  public reset(): void {
    this.state = {
      status: "pending",
      pendingSince: new Date(),
    };

    this.readyPromise = undefined;
    this.readyResolve = undefined;
    this.readyReject = undefined;

    this.initializationPromise = undefined;
    this.initializationResolve = undefined;
    this.initializationReject = undefined;

    this.readyCallbacks = [];
  }

  public getPendingDurationMs(): number {
    if (this.state.status === "pending") {
      return Date.now() - this.state.pendingSince.getTime();
    }

    if (this.state.readyAt) {
      return this.state.readyAt.getTime() - this.state.pendingSince.getTime();
    }

    return 0;
  }
}

export function createStartupReadiness(): StartupReadiness {
  return new StartupReadiness();
}
