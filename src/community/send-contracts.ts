export interface CommunitySendActions {
  sendInboxMessage?(
    content: string,
    mentionPubkeys?: readonly string[],
  ): Promise<void>;
  sendMessage(
    roomId: string,
    content: string,
    mentionPubkeys?: readonly string[],
  ): Promise<void>;
  sendReply(
    rootMessageId: string,
    content: string,
    mentionPubkeys?: readonly string[],
  ): Promise<void>;
}

export interface CommunityWorkspaceSendHandlers {
  onSendMessage?: (
    roomId: string,
    content: string,
    mentionPubkeys?: readonly string[],
  ) => void | Promise<void>;
  onSendReply?: (
    rootMessageId: string,
    content: string,
    mentionPubkeys?: readonly string[],
  ) => void | Promise<void>;
}
