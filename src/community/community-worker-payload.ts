/** Copy the runtime's JSON-shaped contracts out of reactive proxy ownership. */
export function copyCommunityWorkerPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => copyCommunityWorkerPayload(item)) as T;
  }
  if (value === null || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      copyCommunityWorkerPayload(item),
    ]),
  ) as T;
}
