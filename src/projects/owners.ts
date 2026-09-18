export interface OwnersRule {
  path: string;
  pubkeys: string[];
}

export interface OwnersDocument {
  rules: OwnersRule[];
}

const PUBKEY = /^[0-9a-f]{64}$/iu;

export function parseOwnersDocument(text: string): OwnersDocument {
  if (text.includes("\0")) return { rules: [] };
  const rules: OwnersRule[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parsed = parseOwnersLine(line);
    if (!parsed) return { rules: [] };
    rules.push(parsed);
  }
  return { rules };
}

function parseOwnersLine(line: string): OwnersRule | undefined {
  const fields = line.split(/\s+/u).filter(Boolean);
  if (fields.length === 0) return undefined;
  let path = "*";
  let start = 0;
  if (!PUBKEY.test(fields[0]!)) {
    path = fields[0]!.replace(/^\.\//u, "");
    start = 1;
  }
  const pubkeys = fields.slice(start).map((field) => field.toLowerCase());
  if (pubkeys.length === 0 || pubkeys.some((field) => !PUBKEY.test(field)))
    return undefined;
  return { path, pubkeys };
}

export function ownersForPath(
  document: OwnersDocument,
  path: string,
): string[] {
  let matched: OwnersRule | undefined;
  for (const rule of document.rules) {
    if (ownersPathMatches(rule.path, path)) {
      if (!matched || rule.path.length >= matched.path.length) matched = rule;
    }
  }
  return matched ? [...matched.pubkeys] : [];
}

export async function loadOwnersFromBlob(
  load: () => Promise<{
    contents?: string;
    binary?: boolean;
    too_large?: boolean;
  }>,
  signal?: AbortSignal,
): Promise<OwnersDocument | undefined> {
  try {
    const blob = await load();
    if (signal?.aborted) return undefined;
    if (blob.binary || blob.too_large || !blob.contents) return undefined;
    return parseOwnersDocument(blob.contents);
  } catch (cause) {
    if (signal?.aborted) throw cause;
    return undefined;
  }
}

export function ownerReviewerPubkeys(
  document: OwnersDocument | undefined,
): string[] {
  if (!document) return [];
  return [
    ...new Set(document.rules.flatMap((rule) => rule.pubkeys)),
  ].toSorted();
}

export function requiredOwnerGroups(
  document: OwnersDocument,
  paths: readonly string[],
): OwnersRule[] {
  const groups = new Map<string, OwnersRule>();
  for (const path of paths) {
    const pubkeys = ownersForPath(document, path);
    if (pubkeys.length === 0) continue;
    const key = pubkeys.join(",");
    if (!groups.has(key)) groups.set(key, { path, pubkeys });
  }
  return [...groups.values()];
}

function ownersPathMatches(rulePath: string, filePath: string): boolean {
  if (rulePath === "*" || rulePath === "") return true;
  const normalized = filePath.replace(/^\.\//u, "");
  if (rulePath === normalized) return true;
  if (rulePath.endsWith("/")) return normalized.startsWith(rulePath);
  return normalized.startsWith(`${rulePath}/`);
}
