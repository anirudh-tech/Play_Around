const tails = new Map<string, Promise<unknown>>();

/** One in-flight task per key. Waiters sit on a JS queue, not on a DB connection. */
export function serializeByKey<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const next = previous.then(work, work);
  tails.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}
