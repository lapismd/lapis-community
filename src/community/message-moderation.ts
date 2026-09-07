import { verifyEvent } from "nostr-tools/pure";

import type { NostrEvent } from "../protocol/index.js";

import type { CommunityMessageReport } from "./contracts.js";

export const COMMUNITY_MESSAGE_EDIT_KIND = 40_003;

export function configuredCuratorPubkeys(
  events: readonly NostrEvent[],
): string[] {
  const snapshots = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 39_002 || !verifyEvent(event)) continue;
    const groupId = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (groupId === undefined) continue;
    const current = snapshots.get(groupId);
    if (
      current === undefined ||
      event.created_at > current.created_at ||
      (event.created_at === current.created_at && event.id > current.id)
    ) {
      snapshots.set(groupId, event);
    }
  }
  return [
    ...new Set(
      [...snapshots.values()].flatMap((snapshot) =>
        snapshot.tags
          .filter(
            (tag) =>
              tag[0] === "p" &&
              tag[1] !== undefined &&
              tag
                .slice(2)
                .some(
                  (role) => role === "curator" || role === "registry-curator",
                ),
          )
          .map((tag) => tag[1]!),
      ),
    ),
  ].toSorted();
}

export function formatCommunityMessageReport(
  target: Pick<NostrEvent, "id" | "pubkey" | "content">,
  roomName: string,
  report: CommunityMessageReport,
): string {
  const quote = target.content
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return [
    "🚩 **Community message report**",
    "",
    `**Reason:** ${messageReportReason(report.category)}`,
    `**Room:** ${roomName}`,
    `**Author:** \`${target.pubkey}\``,
    `**Event:** \`${target.id}\``,
    "",
    quote,
    ...(report.context?.trim()
      ? ["", `**Additional context:** ${report.context.trim()}`]
      : []),
  ].join("\n");
}

function messageReportReason(
  category: CommunityMessageReport["category"],
): string {
  switch (category) {
    case "spam":
      return "Spam";
    case "profanity":
      return "Profanity or hate speech";
    case "nudity":
      return "Nudity or sexual content";
    case "impersonation":
      return "Impersonation";
    case "malware":
      return "Malware or scam";
    case "illegal":
      return "Illegal content";
    case "other":
      return "Other";
  }
}
