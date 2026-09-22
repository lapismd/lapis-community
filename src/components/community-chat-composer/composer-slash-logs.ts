import type { NostrEvent } from "../../protocol/index.js";
import { KIND_JJ_REVISION } from "../../projects/work-item-filters.js";
import {
  composerSlashChangeLabel,
  composerSlashShortHash,
  composerSlashTruncatedSubject,
} from "./composer-slash-labels.js";

export function snapshotComposerSlashLogs(input: {
  commits: readonly {
    owner: string;
    d: string;
    sha: string;
    subject: string;
  }[];
  repositories: readonly { owner: string; d: string }[];
  selected?: { owner: string; d: string };
  events?: readonly NostrEvent[];
}): Array<{
  owner: string;
  d: string;
  tab: "log" | "oplog";
  label: string;
  detail: string;
  commit: string;
  changeId?: string;
}> {
  const logs = input.commits.map((commit) => ({
    owner: commit.owner,
    d: commit.d,
    tab: "log" as const,
    label: composerSlashTruncatedSubject(commit.subject),
    detail: composerSlashShortHash(commit.sha),
    commit: commit.sha,
  }));
  const repo =
    input.selected ??
    (input.repositories.length === 1 ? input.repositories[0] : undefined);
  if (!repo || !input.events?.length) return logs;
  const seen = new Set<string>();
  for (const revision of composerSlashRevisions(input.events)) {
    const key = `${repo.owner}:${repo.d}:${revision.changeId}:${revision.commit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    logs.push({
      owner: repo.owner,
      d: repo.d,
      tab: "oplog",
      label: composerSlashChangeLabel(revision.changeId),
      detail: composerSlashTruncatedSubject(revision.message),
      commit: revision.commit,
      changeId: revision.changeId,
    });
  }
  return logs;
}

function composerSlashRevisions(
  events: readonly NostrEvent[],
): Array<{ changeId: string; commit: string; message: string }> {
  const revisions: Array<{
    changeId: string;
    commit: string;
    message: string;
  }> = [];
  for (const event of events) {
    if (event.kind !== KIND_JJ_REVISION) continue;
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(event.content);
      if (!parsed || typeof parsed !== "object") continue;
      body = parsed as Record<string, unknown>;
    } catch {
      continue;
    }
    if (body.schema !== "jj-sync/revision") continue;
    const commit =
      typeof body.commit_id === "string" ? body.commit_id : undefined;
    const tagged = event.tags.find((tag) => tag[0] === "i")?.[1];
    const changeId =
      (typeof body.change_id_hex === "string" ? body.change_id_hex : tagged) ??
      "";
    if (!commit || !/^[0-9a-fA-F]{32}$/u.test(changeId)) continue;
    revisions.push({
      changeId: changeId.toLowerCase(),
      commit,
      message: typeof body.description === "string" ? body.description : "",
    });
  }
  return revisions;
}
