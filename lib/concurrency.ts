/** Runs `worker` over every item with at most `limit` running at once - used so a bulk
 *  upload of 50+ papers doesn't grade strictly one-at-a-time, which would waste the whole
 *  point of having multiple failover accounts available. Each paper still goes through its
 *  own full OCR -> grade pipeline independently (never batched into one request), just with
 *  several running concurrently instead of queued behind each other. */
export async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  async function runNext(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index]);
    return runNext();
  }

  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
}
