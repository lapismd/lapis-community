import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import type { CommunityRelay, CommunityRelayFactory } from "../nostr/index.js";
import type { JsonValue, NostrEvent } from "../protocol/index.js";

import type {
  CommunityIdentity,
  CommunityPreferenceValue,
  CommunityReadCursor,
  CommunityStateScope,
  CommunityStateStore,
  CommunityStoredState,
} from "./contracts.js";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BrowserCommunityStateStoreOptions {
  storage?: StorageLike;
  prefix?: string;
}

export function createBrowserCommunityStateStore(
  options: BrowserCommunityStateStoreOptions = {},
): CommunityStateStore {
  const storage = options.storage ?? discoveredStorage() ?? memoryStorage();
  const prefix = options.prefix ?? "lapismd.community.state.v1";
  return {
    async load(scope) {
      const value = storage.getItem(localKey(prefix, scope));
      return value === null ? undefined : parseStoredState(value);
    },
    async refresh(scope) {
      const value = storage.getItem(localKey(prefix, scope));
      return value === null ? undefined : parseStoredState(value);
    },
    async save(scope, state) {
      storage.setItem(localKey(prefix, scope), JSON.stringify(state));
    },
    async flush() {},
    dispose() {},
  };
}

export interface Nip78CommunityStateStoreOptions {
  relayFactory: CommunityRelayFactory;
  identity: CommunityIdentity;
  local?: CommunityStateStore;
  clientId: string;
  now?: () => number;
  debounceMs?: number;
  maxPlaintextBytes?: number;
}

export function createNip78CommunityStateStore(
  options: Nip78CommunityStateStoreOptions,
): CommunityStateStore {
  if (options.identity.nip44 === undefined) {
    throw new Error("NIP-44 encryption is required for NIP-78 state sync");
  }
  const local = options.local ?? createBrowserCommunityStateStore();
  const now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  const debounceMs = options.debounceMs ?? 2_000;
  const maxPlaintextBytes = options.maxPlaintextBytes ?? 32 * 1_024;
  const pending = new Map<string, CommunityStateScope>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const relays = new Map<string, CommunityRelay>();
  let disposed = false;

  const store: CommunityStateStore = {
    async load(scope) {
      return await local.load(scope);
    },
    async refresh(scope) {
      assertActive();
      const pubkey = await options.identity.getPublicKey();
      if (pubkey !== scope.pubkey) {
        throw new Error(
          "NIP-78 state scope does not match the connected identity",
        );
      }
      const relay = relayFor(scope);
      await authenticate(relay, options.identity);
      const events = await relay.query({
        kinds: [30_078],
        authors: [pubkey],
        "#t": [stateTag(scope)],
        limit: 64,
      });
      const remoteStates = (
        await Promise.allSettled(
          events
            .toSorted(
              (left, right) =>
                right.created_at - left.created_at ||
                right.id.localeCompare(left.id),
            )
            .slice(0, 8)
            .map(async (event) => {
              const plaintext = await options.identity.nip44!.decrypt(
                pubkey,
                event.content,
              );
              return parseStoredState(plaintext);
            }),
        )
      )
        .filter(
          (result): result is PromiseFulfilledResult<CommunityStoredState> =>
            result.status === "fulfilled" && result.value !== undefined,
        )
        .map((result) => result.value);
      const localState = await local.load(scope);
      const merged = mergeCommunityStates(
        [...(localState === undefined ? [] : [localState]), ...remoteStates],
        options.clientId,
        now(),
      );
      if (merged !== undefined) await local.save(scope, merged);
      return merged;
    },
    async save(scope, state) {
      assertActive();
      await local.save(scope, state);
      const key = stateScopeKey(scope);
      pending.set(key, scope);
      const current = timers.get(key);
      if (current !== undefined) clearTimeout(current);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          void publishScope(scope).catch(() => {
            pending.set(key, scope);
          });
        }, debounceMs),
      );
    },
    async flush(scope) {
      assertActive();
      const scopes = scope === undefined ? [...pending.values()] : [scope];
      for (const current of scopes) {
        const key = stateScopeKey(current);
        const timer = timers.get(key);
        if (timer !== undefined) clearTimeout(timer);
        timers.delete(key);
        try {
          await publishScope(current);
        } catch (cause) {
          pending.set(key, current);
          throw cause;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      pending.clear();
      for (const relay of relays.values()) relay.close();
      relays.clear();
      local.dispose();
    },
  };

  async function publishScope(scope: CommunityStateScope): Promise<void> {
    const key = stateScopeKey(scope);
    if (!pending.has(key) && (await local.load(scope)) === undefined) return;
    pending.delete(key);
    const remote = await store.refresh(scope);
    if (remote === undefined) return;
    const state = pruneState(remote, maxPlaintextBytes);
    const plaintext = JSON.stringify(state);
    const pubkey = await options.identity.getPublicKey();
    const content = await options.identity.nip44!.encrypt(pubkey, plaintext);
    const event = await options.identity.signEvent({
      kind: 30_078,
      created_at: now(),
      content,
      tags: [
        [
          "d",
          `lapismd-community:state:v1:${scopeHash(scope)}:${options.clientId}`,
        ],
        ["t", stateTag(scope)],
      ],
    });
    const result = await relayFor(scope).publish(event);
    if (!result.accepted) {
      pending.set(key, scope);
      throw new Error(result.message || "Relay rejected NIP-78 state");
    }
    await local.save(scope, state);
  }

  function relayFor(scope: CommunityStateScope): CommunityRelay {
    const current = relays.get(scope.relayUrl);
    if (current !== undefined) return current;
    const relay = options.relayFactory.create(scope.relayUrl);
    relays.set(scope.relayUrl, relay);
    return relay;
  }

  function assertActive(): void {
    if (disposed) throw new Error("Community state store is disposed");
  }

  return store;
}

