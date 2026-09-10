import type {
  CommunityAgentActivityStore,
  CommunityAgentArchiveCursor,
  CommunityAgentArchivePage,
  CommunityAgentArchiveQuery,
  CommunityAgentArchiveRecord,
  CommunityAgentArchiveScope,
  CommunityAgentIdentity,
} from "./agent-contracts.js";
import {
  AGENT_PUBKEY,
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

export function agentArchiveRow(
  scope: CommunityAgentArchiveScope,
  input: CommunityAgentArchiveRecord,
): AgentArchiveRow {
  const event = signedAgentEvent(input.event);
  const profile = signedAgentEvent(input.profile);
  if (
    !event ||
    !profile ||
    !validateAgentTelemetry(event, profile, scope.ownerPubkey) ||
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
    record: { event, profile, receivedAt: input.receivedAt },
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
): CommunityAgentIdentity | undefined {
  return materializeAgentDirectory([profile], owner, "")[0];
}

export function createMemoryAgentActivityStore(): CommunityAgentActivityStore {
  const rows = new Map<string, AgentArchiveRow>();
  return {
    async append(scope, records) {
      const verified = records.map((record) => agentArchiveRow(scope, record));
      for (const row of verified)
        if (!rows.has(row.key)) rows.set(row.key, row);
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
          .map((row) => row.record.profile),
        scope.ownerPubkey,
        "",
      );
    },
    async clear(scope, agent) {
      const key = agentArchiveScopeKey(scope);
      for (const [id, row] of rows)
        if (row.scopeKey === key && (!agent || row.agentPubkey === agent))
          rows.delete(id);
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
  }
}
