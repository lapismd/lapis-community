import type { CommunityAgentRuntimeResources } from "./agent-runtime-contracts.js";
import { observerRecord, observerText } from "./agent-observer.js";

const count = (value: unknown): number | undefined =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;

export function parseAgentRuntimeResources(
  value: unknown,
): CommunityAgentRuntimeResources | undefined {
  const source = observerRecord(value);
  const workers = observerRecord(source.workers);
  const providerId = observerText(source.providerId, 256);
  const status = source.status;
  const busy = count(workers.busy);
  const idle = count(workers.idle);
  const starting = count(workers.starting);
  const stopping = count(workers.stopping);
  const sessions = count(source.sessions);
  const observedAt = count(source.observedAt);
  if (
    source.scope !== "provider-shared" ||
    !providerId ||
    !["available", "partial", "unavailable"].includes(String(status)) ||
    busy === undefined ||
    idle === undefined ||
    starting === undefined ||
    stopping === undefined ||
    sessions === undefined ||
    observedAt === undefined
  )
    return;
  const rssBytes = count(source.rssBytes);
  return {
    scope: "provider-shared",
    providerId,
    status: status as CommunityAgentRuntimeResources["status"],
    observedAt,
    workers: { busy, idle, starting, stopping },
    sessions,
    rssBytes: status === "unavailable" ? null : (rssBytes ?? null),
  };
}
