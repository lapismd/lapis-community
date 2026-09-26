import type { NostrEvent } from "../protocol/nostr-event.js";
import type {
  CommunityAgentIdentity,
  CommunityAgentRuntimeState,
} from "./agent-contracts.js";
import {
  newerRuntimeEvent,
  parseRuntimeRequest,
  parseRuntimeSnapshot,
  validRuntimeEnvelope,
  type CommunityRuntimeRefreshState,
  type RuntimeRefreshRequest,
  type RuntimeSnapshot,
} from "./agent-runtime-snapshot-protocol.js";
interface Options {
  owner: string;
  now(): number;
  agent(pubkey: string): CommunityAgentIdentity | undefined;
  relay(): string | undefined;
  decrypt(peer: string, content: string): Promise<string>;
  send(agent: string, request: RuntimeRefreshRequest): Promise<NostrEvent>;
  legacy(agent: string): Promise<CommunityAgentRuntimeState>;
  loadHeads?: ((agent: string) => Promise<readonly NostrEvent[]>) | undefined;
  update(
    agent: string,
    runtime: CommunityAgentRuntimeState | undefined,
    state: CommunityRuntimeRefreshState,
  ): void;
}
interface Head<T> {
  event: NostrEvent;
  value: T;
}
export class AgentRuntimeSnapshots {
  #snapshots = new Map<string, Head<RuntimeSnapshot>>();
  #requests = new Map<string, Head<RuntimeRefreshRequest>>();
  #sending = new Map<string, Promise<void>>();
  #waiters = new Map<
    string,
    Set<{
      resolve(value: CommunityAgentRuntimeState): void;
      reject(error: Error): void;
    }>
  >();
  #errors = new Map<string, string>();
  #legacyTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #legacyValues = new Map<string, CommunityAgentRuntimeState>();
  #closed = false;
  #expired = new Map<string, string>();
  constructor(readonly options: Options) {}
  hasSnapshot(agent: string): boolean {
    return this.#snapshots.has(agent);
  }
  async receive(event: NostrEvent): Promise<void> {
    const pubkey = event.tags.find((tag) => tag[0] === "agent")?.[1];
    const agent = pubkey ? this.options.agent(pubkey) : undefined;
    if (
      this.#closed ||
      !agent ||
      !validRuntimeEnvelope(
        event,
        agent,
        this.options.owner,
        this.options.relay(),
      ) ||
      event.created_at * 1000 > this.options.now() + 30000
    )
      return;
    const map = event.kind === 30180 ? this.#snapshots : this.#requests;
    if (!newerRuntimeEvent(event, map.get(agent.pubkey)?.event)) return;
    try {
      const peer = agent.pubkey;
      const raw = JSON.parse(await this.options.decrypt(peer, event.content));
      if (
        this.#closed ||
        !this.options.agent(agent.pubkey) ||
        !newerRuntimeEvent(event, map.get(agent.pubkey)?.event)
      )
        return;
      if (event.kind === 30180) {
        const value = parseRuntimeSnapshot(raw);
        if (!value) return;
        const previous = this.#snapshots.get(agent.pubkey);
        if (previous && value.revision <= previous.value.revision) return;
        this.#snapshots.set(agent.pubkey, { event, value });
        const timer = this.#legacyTimers.get(agent.pubkey);
        if (timer) clearTimeout(timer);
      } else {
        const value = parseRuntimeRequest(raw, event);
        if (!value) return;
        this.#requests.set(agent.pubkey, { event, value });
        this.#errors.delete(agent.pubkey);
        this.#legacyValues.delete(agent.pubkey);
      }
      this.#emit(agent.pubkey);
    } catch {
      /* Invalid ciphertext cannot affect cached state. */
    }
  }
  state(agent: string): CommunityRuntimeRefreshState {
    const snapshot = this.#snapshots.get(agent)?.value,
      request = this.#requests.get(agent);
    const base = {
      ...(snapshot
        ? { observedAt: snapshot.observedAt, revision: snapshot.revision }
        : {}),
      ...(request
        ? {
            eventId: request.event.id,
            requestedAt: request.value.requestedAt,
            expiresAt: request.value.expiresAt,
          }
        : {}),
    };
    const error = this.#errors.get(agent);
    if (error) return { ...base, status: "error", error };
    if (!request) return { ...base, status: "idle" };
    if (
      snapshot?.request?.eventId === request.event.id &&
      snapshot.request.requestId === request.value.requestId
    )
      return {
        ...base,
        status: snapshot.request.status,
        ...(snapshot.request.error ? { error: snapshot.request.error } : {}),
      };
    if (this.#legacyValues.has(agent)) return { ...base, status: "completed" };
    return {
      ...base,
      status:
        request.value.expiresAt <= this.options.now() ? "timed-out" : "pending",
    };
  }
  #emit(agent: string): void {
    if (this.#closed) return;
    const state = this.state(agent),
      runtime =
        this.#snapshots.get(agent)?.value.runtime ??
        this.#legacyValues.get(agent);
    if (this.options.agent(agent))
      this.options.update(agent, runtime ?? undefined, state);
    if (state.status === "pending" || state.status === "idle") return;
    const waiters = this.#waiters.get(agent);
    this.#waiters.delete(agent);
    for (const waiter of waiters ?? []) {
      if (state.status === "completed" && runtime) waiter.resolve(runtime);
      else
        waiter.reject(
          new Error(
            state.error ??
              "The agent controller did not respond within thirty seconds",
          ),
        );
    }
  }
  refresh(agent: string): Promise<void> {
    const prior = this.#sending.get(agent);
    if (prior) return prior;
    if (this.state(agent).status === "pending") return Promise.resolve();
    const operation = this.#send(agent).finally(() =>
      this.#sending.delete(agent),
    );
    this.#sending.set(agent, operation);
    return operation;
  }
  async #send(agent: string): Promise<void> {
    try {
      if (!this.options.agent(agent))
        throw new Error("Runtime refresh requires a current verified agent");
      if (this.options.loadHeads)
        for (const event of await this.options.loadHeads(agent))
          await this.receive(event);
      if (this.state(agent).status === "pending") return;
      const previous = this.#requests.get(agent)?.event.created_at;
      if (
        previous !== undefined &&
        previous >= Math.floor(this.options.now() / 1000)
      )
        await new Promise((resolve) =>
          setTimeout(resolve, (previous + 1) * 1000 - this.options.now()),
        );
      if (this.#closed) throw new Error("Runtime refresh was cancelled");
      if (this.state(agent).status === "pending") return;
      const now = this.options.now();
      const request: RuntimeRefreshRequest = {
        version: 1,
        requestId: crypto.randomUUID(),
        requestedAt: now,
        expiresAt: now + 30000,
      };
      const event = await this.options.send(agent, request);
      if (this.#closed) return;
      await this.receive(event);
      if (!this.#snapshots.has(agent)) {
        const timer = setTimeout(() => {
          this.#legacyTimers.delete(agent);
          if (
            this.#closed ||
            this.#snapshots.has(agent) ||
            this.#requests.get(agent)?.event.id !== event.id
          )
            return;
          void this.options
            .legacy(agent)
            .then((runtime) => {
              if (
                this.#closed ||
                this.#snapshots.has(agent) ||
                this.#requests.get(agent)?.event.id !== event.id
              )
                return;
              this.#legacyValues.set(agent, runtime);
              this.#emit(agent);
            })
            .catch(() => {});
        }, 1000);
        this.#legacyTimers.set(agent, timer);
      }
    } catch (cause) {
      this.#errors.set(
        agent,
        cause instanceof Error
          ? cause.message
          : "Runtime refresh could not be sent",
      );
      this.#emit(agent);
      throw cause;
    }
  }
  async load(agent: string): Promise<CommunityAgentRuntimeState> {
    const value = new Promise<CommunityAgentRuntimeState>((resolve, reject) => {
      let waiters = this.#waiters.get(agent);
      if (!waiters) this.#waiters.set(agent, (waiters = new Set()));
      waiters.add({ resolve, reject });
    });
    void this.refresh(agent)
      .then(() => this.#emit(agent))
      .catch(() => {});
    return value;
  }
  tick(): void {
    for (const agent of this.#requests.keys())
      if (
        this.state(agent).status === "timed-out" &&
        this.#expired.get(agent) !== this.#requests.get(agent)!.event.id
      ) {
        this.#expired.set(agent, this.#requests.get(agent)!.event.id);
        this.#emit(agent);
      }
  }
  retain(agents: ReadonlySet<string>): void {
    for (const agent of new Set([
      ...this.#snapshots.keys(),
      ...this.#requests.keys(),
      ...this.#waiters.keys(),
    ])) {
      if (agents.has(agent)) continue;
      this.#snapshots.delete(agent);
      this.#requests.delete(agent);
      this.#errors.delete(agent);
      this.#expired.delete(agent);
      this.#legacyValues.delete(agent);
      clearTimeout(this.#legacyTimers.get(agent));
      this.#legacyTimers.delete(agent);
      for (const waiter of this.#waiters.get(agent) ?? [])
        waiter.reject(new Error("Agent is no longer available"));
      this.#waiters.delete(agent);
    }
  }
  dispose(): void {
    this.#closed = true;
    for (const timer of this.#legacyTimers.values()) clearTimeout(timer);
    for (const waiters of this.#waiters.values())
      for (const waiter of waiters)
        waiter.reject(new Error("Runtime refresh was cancelled"));
    this.#waiters.clear();
    this.#requests.clear();
    this.#snapshots.clear();
  }
}
