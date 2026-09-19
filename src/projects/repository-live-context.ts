import type { NostrEvent } from "../protocol/index.js";
import type { RepositoryAgentCheckpoint } from "./repository-agent-context.js";
import {
  exactEventTag,
  parseAgentContextRecord,
  parseJsonRecord,
} from "./repository-agent-context-parsing.js";

export const REPOSITORY_LIVE_CONTEXT_KIND = 23908;

/** Ephemeral envelopes are held only by the active session resource. */
export function retainLiveContext(
  events: readonly NostrEvent[],
  next: NostrEvent,
  now = Date.now() / 1000,
): NostrEvent[] {
  const body = parseJsonRecord(next.content);
  const scope = exactEventTag(next, "r"),
    span = exactEventTag(next, "d");
  if (
    next.kind !== REPOSITORY_LIVE_CONTEXT_KIND ||
    new TextEncoder().encode(next.content).byteLength > 48 * 1024 ||
    body.schema !== "jj-sync/agent-context-live" ||
    body.version !== 2 ||
    !scope ||
    !span ||
    !exactEventTag(next, "a") ||
    !exactEventTag(next, "h") ||
    body.scope_id !== scope ||
    body.span_id !== span ||
    !Number.isSafeInteger(body.sequence) ||
    Number(body.sequence) < 0 ||
    !Array.isArray(body.records) ||
    body.records.length > 1 ||
    !["running", "completed", "failed", "cancelled"].includes(
      String(body.state),
    ) ||
    next.created_at < now - 300 ||
    next.created_at > now + 60
  )
    return [...events];
  const prefix = `${next.pubkey}:${scope}:${span}`;
  const key = (event: NostrEvent) =>
    `${event.pubkey}:${exactEventTag(event, "r")}:${exactEventTag(event, "d")}`;
  const prior = events.filter((event) => key(event) === prefix);
  if (
    prior.some(
      (event) =>
        Number(parseJsonRecord(event.content).sequence) >=
        Number(body.sequence),
    )
  )
    return [...events];
  const record = body.records[0]
    ? parseAgentContextRecord(body.records[0])
    : undefined;
  if (body.records.length && !record) return [...events];
  return [
    ...events.filter(
      (event) =>
        event.created_at >= now - 300 &&
        (key(event) !== prefix ||
          (body.state === "running" &&
            parseAgentContextRecord(
              (
                parseJsonRecord(event.content).records as unknown[] | undefined
              )?.[0],
            )?.id !== record?.id)),
    ),
    next,
  ].slice(-256);
}

export function repositoryLiveContexts(
  events: readonly NostrEvent[],
  completed: readonly RepositoryAgentCheckpoint[],
): RepositoryAgentCheckpoint[] {
  const groups = new Map<string, NostrEvent[]>();
  for (const event of events.filter(
    (event) => event.kind === REPOSITORY_LIVE_CONTEXT_KIND,
  )) {
    const scope = exactEventTag(event, "r"),
      span = exactEventTag(event, "d");
    if (!scope || !span) continue;
    const key = `${event.pubkey}:${scope}:${span}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.values()].flatMap((group) => {
    const ordered = group.toSorted(
      (a, b) =>
        Number(parseJsonRecord(a.content).sequence) -
        Number(parseJsonRecord(b.content).sequence),
    );
    const latest = ordered.at(-1)!;
    const body = parseJsonRecord(latest.content);
    if (body.state !== "running") return [];
    const spanId = exactEventTag(latest, "d")!,
      scopeId = exactEventTag(latest, "r")!;
    const durable = completed.filter(
      (c) =>
        c.spanId === spanId &&
        c.scopeId === scopeId &&
        c.authorPubkey === latest.pubkey,
    );
    const persisted = new Set(
      durable.flatMap((c) => c.records.map((r) => r.id)),
    );
    const records = ordered
      .flatMap((event) => {
        const value = parseJsonRecord(event.content);
        return Array.isArray(value.records)
          ? value.records.flatMap((item) => {
              const record = parseAgentContextRecord(item);
              return record && !persisted.has(record.id) ? [record] : [];
            })
          : [];
      })
      .sort((a, b) => a.sequence - b.sequence);
    if (!records.length) return [];
    return [
      {
        eventId: latest.id,
        checkpointId: `live:${spanId}`,
        spanId,
        scopeId,
        operationId: durable[0]?.operationId ?? "",
        commitIds: [],
        ...(exactEventTag(latest, "a")
          ? { repositoryAddress: exactEventTag(latest, "a")! }
          : {}),
        ...(exactEventTag(latest, "h")
          ? { channelId: exactEventTag(latest, "h")! }
          : {}),
        authorPubkey: latest.pubkey,
        createdAt: latest.created_at,
        complete: false,
        outcome: "completed" as const,
        records,
        live: true,
      },
    ];
  });
}
