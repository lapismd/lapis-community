import { untrack } from "svelte";
import type { CheckpointConversationIndex } from "../../projects/checkpoint-conversation.js";
import {
  createTranscriptComment,
  resolveTranscriptComment,
} from "../../projects/transcript-comments.js";
import type {
  TranscriptCommentPart,
  TranscriptCommentAnchor,
} from "../../protocol/transcript-comment-anchor.js";
import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import type { CommunityRoomModel } from "../../community/workspace-model.js";
import type { TranscriptCommentSource } from "./transcript-comment-sources.js";
import { durableDraftTarget } from "./transcript-comment-draft.js";
import { createTranscriptCommentDrafts } from "./transcript-comment-drafts.svelte.js";
import {
  transcriptReplyKey,
  type TranscriptReplyTarget,
} from "./transcript-reply-target.js";

export function createTranscriptReplies(owner: {
  index(): CheckpointConversationIndex;
  memberId(): string | undefined;
  session():
    | import("../../projects/data-source.js").ProjectForgeSession
    | undefined;
  receive(event: NostrEvent): void;
  rooms(): readonly CommunityRoomModel[];
  openThread(room: string, root: string, reply?: string): void;
  publish(template: NostrEventTemplate): Promise<NostrEvent>;
}) {
  let selected = $state.raw<TranscriptReplyTarget>();
  let focus = $state.raw<{
    rootId: string;
    anchor: TranscriptCommentAnchor;
    revision: number;
  }>();
  let revision = 0;
  let navigationError = $state("");
  let messageFocus = $state.raw<{ rootId: string; id: string }>();
  let drafts = $state.raw(createTranscriptCommentDrafts());
  const commentDrafts = new Map<string, string>();
  $effect(() => {
    owner.memberId();
    owner.session();
    untrack(() => {
      selected = undefined;
      focus = undefined;
      messageFocus = undefined;
      navigationError = "";
      drafts = createTranscriptCommentDrafts();
      commentDrafts.clear();
    });
  });
  function navigate(channel: string, root: string) {
    const room = owner
      .rooms()
      .find((room) => (room.groupId ?? room.id) === channel);
    if (!room) return false;
    owner.openThread(room.id, root);
    return true;
  }
  return {
    get drafts() {
      return drafts;
    },
    get messageFocus() {
      return messageFocus;
    },
    revealComment(event: NostrEvent) {
      const target = resolveTranscriptComment(event, owner.index());
      if (!target || !navigate(target.checkpoint.channelId!, target.rootId))
        return;
      selected = undefined;
      messageFocus = { rootId: target.rootId, id: event.id };
    },
    get navigationError() {
      return navigationError;
    },
    navigationFailed(cause: unknown) {
      navigationError =
        cause instanceof Error
          ? cause.message
          : "The transcript link could not be opened";
    },
    get selected() {
      return selected;
    },
    get focus() {
      return focus;
    },
    clear(key?: string) {
      if (!key || selected?.key === key) selected = undefined;
    },
    async select(
      source: TranscriptCommentSource,
      excerpt: string,
      part?: TranscriptCommentPart,
    ) {
      const target = durableDraftTarget(owner.index(), {
        source,
        content: "",
        ...(part ? { part } : {}),
      });
      const rootId = target?.rootId ?? source.threadRootId;
      const channelId = target?.checkpoint.channelId ?? source.channelId;
      const viewer = owner.memberId(),
        session = owner.session();
      if (rootId && !owner.index().byId.has(rootId) && session) {
        try {
          const events = await session.queryHttp([{ ids: [rootId] }]);
          if (viewer !== owner.memberId() || session !== owner.session())
            return;
          events.filter((event) => event.id === rootId).forEach(owner.receive);
        } catch {
          navigationError = "The original conversation could not be loaded";
          return;
        }
      }
      const root = rootId && owner.index().byId.get(rootId);
      if (
        !root ||
        !channelId ||
        ![1, 9, 11].includes(root.kind) ||
        root.tags.find(([key]) => key === "h")?.[1] !== channelId
      )
        return;
      if (!navigate(channelId, root.id)) return;
      selected = {
        kind: "transcript",
        key: transcriptReplyKey(source, part),
        source,
        rootId: root.id,
        channelId,
        excerpt,
        ...(part ? { part } : {}),
      };
    },
    reply(event: NostrEvent) {
      const target = resolveTranscriptComment(event, owner.index());
      if (!target || !navigate(target.checkpoint.channelId!, target.rootId))
        return false;
      selected = {
        kind: "comment",
        key: event.id,
        event,
        rootId: target.rootId,
        channelId: target.checkpoint.channelId!,
      };
      return true;
    },
    reveal(anchor: TranscriptCommentAnchor) {
      navigationError = "";
      // Validation is shared with sending; claimed thread tags are never trusted.
      const target = transcriptCommentTarget(owner.index(), anchor);
      if (!target || !navigate(target.checkpoint.channelId!, target.rootId))
        return false;
      focus = { rootId: target.rootId, anchor, revision: ++revision };
      return true;
    },
    content(target: TranscriptReplyTarget) {
      return target.kind === "transcript"
        ? (drafts.get(target.key)?.content ?? "")
        : (commentDrafts.get(target.key) ?? "");
    },
    save(target: TranscriptReplyTarget, content: string) {
      if (target.kind === "comment") commentDrafts.set(target.key, content);
      else
        drafts.save(target.key, {
          source: target.source,
          content,
          ...(target.part ? { part: target.part } : {}),
        });
    },
    bind(target: TranscriptReplyTarget) {
      if (target.kind !== "transcript" || target.source.checkpointEventId)
        return;
      const draft = drafts.get(target.key) ?? {
        source: target.source,
        content: "",
        ...(target.part ? { part: target.part } : {}),
      };
      const saved = durableDraftTarget(owner.index(), draft);
      if (!saved) return;
      const source = {
        ...target.source,
        checkpointEventId: saved.checkpoint.eventId,
        record: saved.record,
        parts: saved.parts,
      };
      drafts.save(target.key, { ...draft, source });
      if (selected?.key === target.key) selected = { ...target, source };
    },
    durable(target: TranscriptReplyTarget) {
      return target.kind === "comment"
        ? resolveTranscriptComment(target.event, owner.index())
        : durableDraftTarget(
            owner.index(),
            drafts.get(target.key) ?? {
              source: target.source,
              content: "",
              ...(target.part ? { part: target.part } : {}),
            },
          );
    },
    async send(target: TranscriptReplyTarget, content: string) {
      const submittedDrafts = drafts;
      if (!content.trim()) throw new Error("Write a reply before sending");
      let template: NostrEventTemplate;
      if (target.kind === "comment") {
        if (!resolveTranscriptComment(target.event, owner.index()))
          throw new Error("This comment is no longer available");
        template = {
          kind: 1111,
          created_at: Math.floor(Date.now() / 1000),
          content: content.trim(),
          tags: [
            ...target.event.tags.filter(
              ([key]) => !["e", "k", "p"].includes(key!),
            ),
            ["e", target.event.id],
            ["k", "1111"],
            ["p", target.event.pubkey],
          ],
        };
      } else {
        const durable = durableDraftTarget(owner.index(), {
          source: drafts.get(target.key)?.source ?? target.source,
          content,
          ...(target.part ? { part: target.part } : {}),
        });
        if (!durable)
          throw new Error(
            "Waiting for this record to be saved. Your draft is retained.",
          );
        template = createTranscriptComment(
          owner.index(),
          durable.anchor,
          content,
        );
      }
      await owner.publish(template);
      if (drafts !== submittedDrafts) return;
      const latest =
        target.kind === "transcript"
          ? drafts.get(target.key)?.content
          : commentDrafts.get(target.key);
      if (latest !== undefined && latest.trim() !== content.trim()) return;
      drafts.remove(target.key);
      commentDrafts.delete(target.key);
      if (selected?.key === target.key) selected = undefined;
    },
  };
}
import { transcriptCommentTarget } from "../../projects/transcript-comments.js";
