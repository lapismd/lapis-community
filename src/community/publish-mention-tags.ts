const PUBKEY = /^[0-9a-f]{64}$/u;

export function normalizeMentionPubkeys(
  pubkeys: readonly string[] = [],
): string[] {
  return [
    ...new Set(
      pubkeys
        .map((pubkey) => pubkey.trim().toLowerCase())
        .filter((pubkey) => PUBKEY.test(pubkey)),
    ),
  ];
}

export function publishMentionTags(
  tags: readonly (readonly string[])[],
  mentionPubkeys: readonly string[] = [],
): string[][] {
  const present = new Set(
    tags
      .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
      .map((tag) => tag[1]!.toLowerCase()),
  );
  const extra = normalizeMentionPubkeys(mentionPubkeys).filter(
    (pubkey) => !present.has(pubkey),
  );
  return [
    ...tags.map((tag) => [...tag]),
    ...extra.map((pubkey) => ["p", pubkey]),
  ];
}

export function withPublishMentionTags<
  T extends { tags: readonly (readonly string[])[] },
>(template: T, mentionPubkeys: readonly string[] = []): T {
  return {
    ...template,
    tags: publishMentionTags(template.tags, mentionPubkeys),
  };
}
