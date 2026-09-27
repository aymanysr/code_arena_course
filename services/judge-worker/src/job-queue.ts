export class QueueFullError extends Error {
  constructor() {
    super("judge queue is full");
    this.name = "QueueFullError";
  }
}

export class QueueWaitTimeoutError extends Error {
  constructor() {
    super("judge queue wait timed out");
    this.name = "QueueWaitTimeoutError";
  }
}

export class QueueExecutionTimeoutError extends Error {
  constructor() {
    super("judge job timed out");
    this.name = "QueueExecutionTimeoutError";
  }
}

export interface BoundedJobQueueOptions {
  concurrency: number;
  maxQueueSize: number;
  queueTimeoutMs: number;
  executionTimeoutMs: number;
}

type JobState = "queued" | "active" | "finished";

interface Job<T> {
  work: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  state: JobState;
  callerSettled: boolean;
  queueTimer?: NodeJS.Timeout;
  executionTimer?: NodeJS.Timeout;
}

/**
 * Bounds actual active judge work separately from waiting callers. An active
 * job that times out to its caller keeps its slot until the underlying work
 * really settles, so timeout handling cannot accidentally exceed concurrency.
 */
export class BoundedJobQueue {
  private readonly options: BoundedJobQueueOptions;
  private readonly waiting: Job<unknown>[] = [];
  private active = 0;

  constructor(options: BoundedJobQueueOptions) {
    if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1) {
      throw new RangeError("concurrency must be a positive integer");
    }
    if (!Number.isSafeInteger(options.maxQueueSize) || options.maxQueueSize < 0) {
      throw new RangeError("maxQueueSize must be a non-negative integer");
    }
    if (!Number.isFinite(options.queueTimeoutMs) || options.queueTimeoutMs < 0) {
      throw new RangeError("queueTimeoutMs must be non-negative");
    }
    if (!Number.isFinite(options.executionTimeoutMs) || options.executionTimeoutMs < 1) {
      throw new RangeError("executionTimeoutMs must be positive");
    }
    this.options = options;
  }

  run<T>(work: () => Promise<T> | T): Promise<T> {
    if (this.active < this.options.concurrency) return this.startNow(work);
    if (this.waiting.length >= this.options.maxQueueSize) return Promise.reject(new QueueFullError());

    return new Promise<T>((resolve, reject) => {
      const job: Job<T> = { work, resolve, reject, state: "queued", callerSettled: false };
      job.queueTimer = setTimeout(() => {
        if (job.state !== "queued") return;
        const index = this.waiting.indexOf(job as Job<unknown>);
        if (index >= 0) this.waiting.splice(index, 1);
        job.state = "finished";
        job.callerSettled = true;
        reject(new QueueWaitTimeoutError());
      }, this.options.queueTimeoutMs);
      this.waiting.push(job as Job<unknown>);
    });
  }

  private startNow<T>(work: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const job: Job<T> = { work, resolve, reject, state: "active", callerSettled: false };
      this.active++;
      this.start(job);
    });
  }

  private pump(): void {
    while (this.active < this.options.concurrency && this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (!next || next.state !== "queued") continue;
      if (next.queueTimer) clearTimeout(next.queueTimer);
      next.state = "active";
      this.active++;
      this.start(next);
    }
  }

  private start<T>(job: Job<T>): void {
    job.executionTimer = setTimeout(() => {
      if (job.callerSettled) return;
      job.callerSettled = true;
      job.reject(new QueueExecutionTimeoutError());
    }, this.options.executionTimeoutMs);

    Promise.resolve()
      .then(job.work)
      .then(
        (result) => {
          if (!job.callerSettled) {
            job.callerSettled = true;
            job.resolve(result);
          }
        },
        (error: unknown) => {
          if (!job.callerSettled) {
            job.callerSettled = true;
            job.reject(error instanceof Error ? error : new Error("judge job failed"));
          }
        },
      )
      .finally(() => {
        if (job.executionTimer) clearTimeout(job.executionTimer);
        job.state = "finished";
        this.active--;
        this.pump();
      });
  }
}
