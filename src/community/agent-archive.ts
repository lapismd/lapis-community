import type {
  CommunityAgentActivityStore,
  CommunityAgentActivityCheckpoint,
  CommunityAgentActivitySyncContext,
  CommunityAgentArchiveCursor,
  CommunityAgentArchivePage,
  CommunityAgentArchiveQuery,
  CommunityAgentArchiveRecord,
  CommunityAgentArchiveScope,
  CommunityAgentIdentity,
} from "./agent-contracts.js";
import type { NostrEvent } from "../protocol/index.js";
import {
  AGENT_PUBKEY,
  agentInstance,
  agentTag,
  materializeAgentDirectory,
  signedAgentEvent,
  validateAgentTelemetry,
} from "./agent-protocol.js";
import type { CommunityAgentArchiveRequest } from "./agent-contracts.js";

export interface AgentArchiveRow {
  key: string;
  scopeKey: string;
  agentPubkey: string;
  channelId: string;
  createdAt: number;
  eventId: string;
  record: CommunityAgentArchiveRecord;
}

export interface AgentArchiveIdentityRecord {
  profile: NostrEvent;
  instance?: NostrEvent;
}

export function agentArchiveScopeKey(
  scope: CommunityAgentArchiveScope,
): string {
  if (!AGENT_PUBKEY.test(scope.ownerPubkey))
    throw new Error("An agent archive requires an owner public key");
  const relays = [
    ...new Set(scope.relayUrls.map((url) => new URL(url).toString())),
  ].sort();
  return JSON.stringify([scope.communityId, relays, scope.ownerPubkey]);
}

export function agentActivityCheckpointKey(
  scope: CommunityAgentArchiveScope,
  agentPubkey: string,
  context: CommunityAgentActivitySyncContext | "*",
): string {
  if (!AGENT_PUBKEY.test(agentPubkey))
    throw new Error("An activity checkpoint requires an agent public key");
  return JSON.stringify([
    agentArchiveScopeKey(scope),
    agentPubkey,
    agentActivityContextKey(context),
  ]);
}

export function agentActivityContextKey(
  context: CommunityAgentActivitySyncContext | "*",
): string {
  return context === "*" ? "*" : JSON.stringify(context);
}

export function validateActivityCheckpoint(
  checkpoint: CommunityAgentActivityCheckpoint,
): CommunityAgentActivityCheckpoint {
  if (
    !Number.isSafeInteger(checkpoint.offset) ||
    checkpoint.offset < 0 ||
    !Number.isFinite(checkpoint.updatedAt) ||
    (checkpoint.streamId !== undefined &&
      (!checkpoint.streamId || checkpoint.streamId.length > 128)) ||
    (checkpoint.notBefore !== undefined &&
      (!Number.isSafeInteger(checkpoint.notBefore) || checkpoint.notBefore < 0))
  )
    throw new Error("Invalid agent activity checkpoint");
  return { ...checkpoint };
}

export function agentArchiveRow(
  scope: CommunityAgentArchiveScope,
  input: CommunityAgentArchiveRecord,
): AgentArchiveRow {
  const event = signedAgentEvent(input.event);
  const profile = signedAgentEvent(input.profile);
  const instance = input.instance
    ? signedAgentEvent(input.instance)
    : undefined;
  if (
    !event ||
    !profile ||
    (input.instance !== undefined &&
      (!instance ||
        agentInstance(instance, scope.ownerPubkey)?.agentPubkey !==
          profile.pubkey)) ||
    !validateAgentTelemetry(
      event,
      profile,
      scope.ownerPubkey,
      undefined,
      scope.relayPubkey,
      instance,
    ) ||
    !Number.isFinite(input.receivedAt)
  )
    throw new Error("Invalid encrypted agent archive record");
  const scopeKey = agentArchiveScopeKey(scope);
  return {
    key: JSON.stringify([scopeKey, event.id]),
    scopeKey,
    agentPubkey: event.pubkey,
    channelId: agentTag(event, "h") ?? "",
    createdAt: event.created_at,
    eventId: event.id,
    record: {
      event,
      profile,
      ...(instance ? { instance } : {}),
      receivedAt: input.receivedAt,
    },
  };
}

export function agentArchiveLimit(query: CommunityAgentArchiveQuery): number {
  return Number.isFinite(query.limit)
    ? Math.max(1, Math.min(100, Math.floor(query.limit!)))
    : 50;
}

export function archiveBefore(
  row: AgentArchiveRow,
  cursor?: CommunityAgentArchiveCursor,
): boolean {
  return (
    cursor === undefined ||
    row.createdAt < cursor.createdAt ||
    (row.createdAt === cursor.createdAt && row.eventId < cursor.eventId)
  );
}

export function archiveOrder(a: AgentArchiveRow, b: AgentArchiveRow): number {
  return b.createdAt - a.createdAt || b.eventId.localeCompare(a.eventId);
}

export function archivePage(
  rows: readonly AgentArchiveRow[],
  query: CommunityAgentArchiveQuery,
): CommunityAgentArchivePage {
  const limit = agentArchiveLimit(query);
  const selected = rows.slice(0, limit);
  const last = selected.at(-1);
  return {
    records: selected.flatMap((row) => {
      try {
        return [agentArchiveRow(query.scope, row.record).record];
      } catch {
        return [];
      }
    }),
    hasOlder: rows.length > limit,
    ...(last
      ? { cursor: { createdAt: last.createdAt, eventId: last.eventId } }
      : {}),
  };
}

export function archiveIdentity(
  profile: CommunityAgentArchiveRecord["profile"],
  owner: string,
  relay = "",
  instance?: CommunityAgentArchiveRecord["instance"],
): CommunityAgentIdentity | undefined {
  return materializeAgentDirectory(
    [profile, ...(instance ? [instance] : [])],
    owner,
    relay,
  )[0];
}

