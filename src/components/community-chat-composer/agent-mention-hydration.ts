import type { CommunityComposerContext } from "./model.js";

export function agentMentionPrefix(
  pubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string {
  const names = pubkeys
    .map((pubkey) => displayName(pubkey)?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length === 0
    ? ""
    : `${names.map((name) => `@${name}`).join(" ")} `;
}

export function presentAgentMentionPubkeys(
  value: string,
  pubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string[] {
  return pubkeys.filter((pubkey) => {
    const name = displayName(pubkey)?.trim();
    if (!name) return false;
    return new RegExp(
      `(^|[^\\p{L}\\p{N}_])@${escapeRegExp(name)}(?![\\p{L}\\p{N}_-])`,
      "iu",
    ).test(value);
  });
}

export function missingAgentMentionPrefix(
  value: string,
  pubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string {
  const present = new Set(
    presentAgentMentionPubkeys(value, pubkeys, displayName),
  );
  return agentMentionPrefix(
    pubkeys.filter((pubkey) => !present.has(pubkey)),
    displayName,
  );
}

export function hydrateAgentMentionDraft(
  value: string,
  pubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string {
  const prefix = missingAgentMentionPrefix(value, pubkeys, displayName);
  return prefix === "" ? value : `${prefix}${value}`;
}

export function restoreAgentMentionDraft(
  explicitAgentPubkeys: readonly string[],
  audiencePubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string {
  return agentMentionPrefix(
    [...new Set([...explicitAgentPubkeys, ...audiencePubkeys])],
    displayName,
  );
}

export function removedAgentMentionPubkeys(
  value: string,
  pubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string[] {
  const present = new Set(
    presentAgentMentionPubkeys(value, pubkeys, displayName),
  );
  return pubkeys.filter((pubkey) => !present.has(pubkey));
}

export function canHydrateAgentMentions(
  context: CommunityComposerContext | undefined,
  enabled: boolean,
  scope: string | null,
): boolean {
  return enabled && scope !== null && context?.kind !== "edit";
}

export function stripAgentMention(
  value: string,
  pubkey: string,
  displayName: (pubkey: string) => string | undefined,
): string {
  const name = displayName(pubkey)?.trim();
  if (!name) return value;
  return value
    .replace(
      new RegExp(
        `(^|[^\\p{L}\\p{N}_])@${escapeRegExp(name)}(?![\\p{L}\\p{N}_-])\\s?`,
        "iu",
      ),
      "$1",
    )
    .replace(/ {2,}/gu, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
