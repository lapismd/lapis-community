import { agentContextMessageRole } from "../../projects/repository-agent-context.js";
import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
import { encodeJjChangeId } from "../../projects/repository-log-graph.js";
import { projectRouteToHash } from "../community-application/project-route.js";
import type { AgentContextNavigation } from "./navigation.js";

export interface AgentContextReference {
  key: string;
  kind: "commit" | "change" | "log" | "repository" | "channel" | "thread";
  label: string;
  title: string;
  href?: string;
  disabled?: boolean;
  select?: () => void;
}
const short = (id: string) =>
  id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

export function agentContextReferences(
  checkpoints: readonly RepositoryAgentCheckpoint[],
  repositoryAddress?: string,
  navigation?: AgentContextNavigation,
): AgentContextReference[] {
  const references = new Map<string, AgentContextReference>();
  const logCommits = new Map<string, string>();
  const add = (reference: AgentContextReference) =>
    references.set(reference.key, reference);
  for (const checkpoint of checkpoints.toSorted(
    (a, b) => b.createdAt - a.createdAt || b.eventId.localeCompare(a.eventId),
  )) {
    const repository = checkpoint.repositoryAddress ?? repositoryAddress;
    const commitHref = (commitId: string) =>
      repository
        ? projectRouteToHash({
            kind: "repository",
            coordinate: repository,
            surface: "commits",
            commitSha: commitId,
          })
        : undefined;
    for (const commitId of checkpoint.commitIds) {
      const href = commitHref(commitId);
      add({
        key: `commit:${repository}:${commitId}`,
        kind: "commit",
        label: short(commitId),
        title: `Open commit ${commitId}`,
        ...(href ? { href } : { disabled: true }),
      });
    }
    for (const target of checkpoint.targets ?? []) {
      const changeId = encodeJjChangeId(target.changeId);
      if (!changeId) continue;
      const href = repository
        ? projectRouteToHash({
            kind: "repository",
            coordinate: repository,
            surface: "log",
            commitSha: target.commitId,
          })
        : undefined;
      const key = `change:${repository}:${changeId}`;
      // Keep the newest checkpoint's version of a rewritten change.
      if (!references.has(key))
        add({
          key,
          kind: "change",
          label: short(changeId),
          title: `Open change ${changeId} in Log at checkpoint commit ${target.commitId}`,
          ...(href ? { href } : { disabled: true }),
        });
    }
    if (repository) {
      const commitId =
        logCommits.get(repository) ??
        checkpoint.commitIds[0] ??
        checkpoint.targets?.[0]?.commitId;
      if (commitId) {
        logCommits.set(repository, commitId);
        add({
          key: `log:${repository}`,
          kind: "log",
          label: "Log",
          title: `Open checkpoint ${commitId} in repository log ${repository}`,
          href: projectRouteToHash({
            kind: "repository",
            coordinate: repository,
            surface: "log",
            commitSha: commitId,
          }),
        });
      }
      add({
        key: `repository:${repository}`,
        kind: "repository",
        label: repository.split(":").slice(2).join(":") || short(repository),
        title: `Open repository ${repository}`,
        href: projectRouteToHash({
          kind: "repository",
          coordinate: repository,
          surface: "overview",
        }),
      });
    }
    const channelId = checkpoint.channelId;
    if (!channelId) continue;
    const channel = navigation?.room(channelId);
    add({
      key: `channel:${channelId}`,
      kind: "channel",
      label: channel?.name ?? short(channelId),
      title: `Open channel ${channelId}`,
      disabled: !channel,
      select: () => navigation?.openChannel(channelId),
    });
    for (const record of checkpoint.records) {
      const requestId =
        agentContextMessageRole(record) === "user"
          ? record.sourceEventId
          : undefined;
      if (!requestId || !/^[a-f0-9]{64}$/u.test(requestId)) continue;
      const root = navigation?.threadRoot(requestId);
      const id = root ?? requestId;
      const label = root ? "Thread" : "Request";
      add({
        key: `thread:${channelId}:${id}`,
        kind: "thread",
        label: "Request",
        title: `Open ${label.toLowerCase()} ${id}`,
        disabled: !channel,
        select: () => navigation?.openThread(channelId, requestId, root),
      });
    }
  }
  const order = ["commit", "change", "channel", "thread", "repository", "log"];
  return [...references.values()].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );
}
