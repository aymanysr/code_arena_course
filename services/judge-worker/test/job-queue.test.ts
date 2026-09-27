import { afterEach, describe, expect, it, vi } from "vitest";

const modulePath = "../src/job-queue.js";
const queueOptions = {
  concurrency: 1,
  maxQueueSize: 1,
  queueTimeoutMs: 40,
  executionTimeoutMs: 40,
};

async function loadQueueModule(): Promise<any> {
  let loaded: any;
  try {
    loaded = await import(modulePath);
  } catch {
    loaded = null;
  }
  expect(loaded?.BoundedJobQueue).toBeTypeOf("function");
  return loaded;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("BoundedJobQueue", () => {
  afterEach(() => vi.useRealTimers());

  it("caps active work and rejects jobs after the bounded waiting queue fills", async () => {
    const { BoundedJobQueue, QueueFullError } = await loadQueueModule();
    const queue = new BoundedJobQueue(queueOptions);
    const gate = deferred<string>();
    let active = 0;
    let maxActive = 0;
    const run = (value: string) => queue.run(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      try { return await gate.promise.then(() => value); }
      finally { active--; }
    });

    const first = run("first");
    await Promise.resolve();
    const second = run("second");
    await expect(queue.run(async () => "overflow")).rejects.toBeInstanceOf(QueueFullError);
    gate.resolve("release");

    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(maxActive).toBe(1);
  });

  it("removes a queued job when its queue wait limit expires", async () => {
    const { BoundedJobQueue, QueueWaitTimeoutError } = await loadQueueModule();
    const queue = new BoundedJobQueue({ ...queueOptions, queueTimeoutMs: 20 });
    const gate = deferred<void>();
    const active = queue.run(() => gate.promise);
    await Promise.resolve();
    const waiting = queue.run(async () => "should not start");

    await expect(waiting).rejects.toBeInstanceOf(QueueWaitTimeoutError);
    gate.resolve();
    await expect(active).resolves.toBeUndefined();
    await expect(queue.run(async () => "recovered")).resolves.toBe("recovered");
  });

  it("times out a caller but keeps the slot occupied until the execution settles", async () => {
    const { BoundedJobQueue, QueueExecutionTimeoutError } = await loadQueueModule();
    const queue = new BoundedJobQueue({ ...queueOptions, executionTimeoutMs: 20 });
    const gate = deferred<string>();
    const timed = queue.run(() => gate.promise);
    await Promise.resolve();
    const waiting = queue.run(async () => "recovered");

    await expect(timed).rejects.toBeInstanceOf(QueueExecutionTimeoutError);
    gate.resolve("late result");
    await expect(waiting).resolves.toBe("recovered");
  });

  it("releases capacity after a job rejects", async () => {
    const { BoundedJobQueue } = await loadQueueModule();
    const queue = new BoundedJobQueue(queueOptions);
    await expect(queue.run(async () => { throw new Error("judge failed"); })).rejects.toThrow("judge failed");
    await expect(queue.run(async () => 42)).resolves.toBe(42);
  });
});
