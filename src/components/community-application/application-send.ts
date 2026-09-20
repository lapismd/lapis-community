import type { CommunityReplyTarget } from "../../community/contracts.js";
import type {
  CommunityRoomModel,
  CommunityWorkspaceModel,
} from "../../community/workspace-model.js";
import type { CommunityApplicationPanel } from "./navigation.js";

export function createCommunityApplicationSend(host: {
  sendReply(
    rootMessageId: string,
    content: string,
    mentionPubkeys?: readonly string[],
  ): Promise<void>;
  sendMessage(
    roomId: string,
    content: string,
    mentionPubkeys?: readonly string[],
  ): Promise<void>;
  sendDirectMessage(
    recipients: readonly string[],
    content: string,
    replyToEventId?: string,
  ): Promise<void>;
  clearReplyTarget(): void;
  replyTarget(): CommunityReplyTarget | undefined;
  activePanel(): CommunityApplicationPanel;
  activeRoom(): Pick<
    CommunityRoomModel,
    "id" | "kind" | "conversation" | "participantIds"
  >;
  workspace(): Pick<CommunityWorkspaceModel, "currentMemberId">;
  runParticipationAction(
    roomId: string,
    kind: "reply" | "message",
    action: () => Promise<void>,
  ): Promise<void>;
  openPanel(panel: CommunityApplicationPanel): void;
  setLastAction(action: string): void;
  error(message: string): void;
}) {
  return {
    async sendThreadReply(
      rootMessageId: string,
      content: string,
      mentionPubkeys?: readonly string[],
    ): Promise<void> {
      try {
        const panel = host.activePanel();
        const replyTargetId =
          panel.kind === "thread"
            ? (panel.replyTargetId ?? rootMessageId)
            : rootMessageId;
        await host.runParticipationAction(
          panel.kind === "thread" ? panel.roomId : host.activeRoom().id,
          "reply",
          () => host.sendReply(replyTargetId, content, mentionPubkeys),
        );
        if (panel.kind === "thread") {
          host.openPanel({
            kind: "thread",
            roomId: panel.roomId,
            rootMessageId: panel.rootMessageId,
          });
        } else {
          host.clearReplyTarget();
        }
        host.setLastAction("sent-reply");
      } catch (cause) {
        host.error(
          cause instanceof Error ? cause.message : "Reply could not be sent",
        );
        throw cause;
      }
    },
    async sendWorkspaceMessage(
      roomId: string,
      content: string,
      mentionPubkeys?: readonly string[],
    ): Promise<void> {
      try {
        await host.runParticipationAction(roomId, "message", async () => {
          const room = host.activeRoom();
          if (
            room.kind === "direct" &&
            room.conversation?.transport !== "buzz-dm"
          ) {
            const recipients =
              room.participantIds?.filter(
                (key) => key !== host.workspace().currentMemberId,
              ) ?? roomId.replace(/^dm:/u, "").split(",").filter(Boolean);
            await host.sendDirectMessage(
              recipients,
              content,
              host.replyTarget()?.eventId,
            );
            return;
          }
          if (host.replyTarget()) {
            await host.sendReply(
              host.replyTarget()!.eventId,
              content,
              mentionPubkeys,
            );
            return;
          }
          await host.sendMessage(roomId, content, mentionPubkeys);
        });
        host.clearReplyTarget();
        host.setLastAction("sent-message");
      } catch (cause) {
        host.error(
          cause instanceof Error ? cause.message : "Message could not be sent",
        );
        throw cause;
      }
    },
  };
}
