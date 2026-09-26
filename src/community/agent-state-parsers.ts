import type {
  CommunityAgentMemoryRecord,
  CommunityAgentMemoryState,
  CommunityAgentRuntimeState,
} from "./agent-contracts.js";
import {
  parseRuntimeAgents,
  parseRuntimeCatalog,
} from "./agent-runtime-catalog.js";
import { optionalRuntimeDefaults } from "./agent-runtime-defaults-parse.js";
import { parseAgentRuntimeResources } from "./agent-runtime-resources.js";

export { observerRecord, observerText } from "./agent-observer.js";
import { observerRecord, observerText } from "./agent-observer.js";

export function parseRuntimeState(
  value: Record<string, unknown> | undefined,
): CommunityAgentRuntimeState | undefined {
  if (!value) return;
  const agentId = observerText(value.agentId, 256);
  const host = observerRecord(value.host);
  const configured = observerRecord(value.configured);
  const effective = observerRecord(value.effective);
  const memory = observerRecord(value.memory);
  const hostId = observerText(host.id, 256);
  const hostKind = observerText(host.kind, 64);
  const effectiveRuntime = observerText(effective.runtimeAgent, 256);
  const parsedCatalog = parseRuntimeCatalog(value.catalog);
  if (!agentId || !hostId || !hostKind || !effectiveRuntime || !parsedCatalog)
    return;
  const runtimeAgents = parseRuntimeAgents(value.runtimeAgents);
  const saved =
    value.saved === null
      ? null
      : optionalRuntimeDefaults(observerRecord(value.saved));
  const resources = parseAgentRuntimeResources(value.resources);
  return {
    agentId,
    host: {
      id: hostId,
      kind: hostKind,
      ...(observerText(host.workspace, 4_096)
        ? { workspace: observerText(host.workspace, 4_096) }
        : {}),
    },
    runtimeAgents,
    configured: {
      runtimeAgent:
        observerText(configured.runtimeAgent, 256) || effectiveRuntime,
      ...optionalRuntimeDefaults(configured),
    },
    ...(saved === undefined ? {} : { saved }),
    effective: {
      runtimeAgent: effectiveRuntime,
      ...optionalRuntimeDefaults(effective),
    },
    catalog: parsedCatalog,
    tools: Array.isArray(value.tools)
      ? value.tools.flatMap((entry) => {
          const tool = observerRecord(entry);
          const name = observerText(tool.name, 256);
          return name && (tool.effect === "read" || tool.effect === "write")
            ? [{ name, effect: tool.effect }]
            : [];
        })
      : [],
    ...(value.bootstrapRevision === null
      ? { bootstrapRevision: null }
      : observerText(value.bootstrapRevision, 256)
        ? { bootstrapRevision: observerText(value.bootstrapRevision, 256) }
        : {}),
    memory: {
      enabled: memory.enabled === true,
      candidates: Number.isSafeInteger(memory.candidates)
        ? Math.max(0, Number(memory.candidates))
        : 0,
    },
    ...(resources ? { resources } : {}),
  };
}

export function parseMemoryState(
  value: Record<string, unknown> | undefined,
): CommunityAgentMemoryState | undefined {
  if (!value) return;
  const channelId = observerText(value.channelId, 512);
  if (!channelId || !Array.isArray(value.records)) return;
  const records = value.records.flatMap<CommunityAgentMemoryRecord>((entry) => {
    const item = observerRecord(entry);
    const kind = observerText(item.kind, 64);
    const createdAt = Number(item.createdAt);
    if (!kind || !Number.isSafeInteger(createdAt)) return [];
    if (item.type === "candidate") {
      const candidateId = observerText(item.candidateId, 256);
      const claim = observerText(item.claim, 4_096);
      const origin = observerText(item.origin, 64);
      if (
        !candidateId ||
        !claim ||
        !origin ||
        !["review", "approved", "rejected"].includes(String(item.status))
      )
        return [];
      return [
        {
          type: "candidate" as const,
          candidateId,
          kind,
          claim,
          origin,
          status: item.status as "review" | "approved" | "rejected",
          createdAt,
          evidence: Array.isArray(item.evidence)
            ? item.evidence.flatMap((entry) => {
                const evidence = observerRecord(entry);
                const eventId = observerText(evidence.eventId, 128);
                const evidenceHash = observerText(evidence.evidenceHash, 128);
                const conversationKey = observerText(
                  evidence.conversationKey,
                  512,
                );
                const observedAt = Number(evidence.observedAt);
                return eventId &&
                  evidenceHash &&
                  conversationKey &&
                  Number.isSafeInteger(observedAt)
                  ? [{ eventId, evidenceHash, conversationKey, observedAt }]
                  : [];
              })
            : [],
        },
      ];
    }
    if (item.type === "memory") {
      const memoryId = observerText(item.memoryId, 256);
      const content = observerText(item.content, 4_096);
      const revision = Number(item.revision);
      if (
        !memoryId ||
        !content ||
        !["active", "retracted"].includes(String(item.status)) ||
        !Number.isSafeInteger(revision)
      )
        return [];
      return [
        {
          type: "memory" as const,
          memoryId,
          kind,
          content,
          status: item.status as "active" | "retracted",
          revision,
          evidenceHashes: Array.isArray(item.evidenceHashes)
            ? item.evidenceHashes
                .map((hash) => observerText(hash, 128))
                .filter(Boolean)
            : [],
          createdAt,
        },
      ];
    }
    return [];
  });
  return { channelId, records };
}