export function agentArchiveIdentityRecord(
  record: CommunityAgentArchiveRecord,
): AgentArchiveIdentityRecord {
  return {
    profile: record.profile,
    ...(record.instance ? { instance: record.instance } : {}),
  };
}

export function agentArchiveIdentityVersion(
  identity: AgentArchiveIdentityRecord,
): { createdAt: number; eventId: string } {
  return {
    createdAt: Math.max(
      identity.profile.created_at,
      identity.instance?.created_at ?? 0,
    ),
    eventId: [identity.profile.id, identity.instance?.id ?? ""].join(":"),
  };
}

export function createMemoryAgentActivityStore(): CommunityAgentActivityStore {
  const rows = new Map<string, AgentArchiveRow>();
  const checkpoints = new Map<string, CommunityAgentActivityCheckpoint>();
  const insert = (
    scope: CommunityAgentArchiveScope,
    records: readonly CommunityAgentArchiveRecord[],
  ) => {
    const verified = records.map((record) => agentArchiveRow(scope, record));
    for (const row of verified) if (!rows.has(row.key)) rows.set(row.key, row);
  };
  return {
    async append(scope, records) {
      insert(scope, records);
    },
    async page(query) {
      const key = agentArchiveScopeKey(query.scope);
      const selected = [...rows.values()]
        .filter(
          (row) =>
            row.scopeKey === key &&
            (!query.agentPubkey || row.agentPubkey === query.agentPubkey) &&
            (!query.channelId || row.channelId === query.channelId) &&
            archiveBefore(row, query.before),
        )
        .sort(archiveOrder);
      return archivePage(
        selected.slice(0, agentArchiveLimit(query) + 1),
        query,
      );
    },
    async agents(scope) {
      const key = agentArchiveScopeKey(scope);
      return materializeAgentDirectory(
        [...rows.values()]
          .filter((row) => row.scopeKey === key)
          .flatMap((row) => [
            row.record.profile,
            ...(row.record.instance ? [row.record.instance] : []),
          ]),
        scope.ownerPubkey,
        scope.relayPubkey ?? "",
      );
    },
    async clear(scope, agent) {
      const key = agentArchiveScopeKey(scope);
      for (const [id, row] of rows)
        if (row.scopeKey === key && (!agent || row.agentPubkey === agent))
          rows.delete(id);
    },
    async checkpoint(scope, agent, context) {
      const exact = checkpoints.get(
        agentActivityCheckpointKey(scope, agent, context),
      );
      const suppression = checkpoints.get(
        agentActivityCheckpointKey(scope, agent, "*"),
      );
      if (!exact) return suppression ? { ...suppression } : undefined;
      return {
        ...exact,
        ...(suppression?.notBefore !== undefined
          ? {
              notBefore: Math.max(exact.notBefore ?? 0, suppression.notBefore),
            }
          : {}),
        updatedAt: Math.max(exact.updatedAt, suppression?.updatedAt ?? 0),
      };
    },
    async commitSyncPage(scope, agent, context, records, checkpoint) {
      if (records.some((record) => record.event.pubkey !== agent))
        throw new Error("Activity page contains a different agent");
      const verified = records.map((record) => agentArchiveRow(scope, record));
      const next = validateActivityCheckpoint(checkpoint);
      for (const row of verified)
        if (!rows.has(row.key)) rows.set(row.key, row);
      checkpoints.set(agentActivityCheckpointKey(scope, agent, context), next);
    },
    async suppressBefore(scope, agent, timestamp) {
      const key = agentActivityCheckpointKey(scope, agent, "*");
      const previous = checkpoints.get(key);
      checkpoints.set(key, {
        offset: previous?.offset ?? 0,
        ...(previous?.streamId ? { streamId: previous.streamId } : {}),
        notBefore: Math.max(previous?.notBefore ?? 0, timestamp),
        updatedAt: timestamp,
      });
    },
  };
}

export function agentActivityProxy(
  access: () => Promise<CommunityAgentActivityStore>,
): CommunityAgentActivityStore {
  return {
    append: async (scope, records) => (await access()).append(scope, records),
    page: async (query) => (await access()).page(query),
    agents: async (scope) => (await access()).agents(scope),
    clear: async (scope, agent) => (await access()).clear(scope, agent),
    checkpoint: async (scope, agent, context) =>
      (await access()).checkpoint(scope, agent, context),
    commitSyncPage: async (scope, agent, context, records, checkpoint) =>
      (await access()).commitSyncPage(
        scope,
        agent,
        context,
        records,
        checkpoint,
      ),
    suppressBefore: async (scope, agent, timestamp) =>
      (await access()).suppressBefore(scope, agent, timestamp),
  };
}

export async function dispatchAgentArchive(
  store: CommunityAgentActivityStore | undefined,
  request: CommunityAgentArchiveRequest,
): Promise<unknown> {
  if (!store) throw new Error("Agent history is unavailable in this runtime");
  switch (request.operation) {
    case "append":
      return store.append(request.scope, request.records);
    case "page":
      return store.page(request.query);
    case "agents":
      return store.agents(request.scope);
    case "clear":
      return store.clear(request.scope, request.agentPubkey);
    case "checkpoint":
      return store.checkpoint(
        request.scope,
        request.agentPubkey,
        request.context,
      );
    case "commitSyncPage":
      return store.commitSyncPage(
        request.scope,
        request.agentPubkey,
        request.context,
        request.records,
        request.checkpoint,
      );
    case "suppressBefore":
      return store.suppressBefore(
        request.scope,
        request.agentPubkey,
        request.timestamp,
      );
  }
}
