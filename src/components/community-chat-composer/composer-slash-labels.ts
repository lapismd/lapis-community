import type { CommunityEntityLink } from "../../community/community-links.js";
import { encodeJjChangeId } from "../../projects/repository-log-graph.js";

export interface ComposerSlashLabelCatalog {
  tasks: readonly { owner: string; d: string; id: string; title: string }[];
  commits: readonly {
    owner: string;
    d: string;
    sha: string;
    subject: string;
  }[];
  logs: readonly {
    owner: string;
    d: string;
    tab: "log" | "oplog";
    label: string;
    commit?: string;
  }[];
}

export const COMPOSER_SLASH_SUBJECT_MAX = 48;

export function composerSlashTruncatedSubject(
  subject: string,
  max = COMPOSER_SLASH_SUBJECT_MAX,
): string {
  const first = subject.split("\n")[0]?.trim() ?? "";
  if (first.length <= max) return first;
  return `${first.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function composerSlashShortHash(sha: string): string {
  return sha.slice(0, 8);
}

export function composerSlashCommitLabel(subject: string, sha: string): string {
  const message = composerSlashTruncatedSubject(subject);
  const hash = composerSlashShortHash(sha);
  return message ? `${message} ${hash}` : hash;
}

export function composerSlashChangeLabel(changeId: string): string {
  const encoded = encodeJjChangeId(changeId);
  return (encoded || changeId).slice(0, 8);
}

export function composerSlashEntityLabel(
  link: CommunityEntityLink,
  session: ComposerSlashLabelCatalog,
): string | undefined {
  if (link.kind === "task") {
    return session.tasks.find(
      (task) =>
        task.owner === link.owner && task.d === link.d && task.id === link.id,
    )?.title;
  }
  if (link.kind !== "repo") return undefined;
  if (link.tab === "oplog") {
    return session.logs.find(
      (entry) =>
        entry.tab === "oplog" &&
        entry.owner === link.owner &&
        entry.d === link.d &&
        (!link.commit || entry.commit === link.commit),
    )?.label;
  }
  if (!link.commit || (link.tab !== "log" && link.tab !== "commits")) {
    return undefined;
  }
  const commit = session.commits.find(
    (entry) =>
      entry.owner === link.owner &&
      entry.d === link.d &&
      entry.sha === link.commit,
  );
  if (commit) return composerSlashCommitLabel(commit.subject, commit.sha);
  const log = session.logs.find(
    (entry) =>
      entry.tab === "log" &&
      entry.owner === link.owner &&
      entry.d === link.d &&
      entry.commit === link.commit,
  );
  return log
    ? composerSlashCommitLabel(log.label, log.commit ?? link.commit)
    : undefined;
}
