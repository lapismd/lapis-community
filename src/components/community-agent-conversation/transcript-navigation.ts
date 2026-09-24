import { toast } from "svelte-sonner";
import type { CommunityEntityLink } from "../../community/community-links.js";
import { transcriptCommentTarget } from "../../projects/transcript-comments.js";
import {
  checkpointIndex,
  type CheckpointConversationIndex,
} from "../../projects/checkpoint-conversation.js";
import type { ProjectForgeSession } from "../../projects/data-source.js";
import type { NostrEvent } from "../../protocol/index.js";
import {
  useCommunityEntityNavigation,
  provideCommunityEntityNavigation,
} from "../community-entity-chip/navigation.js";
import type { createTranscriptReplies } from "./transcript-replies.svelte.js";

export function verifiedTranscriptLink(
  link: Extract<CommunityEntityLink, { kind: "message" }>,
  index: CheckpointConversationIndex,
  channel: string,
) {
  if (!link.checkpoint || !link.record) return;
  const target = transcriptCommentTarget(index, {
    checkpointEventId: link.checkpoint,
    recordId: link.record,
    ...(link.part ? { part: link.part } : {}),
  });
  if (
    !target ||
    target.checkpoint.channelId !== channel ||
    target.rootId !== (link.threadRootId ?? link.eventId) ||
    ![target.rootId, target.request.id].includes(link.eventId)
  )
    return;
  return target;
}
export function provideTranscriptNavigation(owner: {
  session(): ProjectForgeSession | undefined;
  index(): CheckpointConversationIndex;
  receive(event: NostrEvent): void;
  channel(roomId: string): string | undefined;
  replies: ReturnType<typeof createTranscriptReplies>;
}) {
  const navigation = useCommunityEntityNavigation();
  if (!navigation) return;
  async function open(link: Extract<CommunityEntityLink, { kind: "message" }>) {
    const channel = owner.channel(link.roomId);
    if (!channel || !link.checkpoint)
      throw new Error("The original conversation is unavailable");
    const session = owner.session();
    let target = verifiedTranscriptLink(link, owner.index(), channel);
    if (!target && session) {
      const manifest = await session.queryHttp([{ ids: [link.checkpoint] }]);
      const signed = checkpointIndex(manifest).byId.get(link.checkpoint);
      if (!signed || signed.kind !== 3907)
        throw new Error("The saved checkpoint is unavailable");
      const payload = JSON.parse(signed.content);
      const pages: unknown = payload.page_event_ids;
      if (
        !Array.isArray(pages) ||
        pages.length > 1000 ||
        !pages.every(
          (id) => typeof id === "string" && /^[a-f0-9]{64}$/u.test(id),
        )
      )
        throw new Error("The saved checkpoint is invalid");
      manifest.forEach(owner.receive);
      (await session.queryHttp([{ ids: pages }])).forEach(owner.receive);
      const records =
        owner.index().checkpoints.find((item) => item.eventId === signed.id)
          ?.records ?? [];
      const ids = [
        ...new Set(
          [
            link.eventId,
            link.threadRootId,
            ...records.map((item) => item.sourceEventId),
          ].filter((id): id is string => !!id && /^[a-f0-9]{64}$/u.test(id)),
        ),
      ];
      (await session.queryHttp([{ ids }])).forEach(owner.receive);
      target = verifiedTranscriptLink(link, owner.index(), channel);
    }
    if (target) owner.replies.reveal(target.anchor);
    else
      throw new Error(
        "This transcript link does not match a saved item in this conversation",
      );
  }
  provideCommunityEntityNavigation({
    ...navigation,
    open(link) {
      if (link.kind !== "message" || !link.checkpoint) {
        owner.replies.clear();
        navigation.open(link);
        return;
      }
      void open(link).catch((cause) => {
        owner.replies.navigationFailed(cause);
        toast.error(owner.replies.navigationError);
      });
    },
  });
}
