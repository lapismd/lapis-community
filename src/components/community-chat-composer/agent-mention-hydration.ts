import { contentMentionPubkeys } from "../../community/content-mentions.js";
import { communityComposerMentionInsert } from "./composer-mention-insert.js";
import type { CommunityComposerContext } from "./model.js";

export function agentMentionPrefix(
  pubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string {
  const tokens = pubkeys.flatMap((pubkey) => {
    const insert = communityComposerMentionInsert({
      id: pubkey,
      name: displayName(pubkey) ?? "",
    }).trim();
    return insert === "" ? [] : [insert];
  });
  return tokens.length === 0 ? "" : `${tokens.join(" ")} `;
}

export function presentAgentMentionPubkeys(
  value: string,
  pubkeys: readonly string[],
  displayName: (pubkey: string) => string | undefined,
): string[] {
  const mentioned = new Set(
    contentMentionPubkeys(value).map((pubkey) => pubkey.toLowerCase()),
  );
  return pubkeys.filter((pubkey) => {
    if (mentioned.has(pubkey.trim().toLowerCase())) return true;
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
  const insert = communityComposerMentionInsert({
    id: pubkey,
    name: displayName(pubkey) ?? "",
  }).trim();
  let next = value;
  if (insert !== "") {
    next = next.replace(
      new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(insert)}\\s?`, "giu"),
      "$1",
    );
  }
  const name = displayName(pubkey)?.trim();
  if (name) {
    next = next.replace(
      new RegExp(
        `(^|[^\\p{L}\\p{N}_])@${escapeRegExp(name)}(?![\\p{L}\\p{N}_-])\\s?`,
        "iu",
      ),
      "$1",
    );
  }
  return next.replace(/ {2,}/gu, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
