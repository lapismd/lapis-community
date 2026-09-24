import type { CommunityAgentActivityItem } from "./agent-contracts.js";
import { canonicalEntry } from "./canonical-transcript.js";
import {
  object,
  parseCanonicalTranscript,
} from "../protocol/agent-transcript.js";

/** Reconstruct encrypted-journal records in memory, never a separate plaintext cache. */
export function canonicalActivity(
  activity: readonly CommunityAgentActivityItem[],
): CommunityAgentActivityItem[] {
  const groups = new Map<
    string,
    {
      item: CommunityAgentActivityItem;
      count: number;
      parts: Map<number, string>;
      invalid: boolean;
    }
  >();
  for (const item of activity) {
    const fragment = object(object(item.frame.payload).capture);
    if (fragment.schema !== "lapis.transcript-fragment/1") continue;
    const { recordId, index, count, data } = fragment;
    if (
      typeof recordId !== "string" ||
      !Number.isSafeInteger(index) ||
      !Number.isSafeInteger(count) ||
      Number(index) < 0 ||
      Number(index) >= Number(count) ||
      Number(count) > 1049 ||
      typeof data !== "string" ||
      data.length > 16000
    )
      continue;
    const key = `${item.agentPubkey}:${item.frame.sessionId}:${recordId}`;
    const group = groups.get(key) ?? {
      item,
      count: Number(count),
      parts: new Map<number, string>(),
      invalid: false,
    };
    group.invalid ||=
      group.count !== count ||
      (group.parts.has(Number(index)) &&
        group.parts.get(Number(index)) !== data);
    group.parts.set(Number(index), data);
    groups.set(key, group);
  }
  const canonicalTurns = new Set<string>(),
    derived: CommunityAgentActivityItem[] = [];
  for (const group of groups.values()) {
    const item = group.item;
    const text = Array.from(
      { length: group.count },
      (_, i) => group.parts.get(i) ?? "",
    ).join("");
    const record =
      group.invalid || group.parts.size !== group.count
        ? undefined
        : parseCanonicalTranscript(text);
    const payload = object(item.frame.payload);
    if (
      record &&
      (record.threadId !== item.frame.sessionId ||
        record.turnId !== item.frame.turnId ||
        record.id !== object(payload.capture).recordId)
    )
      continue;
    if (record) canonicalTurns.add(`${item.agentPubkey}:${record.turnId}`);
    const entry = record
      ? canonicalEntry(
          record,
          item.agentPubkey,
          typeof payload.sourceEventId === "string"
            ? payload.sourceEventId
            : undefined,
          typeof payload.authorPubkey === "string"
            ? payload.authorPubkey
            : undefined,
        )
      : {
          id: `gap:${item.id}`,
          type: "context" as const,
          label: "Capture gap",
          text: "A completed transcript record is missing fragments.",
          createdAt: item.frame.timestamp,
        };
    if (!entry) continue;
    derived.push({
      ...item,
      id: record?.id ?? `gap:${item.id}`,
      frame: {
        ...item.frame,
        kind: "canonical_record",
        payload: { ...payload, capture: undefined, canonical: record, entry },
      },
    });
  }
  return [
    ...activity.filter((item) => {
      if (item.frame.kind === "transcript_record") return false;
      const entry = object(object(item.frame.payload).entry);
      return !(
        canonicalTurns.has(`${item.agentPubkey}:${item.frame.turnId}`) &&
        [
          "message",
          "thinking",
          "tool",
          "plan",
          "permission",
          "usage",
          "turn",
        ].includes(String(entry.type))
      );
    }),
    ...derived,
  ];
}