export function createCommunityStoredState(
  clientId: string,
  updatedAt: number,
): CommunityStoredState {
  return {
    version: 1,
    clientId,
    updatedAt,
    readMarkers: {},
    preferences: {},
  };
}

export function mergeCommunityStates(
  states: readonly CommunityStoredState[],
  clientId: string,
  updatedAt: number,
): CommunityStoredState | undefined {
  if (states.length === 0) return undefined;
  const readMarkers: Record<string, CommunityReadCursor> = {};
  const preferences: Record<string, CommunityPreferenceValue> = {};
  for (const state of states) {
    for (const [key, cursor] of Object.entries(state.readMarkers)) {
      const current = readMarkers[key];
      if (current === undefined || compareCursor(cursor, current) > 0) {
        readMarkers[key] = { ...cursor };
      }
    }
    for (const [key, preference] of Object.entries(state.preferences)) {
      const current = preferences[key];
      if (
        current === undefined ||
        preference.updatedAt > current.updatedAt ||
        (preference.updatedAt === current.updatedAt &&
          preference.clientId > current.clientId)
      ) {
        preferences[key] = { ...preference };
      }
    }
  }
  return {
    version: 1,
    clientId,
    updatedAt: Math.max(updatedAt, ...states.map((state) => state.updatedAt)),
    readMarkers,
    preferences,
  };
}

function compareCursor(
  left: CommunityReadCursor,
  right: CommunityReadCursor,
): number {
  return (
    left.createdAt - right.createdAt ||
    left.eventId.localeCompare(right.eventId)
  );
}

function pruneState(
  state: CommunityStoredState,
  maxPlaintextBytes: number,
): CommunityStoredState {
  const copy: CommunityStoredState = {
    ...state,
    readMarkers: Object.fromEntries(
      Object.entries(state.readMarkers).map(([key, cursor]) => [
        key,
        { ...cursor },
      ]),
    ),
    preferences: Object.fromEntries(
      Object.entries(state.preferences).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ),
  };
  const size = () => utf8ToBytes(JSON.stringify(copy)).byteLength;
  if (size() <= maxPlaintextBytes) return copy;
  const markers = Object.entries(copy.readMarkers).toSorted(
    ([, left], [, right]) =>
      markerPriority(left.granularity) - markerPriority(right.granularity) ||
      left.createdAt - right.createdAt,
  );
  for (const [key] of markers) {
    delete copy.readMarkers[key];
    if (size() <= maxPlaintextBytes) return copy;
  }
  throw new Error("Community state preferences exceed the NIP-78 size limit");
}

function markerPriority(
  granularity: CommunityReadCursor["granularity"],
): number {
  return granularity === "message" ? 0 : granularity === "thread" ? 1 : 2;
}

function parseStoredState(value: string): CommunityStoredState | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    return undefined;
  }
  const state = parsed as Record<string, unknown>;
  if (
    state.version !== 1 ||
    typeof state.clientId !== "string" ||
    typeof state.updatedAt !== "number" ||
    !isRecord(state.readMarkers) ||
    !isRecord(state.preferences)
  ) {
    return undefined;
  }
  const readMarkers: Record<string, CommunityReadCursor> = {};
  for (const [key, value] of Object.entries(state.readMarkers)) {
    if (
      !isRecord(value) ||
      typeof value.createdAt !== "number" ||
      typeof value.eventId !== "string" ||
      !["room", "thread", "message"].includes(String(value.granularity))
    ) {
      continue;
    }
    readMarkers[key] = {
      createdAt: value.createdAt,
      eventId: value.eventId,
      granularity: value.granularity as CommunityReadCursor["granularity"],
    };
  }
  const preferences: Record<string, CommunityPreferenceValue> = {};
  for (const [key, value] of Object.entries(state.preferences)) {
    if (
      !isRecord(value) ||
      typeof value.updatedAt !== "number" ||
      typeof value.clientId !== "string" ||
      !("value" in value)
    ) {
      continue;
    }
    preferences[key] = {
      value: value.value as JsonValue,
      updatedAt: value.updatedAt,
      clientId: value.clientId,
    };
  }
  return {
    version: 1,
    clientId: state.clientId,
    updatedAt: state.updatedAt,
    readMarkers,
    preferences,
  };
}

async function authenticate(
  relay: CommunityRelay,
  identity: CommunityIdentity,
): Promise<void> {
  await relay.authenticate?.(async (template) => identity.signEvent(template));
}

function localKey(prefix: string, scope: CommunityStateScope): string {
  return `${prefix}:${scopeHash(scope)}:${scope.pubkey}`;
}

function stateTag(scope: CommunityStateScope): string {
  return `lapismd-community-state-v1:${scopeHash(scope)}`;
}

function stateScopeKey(scope: CommunityStateScope): string {
  return `${scope.relayUrl}\n${scope.communityId}\n${scope.pubkey}`;
}

function scopeHash(scope: CommunityStateScope): string {
  const url = new URL(scope.relayUrl).toString();
  return bytesToHex(
    sha256(utf8ToBytes(`${url}\n${scope.communityId}\n${scope.pubkey}`)),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

function discoveredStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
