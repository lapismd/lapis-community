import type { NostrEvent } from "../protocol/index.js";
import { npubEncode } from "nostr-tools/nip19";

import {
  formatRepositoryLogMessage,
  orderNewestFirst,
  type RepositoryLogGraph,
  type RepositoryLogRevision,
} from "./repository-log.js";
import {
  KIND_JJ_GRAPH_MANIFEST,
  KIND_JJ_OPERATION_GRAPH,
} from "./work-item-filters.js";

const EMPTY: RepositoryLogGraph = { revisions: [], devices: [] };

export function buildRepositoryOperationLog(
  events: readonly NostrEvent[],
): RepositoryLogGraph {
  const revisions: RepositoryLogRevision[] = [];
  let tipId: string | undefined;
  let tipScore = -1;
  let publishedTip: string | undefined;
  let publishedScore = -1;
  for (const event of events) {
    const body = parseJson(event.content);
    if (
      event.kind === KIND_JJ_GRAPH_MANIFEST &&
      isRecord(body) &&
      body.schema === "jj-sync/graph-publication" &&
      isRecord(body.context)
    ) {
      const operationId = asString(body.context.operation_id);
      if (operationId && event.created_at >= publishedScore) {
        publishedTip = operationId;
        publishedScore = event.created_at;
      }
      continue;
    }
    if (
      event.kind !== KIND_JJ_OPERATION_GRAPH ||
      !isRecord(body) ||
      body.schema !== "jj-sync/operation-graph"
    ) {
      continue;
    }
    const operationId = asString(body.operation_id);
    if (!operationId) continue;
    const metadata = isRecord(body.metadata) ? body.metadata : {};
    const endedAt =
      typeof metadata.ended_at_ms === "number" ? metadata.ended_at_ms : 0;
    const parents = stringList(body.parent_operation_ids);
    const commitId = recordedCommitId(body);
    revisions.push({
      eventId: operationId,
      changeId: "",
      ...(commitId ? { commitId } : {}),
      parents,
      message: formatRepositoryLogMessage(
        typeof metadata.description === "string" ? metadata.description : "",
      ),
      reason: parents.length > 1 ? "merge" : "checkpoint",
      createdAt: endedAt ? Math.floor(endedAt / 1_000) : event.created_at,
      root: operationId,
      author: event.pubkey.slice(0, 12),
      ...(/^[a-f0-9]{64}$/u.test(event.pubkey)
        ? { authorEmail: `${npubEncode(event.pubkey)}@nostr.invalid` }
        : {}),
      empty: !commitId,
    });
    if (endedAt >= tipScore) {
      tipId = operationId;
      tipScore = endedAt;
    }
  }
  const tip = publishedTip ?? tipId;
  if (revisions.length === 0) return EMPTY;
  return {
    revisions: orderNewestFirst(revisions),
    devices: tip
      ? [
          {
            publicKey: "",
            alias: "@",
            revisionEventId: tip,
            lastSeen: tipScore > 0 ? Math.floor(tipScore / 1_000) : 0,
          },
        ]
      : [],
  };
}

function recordedCommitId(body: Record<string, unknown>): string | undefined {
  if (!isRecord(body.evolution) || body.evolution.recording !== "recorded") {
    return undefined;
  }
  for (const entry of arrayOf(body.evolution.entries)) {
    const commitId = asString(entry.commit_id);
    if (commitId) return commitId;
  }
  return undefined;
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
