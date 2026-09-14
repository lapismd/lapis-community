/** Bounded logical loads. Repeated gestures share the same in-flight request. */
export function createHistoryScheduler(concurrency = 2) {
  let active = 0;
  const activeGroups = new Set<string>();
  const pending = new Map<string, Promise<unknown>>();
  const queue: {
    visible: boolean | (() => boolean);
    group: string;
    start: () => void;
  }[] = [];
  function drain() {
    const priority = (value: boolean | (() => boolean)) =>
      Number(typeof value === "function" ? value() : value);
    queue.sort((a, b) => priority(b.visible) - priority(a.visible));
    while (active < concurrency) {
      const index = queue.findIndex((entry) => !activeGroups.has(entry.group));
      if (index < 0) break;
      queue.splice(index, 1)[0]!.start();
    }
  }
  return {
    run<T>(
      key: string,
      work: () => Promise<T>,
      visible: boolean | (() => boolean) = true,
      group = key,
    ): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing as Promise<T>;
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      pending.set(key, promise);
      queue.push({
        visible,
        group,
        start() {
          active++;
          activeGroups.add(group);
          void Promise.resolve()
            .then(work)
            .then(resolve, reject)
            .finally(() => {
              active--;
              activeGroups.delete(group);
              pending.delete(key);
              drain();
            });
        },
      });
      drain();
      return promise;
    },
  };
}
