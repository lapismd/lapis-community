import type { NostrEvent } from "../protocol/index.js";
import type { RelayFilter } from "../nostr/index.js";
import {
  buzzWorkItemFilters,
  type ProjectForgeSession,
} from "./data-source.js";
import type { ProjectForgeWorkItems } from "./model.js";

interface Resource {
  repository: NostrEvent;
  controller: AbortController;
  subscriptions: Map<string, { key: string; stop: () => void }>;
  pending?: Promise<ProjectForgeWorkItems> | undefined;
  value?: ProjectForgeWorkItems;
  dirty: boolean;
  failed: boolean;
  observed: Set<string>;
}

interface ProjectWorkItemResources {
  load(
    repository: NostrEvent,
    signal?: AbortSignal,
  ): Promise<ProjectForgeWorkItems>;
  peek(repository: NostrEvent): ProjectForgeWorkItems | undefined;
  subscribe(
    repositoryIds: readonly string[],
    listener: (error?: unknown) => void,
  ): () => void;
  retain(repositories: readonly NostrEvent[]): void;
  dispose(): void;
}

/** Session-owned observations survive page cancellation; no cache crosses sessions. */
export function createProjectWorkItemResources(
  session: ProjectForgeSession,
): ProjectWorkItemResources {
  const resources = new Map<string, Resource>();
  const listeners = new Set<(resource: Resource, error?: unknown) => void>();
  let disposed = false;

  function close(resource: Resource) {
    resource.controller.abort();
    for (const subscription of resource.subscriptions.values())
      subscription.stop();
    resource.subscriptions.clear();
  }

  function notify(resource: Resource, error?: unknown) {
    if (!disposed) for (const listener of listeners) listener(resource, error);
  }

  async function subscribe(
    resource: Resource,
    group: string,
    filters: RelayFilter[],
  ): Promise<boolean> {
    const key = JSON.stringify(filters);
    const previous = resource.subscriptions.get(group);
    if (previous?.key === key) return false;
    let active = true;
    const unsubscribe = await session.subscribe(
      filters,
      (event) => {
        if (!active || resource.controller.signal.aborted) return;
        if (event.type === "close") {
          resource.failed = true;
          close(resource);
          notify(
            resource,
            new Error(event.reason || "Project updates disconnected"),
          );
        } else if (
          event.type === "event" &&
          event.event &&
          !resource.observed.has(event.event.id)
        ) {
          resource.observed.add(event.event.id);
          resource.dirty = true;
          // A pending read drains this invalidation before committing its result.
          if (!resource.pending)
            queueMicrotask(() => {
              if (!resource.pending && !resource.controller.signal.aborted)
                void refresh(resource).catch((error) => {
                  if (
                    !disposed &&
                    resources.get(resource.repository.id) === resource
                  )
                    notify(resource, error);
                });
            });
        }
      },
      resource.controller.signal,
    );
    if (resource.controller.signal.aborted) {
      active = false;
      unsubscribe();
      resource.controller.signal.throwIfAborted();
    }
    resource.subscriptions.set(group, {
      key,
      stop: () => {
        active = false;
        unsubscribe();
      },
    });
    previous?.stop();
    return true;
  }

  function refresh(resource: Resource): Promise<ProjectForgeWorkItems> {
    if (resource.pending) return resource.pending;
    resource.pending = (async (): Promise<ProjectForgeWorkItems> => {
      try {
        const identifier = resource.repository.tags.find(
          (tag) => tag[0] === "d",
        )?.[1];
        const coordinate = `${resource.repository.kind}:${resource.repository.pubkey}:${identifier}`;
        await subscribe(
          resource,
          "repository",
          buzzWorkItemFilters(coordinate).map((filter) => ({
            ...filter,
            limit: 0,
          })),
        );
        let value: ProjectForgeWorkItems;
        do {
          resource.dirty = false;
          value = await session.loadWorkItems(
            resource.repository,
            resource.controller.signal,
          );
          resource.controller.signal.throwIfAborted();
          // NIP-22 comments and deletion events may only reference event IDs.
          // Observe these before the confirming read, so initial discovery has no gap.
          const ids = value.events
            .filter((event) => event.kind !== 5)
            .map((event) => event.id);
          const roots = [...value.tasks, ...value.pullRequests].map(
            (item) => item.root.id,
          );
          const filters: RelayFilter[] = [];
          const targets = [
            { tag: "#E", kind: 1111, values: roots },
            { tag: "#e", kind: 5, values: ids },
          ];
          for (const { tag, kind, values } of targets) {
            const ordered = [...new Set(values)].sort();
            for (let offset = 0; offset < ordered.length; offset += 200)
              filters.push(
                tag === "#E"
                  ? {
                      kinds: [kind],
                      "#E": ordered.slice(offset, offset + 200),
                      limit: 0,
                    }
                  : {
                      kinds: [kind],
                      "#e": ordered.slice(offset, offset + 200),
                      limit: 0,
                    },
              );
          }
          if (filters.length || resource.subscriptions.has("references")) {
            if (await subscribe(resource, "references", filters))
              resource.dirty = true;
          }
          for (const event of value.events) resource.observed.add(event.id);
        } while (resource.dirty);
        resource.value = value;
        notify(resource);
        return value;
      } catch (error) {
        resource.failed = true;
        close(resource);
        throw error;
      } finally {
        resource.pending = undefined;
      }
    })();
    return resource.pending;
  }

  return {
    async load(repository: NostrEvent, signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (disposed) throw new Error("Project resources are closed");
      let resource = resources.get(repository.id);
      if (!resource || resource.failed) {
        resource = {
          repository,
          controller: new AbortController(),
          subscriptions: new Map(),
          dirty: true,
          failed: false,
          observed: new Set(),
        };
        resources.set(repository.id, resource);
      }
      const result =
        resource.value && !resource.dirty
          ? Promise.resolve(resource.value)
          : refresh(resource);
      if (!signal) return result;
      return new Promise<ProjectForgeWorkItems>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        void result
          .then(resolve, reject)
          .finally(() => signal.removeEventListener("abort", abort));
      });
    },
    peek(repository: NostrEvent) {
      return resources.get(repository.id)?.value;
    },
    subscribe(
      repositoryIds: readonly string[],
      listener: (error?: unknown) => void,
    ) {
      const ids = new Set(repositoryIds);
      const scoped = (resource: Resource, error?: unknown) => {
        if (ids.has(resource.repository.id)) listener(error);
      };
      listeners.add(scoped);
      return () => {
        listeners.delete(scoped);
      };
    },
    retain(repositories: readonly NostrEvent[]) {
      const ids = new Set(repositories.map((repository) => repository.id));
      for (const [id, resource] of resources)
        if (!ids.has(id)) {
          close(resource);
          resources.delete(id);
        }
    },
    dispose() {
      disposed = true;
      for (const resource of resources.values()) close(resource);
      resources.clear();
      listeners.clear();
    },
  };
}
