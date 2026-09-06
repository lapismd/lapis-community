import type { NostrEvent } from "../../protocol/index.js";

export function formatCommunityEventCopy(
  messageMarkdown: string,
  event: NostrEvent,
): string {
  const markdown = messageMarkdown.trimEnd();
  const eventJson = JSON.stringify(
    {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: event.sig,
    },
    null,
    2,
  );

  return `${markdown}${markdown === "" ? "" : "\n\n"}\`\`\`json\n${eventJson}\n\`\`\``;
}
