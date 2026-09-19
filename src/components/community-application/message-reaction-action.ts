export function createMessageReactionAction(owner: {
  run(
    id: string,
    emoji: string,
    custom?: { shortcode: string; url: string },
  ): Promise<void>;
  done(action: string): void;
  error(message: string): void;
}) {
  return async (
    id: string,
    emoji: string,
    custom?: { shortcode: string; url: string },
  ) => {
    try {
      await owner.run(id, emoji, custom);
      owner.done(`reaction:${id}:${emoji}`);
    } catch (cause) {
      owner.error(
        cause instanceof Error ? cause.message : "Reaction could not be saved",
      );
      throw cause;
    }
  };
}
