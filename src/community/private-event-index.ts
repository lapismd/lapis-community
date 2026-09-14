import type { NostrEvent } from "../protocol/index.js";

/** Incremental privacy propagation, including references received before their parent. */
export class PrivateEventIndex {
  readonly privateIds = new Set<string>();
  readonly groups = new Set<string>();
  readonly #byGroup = new Map<string, Set<string>>();
  readonly #children = new Map<string, Set<string>>();
  readonly #registered = new Set<string>();

  add(events: readonly NostrEvent[], explicit = false) {
    const privateIds: string[] = [],
      groupIds: string[] = [];
    const pending: string[] = [];
    for (const event of events) {
      const groups = event.tags
        .filter(
          ([tag, value]) =>
            (tag === "h" ||
              (tag === "d" && event.kind >= 39000 && event.kind <= 39003)) &&
            value,
        )
        .map((tag) => tag[1]!);
      const parents = event.tags
        .filter(([tag, value]) => (tag === "e" || tag === "E") && value)
        .map((tag) => tag[1]!);
      if (!this.#registered.has(event.id)) {
        this.#registered.add(event.id);
        for (const group of groups)
          addReference(this.#byGroup, group, event.id);
        for (const parent of parents)
          addReference(this.#children, parent, event.id);
      }
      const privateMetadata =
        event.kind === 39000 &&
        event.tags.some(([tag]) => tag === "private" || tag === "hidden");
      if (explicit || privateMetadata) {
        pending.push(event.id);
        for (const group of groups) {
          if (this.groups.has(group)) continue;
          this.groups.add(group);
          groupIds.push(group);
          for (const id of this.#byGroup.get(group) ?? []) pending.push(id);
        }
      }
      if (
        groups.some((group) => this.groups.has(group)) ||
        parents.some((parent) => this.privateIds.has(parent))
      )
        pending.push(event.id);
    }
    for (const id of this.markPrivate(pending)) privateIds.push(id);
    return { privateIds, groupIds };
  }

  markPrivate(seeds: Iterable<string>): string[] {
    const pending = [...seeds],
      privateIds: string[] = [];
    for (let index = 0; index < pending.length; index++) {
      const id = pending[index]!;
      if (this.privateIds.has(id)) continue;
      this.privateIds.add(id);
      privateIds.push(id);
      for (const child of this.#children.get(id) ?? []) pending.push(child);
    }
    return privateIds;
  }
}

function addReference(
  index: Map<string, Set<string>>,
  key: string,
  id: string,
) {
  const references = index.get(key) ?? new Set<string>();
  references.add(id);
  index.set(key, references);
}
