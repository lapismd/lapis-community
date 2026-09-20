export function sendConversationContent(
  send:
    | ((
        content: string,
        mentionPubkeys?: readonly string[],
      ) => void | Promise<void>)
    | undefined,
  content: string,
  mentionPubkeys: readonly string[] = [],
): void | Promise<void> {
  return mentionPubkeys.length > 0
    ? send?.(content, mentionPubkeys)
    : send?.(content);
}
