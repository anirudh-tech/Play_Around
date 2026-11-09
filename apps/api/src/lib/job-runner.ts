import type { Logger } from './logger';

export interface Job {
  name: string;
  intervalMs: number;
  run(context: { signal: AbortSignal }): Promise<void>;
}

export interface JobRunner {
  register(job: Job): void;
  start(): void;
  stop(): Promise<void>;
}

/**
 * In-process scheduler. Each job runs at most once at a time. Jobs must lock their rows with
 * `FOR UPDATE SKIP LOCKED` so that several API instances can run them safely.
 */
export function createJobRunner(logger: Logger): JobRunner {
  const jobs: Job[] = [];
  const timers = new Map<string, NodeJS.Timeout>();
  const running = new Map<string, Promise<void>>();
  const controller = new AbortController();
  let started = false;

  function schedule(job: Job) {
    const timer = setTimeout(() => void tick(job), job.intervalMs);
    timer.unref();
    timers.set(job.name, timer);
  }

  async function tick(job: Job) {
    if (controller.signal.aborted) return;
    const startedAt = Date.now();
    const execution = job
      .run({ signal: controller.signal })
      .then(() => logger.debug({ job: job.name, ms: Date.now() - startedAt }, 'job finished'))
      .catch((error: unknown) => logger.error({ err: error, job: job.name }, 'job failed'));
    running.set(job.name, execution);
    await execution;
    running.delete(job.name);
    if (!controller.signal.aborted) schedule(job);
  }

  return {
    register(job) {
      if (jobs.some((existing) => existing.name === job.name)) {
        throw new Error(`Job "${job.name}" is already registered`);
      }
      jobs.push(job);
      if (started) schedule(job);
    },

    start() {
      if (started) return;
      started = true;
      jobs.forEach(schedule);
      logger.info({ jobs: jobs.map((job) => job.name) }, 'job runner started');
    },

    async stop() {
      controller.abort();
      timers.forEach(clearTimeout);
      timers.clear();
      await Promise.allSettled(running.values());
    },
  };
}
