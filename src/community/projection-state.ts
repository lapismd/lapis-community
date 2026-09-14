/** Preserve unchanged JSON model branches, including keyed rows after a prepend. */
export function shareProjection<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (
    !previous ||
    !next ||
    typeof previous !== "object" ||
    typeof next !== "object"
  )
    return next;
  if (Array.isArray(previous) && Array.isArray(next)) {
    const keyed = new Map(
      previous.flatMap((value) =>
        value && typeof value === "object" && typeof value.id === "string"
          ? [[value.id, value] as const]
          : [],
      ),
    );
    const shared = next.map((value, index) =>
      shareProjection(
        value && typeof value === "object" && typeof value.id === "string"
          ? keyed.get(value.id)
          : previous[index],
        value,
      ),
    );
    return (
      shared.length === previous.length &&
      shared.every((value, index) => value === previous[index])
        ? previous
        : shared
    ) as T;
  }
  if (Array.isArray(previous) || Array.isArray(next)) return next;
  const before = previous as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const keys = Object.keys(after);
  const shared = Object.fromEntries(
    keys.map((key) => [key, shareProjection(before[key], after[key])]),
  );
  return (
    keys.length === Object.keys(before).length &&
    keys.every(
      (key) => Object.hasOwn(before, key) && shared[key] === before[key],
    )
      ? previous
      : shared
  ) as T;
}

/** One projection in flight, with a single trailing pass for newer requests. */
export function createProjectionQueue(
  project: (isCurrent: () => boolean) => Promise<void>,
): () => Promise<void> {
  let version = 0;
  let pending: Promise<void> | undefined;
  return () => {
    version += 1;
    pending ??= Promise.resolve().then(async () => {
      try {
        let completed: number;
        do {
          completed = version;
          await project(() => completed === version);
        } while (completed !== version);
      } finally {
        pending = undefined;
      }
    });
    return pending;
  };
}
