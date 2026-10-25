/** Retain unacknowledged combat events if a UI/save callback throws.
 * These helpers do not guarantee exactly-once side effects: consumers should be idempotent.
 */
// Guard against synchronous callbacks reentering the same queue and
// processing the current, not-yet-acknowledged event a second time.
const activeQueues = new WeakSet<object>();

export function deliverQueuedEvents<T>(queue: T[], handler: (event: T) => void): number {
  if (activeQueues.has(queue)) return 0;
  activeQueues.add(queue);
  let delivered = 0;
  try {
    const snapshot = queue.slice();
    const count = snapshot.length;
    for (let i = 0; i < count; i++) {
      const event = queue[0] as T;
      handler(event); // failures leave the event unacknowledged
      // Consumers must append rather than remove/reorder pending events.
      // Never silently remove an unrelated event after a callback mutation.
      // Identity alone is insufficient: a consumer can remove later events,
      // reinsert the same first item, or reorder the tail without changing queue[0].
      if (queue.length < count - i || queue[0] !== event ||
          queue.slice(0, count - i).some((item, index) => item !== snapshot[i + index])) {
        throw new Error("Reward queue mutated during delivery");
      }
      queue.shift();
      delivered++;
    }
    return delivered;
  } finally {
    activeQueues.delete(queue);
  }
}

export function deliverQueuedBatch<T>(queue: T[], handler: (events: T[]) => void): number {
  if (queue.length === 0 || activeQueues.has(queue)) return 0;
  activeQueues.add(queue);
  try {
    const batch = queue.slice();
    handler(batch); // failed callbacks leave the original queue untouched
    if (queue.length < batch.length || batch.some((item, i) => queue[i] !== item)) {
      throw new Error("Reward queue mutated during batch delivery");
    }
    queue.splice(0, batch.length);
    return batch.length;
  } finally {
    activeQueues.delete(queue);
  }
}
