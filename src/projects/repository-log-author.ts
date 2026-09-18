import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export type RepositoryLogAuthorFields = {
  author: string;
  createdAt: number;
  authorEmail?: string;
  authorAvatarUrl?: string;
};

export function repositoryLogGravatarUrl(email: string): string | undefined {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || normalized.startsWith("@")) return undefined;
  return `https://www.gravatar.com/avatar/${bytesToHex(md5(utf8ToBytes(normalized)))}?d=identicon&s=80`;
}

export function repositoryLogAuthorFields(
  body: Record<string, unknown>,
  fallbackCreatedAt: number,
): RepositoryLogAuthorFields {
  const author = personName(body.author) || personName(body.committer);
  const createdAt =
    personSeconds(body.author) ??
    personSeconds(body.committer) ??
    fallbackCreatedAt;
  const authorEmail = personEmail(body.author) || personEmail(body.committer);
  const authorAvatarUrl = repositoryLogGravatarUrl(authorEmail);
  return {
    author,
    createdAt,
    ...(authorEmail ? { authorEmail } : {}),
    ...(authorAvatarUrl ? { authorAvatarUrl } : {}),
  };
}

function personSeconds(person: unknown): number | undefined {
  if (!isRecord(person) || typeof person.timestamp_ms !== "number") {
    return undefined;
  }
  return Math.floor(person.timestamp_ms / 1_000);
}

function personName(person: unknown): string {
  return isRecord(person) && typeof person.name === "string" ? person.name : "";
}

function personEmail(person: unknown): string {
  return isRecord(person) && typeof person.email === "string"
    ? person.email.trim()
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
