import type { CommunityComposerAutocompleteQuery } from "./autocomplete.js";

export type ComposerSlashKind =
  | "repositories"
  | "projects"
  | "tasks"
  | "commits"
  | "logs"
  | "channels";

export const COMPOSER_SLASH_KIND_ALIASES: Record<
  ComposerSlashKind,
  readonly string[]
> = {
  repositories: ["repositories", "repos", "repository", "repo"],
  projects: ["projects", "project"],
  tasks: ["tasks", "task"],
  commits: ["commits", "commit"],
  logs: ["logs", "log", "oplog"],
  channels: ["channels", "channel"],
};

const SLASH = /(?:^|[\s([{])\/([^\s]*)$/u;

export function detectComposerSlash(
  _value: string,
  cursor: number,
  line: string,
): CommunityComposerAutocompleteQuery | null {
  const match = SLASH.exec(line);
  if (!match) return null;
  const query = match[1] ?? "";
  return {
    kind: "slash",
    query,
    from: cursor - query.length - 1,
    to: cursor,
  };
}

export function parseComposerSlashQuery(query: string): {
  stage: "category" | "entry";
  kind?: ComposerSlashKind;
  filter: string;
} {
  const separator = query.indexOf("/");
  const token = (
    separator === -1 ? query : query.slice(0, separator)
  ).toLocaleLowerCase();
  const kind = resolveComposerSlashKind(token);
  if (kind !== undefined) {
    return {
      stage: "entry",
      kind,
      filter: separator === -1 ? "" : query.slice(separator + 1),
    };
  }
  return { stage: "category", filter: query };
}

export function composerSlashCategoryRewrite(kind: ComposerSlashKind): string {
  return `/${kind}/`;
}

export function resolveComposerSlashKind(
  token: string,
): ComposerSlashKind | undefined {
  const normalized = token.toLocaleLowerCase();
  for (const kind of Object.keys(
    COMPOSER_SLASH_KIND_ALIASES,
  ) as ComposerSlashKind[]) {
    if (COMPOSER_SLASH_KIND_ALIASES[kind].includes(normalized)) return kind;
  }
  return undefined;
}
