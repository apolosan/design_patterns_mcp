/**
 * Progress Tracker
 * Implements progress notifications for long-running operations
 * Micro-improvement: User feedback for extended operations
 */

export enum ProgressState {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ProgressStep {
  name: string;
  weight: number;
  completed: boolean;
  startTime?: number;
  endTime?: number;
  message?: string;
}

export interface ProgressConfig {
  totalSteps: number;
  defaultStepWeight: number;
  autoStart: boolean;
  enableTiming: boolean;
}

export interface ProgressEvent {
  state: ProgressState;
  progress: number;
  total: number;
  message?: string;
  currentStep?: string;
  elapsedMs: number;
  estimatedRemainingMs?: number;
}

export interface ProgressTrackerOptions {
  total?: number;
  onProgress?: (event: ProgressEvent) => void;
  onComplete?: (event: ProgressEvent) => void;
  onError?: (error: Error) => void;
}

export class ProgressTracker {
  private steps: ProgressStep[] = [];
  private currentStepIndex: number = 0;
  private startTime: number = 0;
  private state: ProgressState = ProgressState.NOT_STARTED;
  private config: ProgressConfig;
  private options: ProgressTrackerOptions;

  constructor(config: Partial<ProgressConfig> = {}, options: ProgressTrackerOptions = {}) {
    this.config = {
      totalSteps: config.totalSteps ?? 10,
      defaultStepWeight: config.defaultStepWeight ?? 1,
      autoStart: config.autoStart ?? false,
      enableTiming: config.enableTiming ?? true
    };
    this.options = options;

    if (this.config.autoStart) {
      this.start();
    }
  }

  start(total?: number): this {
    if (total !== undefined) {
      this.config.totalSteps = total;
    }

    this.steps = [];
    this.currentStepIndex = 0;
    this.startTime = Date.now();
    this.state = ProgressState.IN_PROGRESS;

    for (let i = 0; i < this.config.totalSteps; i++) {
      this.steps.push({
        name: `Step ${i + 1}`,
        weight: this.config.defaultStepWeight,
        completed: false
      });
    }

    this.notifyProgress('Started');
    return this;
  }

  addStep(name: string, weight?: number): this {
    if (this.state !== ProgressState.IN_PROGRESS) {
      throw new Error('Cannot add steps while not in progress');
    }

    this.steps.push({
      name,
      weight: weight ?? this.config.defaultStepWeight,
      completed: false
    });

    this.config.totalSteps = this.steps.length;
    return this;
  }

  completeStep(message?: string): this {
    if (this.state !== ProgressState.IN_PROGRESS) {
      return this;
    }

    if (this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex];
      step.completed = true;
      step.endTime = Date.now();
      step.message = message;
      this.currentStepIndex++;
    }

    this.notifyProgress(message ?? 'Step completed');
    return this;
  }

  setProgress(progress: number, message?: string): this {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    this.notifyProgress(message ?? `Progress: ${progress}%`);
    return this;
  }

  fail(error: Error): this {
    this.state = ProgressState.FAILED;
    this.notifyProgress(`Failed: ${error.message}`);
    this.options.onError?.(error);
    return this;
  }

  cancel(message?: string): this {
    this.state = ProgressState.CANCELLED;
    this.notifyProgress(message ?? 'Cancelled');
    return this;
  }

  complete(): this {
    this.state = ProgressState.COMPLETED;

    const event = this.createEvent('Completed');
    this.options.onComplete?.(event);

    return this;
  }

  private notifyProgress(message?: string): void {
    const event = this.createEvent(message);
    this.options.onProgress?.(event);
  }

  private createEvent(message?: string): ProgressEvent {
    const totalWeight = this.steps.reduce((sum, s) => sum + s.weight, 0);
    const completedWeight = this.steps
      .filter(s => s.completed)
      .reduce((sum, s) => sum + s.weight, 0);

    const progress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
    const elapsedMs = Date.now() - this.startTime;
    const estimatedRemainingMs = progress > 0
      ? Math.round((elapsedMs / progress) * (100 - progress))
      : undefined;

    return {
      state: this.state,
      progress: Math.round(progress),
      total: 100,
      message,
      currentStep: this.currentStepIndex < this.steps.length
        ? this.steps[this.currentStepIndex]?.name
        : undefined,
      elapsedMs,
      estimatedRemainingMs
    };
  }

  getState(): {
    state: ProgressState;
    progress: number;
    currentStep: string | null;
    elapsedSeconds: number;
    steps: Array<{ name: string; completed: boolean; duration?: number }>;
  } {
    const event = this.createEvent();

    return {
      state: this.state,
      progress: event.progress,
      currentStep: event.currentStep ?? null,
      elapsedSeconds: Math.round(event.elapsedMs / 1000),
      steps: this.steps.map(s => ({
        name: s.name,
        completed: s.completed,
        duration: s.endTime && s.startTime ? s.endTime - s.startTime : undefined
      }))
    };
  }

  static createManual(options: ProgressTrackerOptions = {}): ProgressTracker {
    return new ProgressTracker({}, options);
  }

  static async withProgress<T>(
    operation: () => Promise<T>,
    options: ProgressTrackerOptions
  ): Promise<T> {
    const tracker = new ProgressTracker(
      { autoStart: true },
      options
    );

    try {
      const result = await operation();
      tracker.complete();
      return result;
    } catch (error) {
      tracker.fail(error as Error);
      throw error;
    }
  }
}
