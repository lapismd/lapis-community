import { contentMentionPubkeys } from "../../community/content-mentions.js";
import type {
  CommunityMemberModel,
  CommunityMessageModel,
} from "../community-workspace/model.js";

export function implicitTaggedMentionMembers(
  message: Pick<
    CommunityMessageModel,
    "activity" | "authorId" | "content" | "mentionPubkeys" | "parentMessageId"
  >,
  members: readonly CommunityMemberModel[],
): CommunityMemberModel[] {
  const tagged = message.mentionPubkeys ?? [];
  if (message.activity !== undefined || tagged.length === 0) return [];
  const authorId = message.authorId.trim().toLowerCase();
  const inBody = new Set(
    contentMentionPubkeys(message.content).map((pubkey) =>
      pubkey.trim().toLowerCase(),
    ),
  );
  const reply = message.parentMessageId !== undefined;
  const seen = new Set<string>();
  const implicit: CommunityMemberModel[] = [];
  for (const pubkey of tagged) {
    const id = pubkey.trim().toLowerCase();
    if (!id || id === authorId || seen.has(id) || inBody.has(id)) continue;
    const member = members.find(
      (candidate) => candidate.id.trim().toLowerCase() === id,
    );
    if (member === undefined) continue;
    if (nameMentionedInContent(message.content, member)) continue;
    if (reply && member.kind !== "agent") continue;
    seen.add(id);
    implicit.push(member);
  }
  return implicit;
}

export function taggedMentionAvatarsLabel(
  members: readonly CommunityMemberModel[],
): string {
  if (members.length === 0) return "Tagged members";
  if (members.length === 1) return `Tagged ${members[0]!.name}`;
  if (members.length === 2) {
    return `Tagged ${members[0]!.name} and ${members[1]!.name}`;
  }
  const leading = members
    .slice(0, -1)
    .map((member) => member.name)
    .join(", ");
  return `Tagged ${leading}, and ${members.at(-1)!.name}`;
}

function nameMentionedInContent(
  content: string,
  member: Pick<CommunityMemberModel, "handle" | "name">,
): boolean {
  return [member.name, member.handle].some((name) =>
    mentionNamePresent(content, name),
  );
}

function mentionNamePresent(content: string, name: string): boolean {
  const trimmed = name.trim();
  if (trimmed === "") return false;
  return new RegExp(
    `(^|[^\\p{L}\\p{N}_])@${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}_-])`,
    "iu",
  ).test(content);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
