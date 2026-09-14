/** Mutable min-heap for cache eviction; touching an entry does not grow the queue. */
export class CacheAccessOrder {
  readonly #entries: { key: string; accessedAt: number }[] = [];
  readonly #positions = new Map<string, number>();

  get oldest(): string | undefined {
    return this.#entries[0]?.key;
  }

  touch(key: string, accessedAt: number): void {
    const previous = this.#positions.get(key);
    if (previous !== undefined) {
      this.#entries[previous]!.accessedAt = accessedAt;
      this.#down(this.#up(previous));
      return;
    }
    const index = this.#entries.push({ key, accessedAt }) - 1;
    this.#positions.set(key, index);
    this.#up(index);
  }

  delete(key: string): void {
    const index = this.#positions.get(key);
    if (index === undefined) return;
    this.#positions.delete(key);
    const last = this.#entries.pop()!;
    if (index === this.#entries.length) return;
    this.#entries[index] = last;
    this.#positions.set(last.key, index);
    this.#down(this.#up(index));
  }

  clear(): void {
    this.#entries.length = 0;
    this.#positions.clear();
  }

  #before(left: number, right: number): boolean {
    const a = this.#entries[left]!,
      b = this.#entries[right]!;
    return (
      a.accessedAt < b.accessedAt ||
      (a.accessedAt === b.accessedAt && a.key < b.key)
    );
  }

  #swap(left: number, right: number): void {
    const a = this.#entries[left]!,
      b = this.#entries[right]!;
    this.#entries[left] = b;
    this.#entries[right] = a;
    this.#positions.set(a.key, right);
    this.#positions.set(b.key, left);
  }

  #up(index: number): number {
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (!this.#before(index, parent)) break;
      this.#swap(index, parent);
      index = parent;
    }
    return index;
  }

  #down(index: number): void {
    for (;;) {
      let smallest = index;
      const left = index * 2 + 1,
        right = left + 1;
      if (left < this.#entries.length && this.#before(left, smallest))
        smallest = left;
      if (right < this.#entries.length && this.#before(right, smallest))
        smallest = right;
      if (smallest === index) return;
      this.#swap(index, smallest);
      index = smallest;
    }
  }
}
