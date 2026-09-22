import { parseAddressableCoordinate } from "../../community/community-links.js";
import type { CommunityRoomModel } from "../community-workspace/model.js";

export interface ComposerSlashCoordinateEntry {
  owner: string;
  d: string;
  name: string;
}

export interface ComposerSlashTaskEntry {
  owner: string;
  d: string;
  id: string;
  title: string;
}

export interface ComposerSlashCommitEntry {
  owner: string;
  d: string;
  sha: string;
  subject: string;
}

export interface ComposerSlashLogEntry {
  owner: string;
  d: string;
  tab: "log" | "oplog";
  label: string;
}

export interface ComposerSlashSession {
  rooms: readonly CommunityRoomModel[];
  projects: readonly ComposerSlashCoordinateEntry[];
  repositories: readonly ComposerSlashCoordinateEntry[];
  tasks: readonly ComposerSlashTaskEntry[];
  commits: readonly ComposerSlashCommitEntry[];
  logs: readonly ComposerSlashLogEntry[];
}

export interface ComposerSlashSessionSource {
  rooms: readonly CommunityRoomModel[];
  catalog: {
    projects: readonly {
      address: { owner: string; identifier: string };
      name: string;
    }[];
    repositories: readonly {
      address: { owner: string; identifier: string };
      name: string;
    }[];
  };
  workItems: {
    tasks: readonly {
      root: { id: string };
      repository: { coordinate: string };
      title: string;
    }[];
  };
  commits: readonly { sha: string; subject: string }[];
  activity: readonly {
    repositoryCoordinate: string;
    commit: { sha: string; subject: string };
  }[];
  repositoryCoordinate?: string;
}

let session: ComposerSlashSession = emptyComposerSlashSession();

export function emptyComposerSlashSession(): ComposerSlashSession {
  return {
    rooms: [],
    projects: [],
    repositories: [],
    tasks: [],
    commits: [],
    logs: [],
  };
}

export function publishComposerSlashSession(next: ComposerSlashSession): void {
  session = next;
}

export function readComposerSlashSession(): ComposerSlashSession {
  return session;
}

export function snapshotComposerSlashSession(
  input: ComposerSlashSessionSource,
): ComposerSlashSession {
  const repositories = input.catalog.repositories.map((repository) => ({
    owner: repository.address.owner,
    d: repository.address.identifier,
    name: repository.name,
  }));
  const selected = input.repositoryCoordinate
    ? parseAddressableCoordinate(input.repositoryCoordinate)
    : undefined;
  const commits = new Map<string, ComposerSlashCommitEntry>();
  const addCommit = (entry: ComposerSlashCommitEntry) => {
    commits.set(`${entry.owner}:${entry.d}:${entry.sha}`, entry);
  };
  if (selected) {
    for (const commit of input.commits) {
      addCommit({
        owner: selected.owner,
        d: selected.d,
        sha: commit.sha,
        subject: commit.subject,
      });
    }
  }
  for (const item of input.activity) {
    const parsed = parseAddressableCoordinate(item.repositoryCoordinate);
    if (!parsed) continue;
    addCommit({
      owner: parsed.owner,
      d: parsed.d,
      sha: item.commit.sha,
      subject: item.commit.subject,
    });
  }
  return {
    rooms: input.rooms,
    projects: input.catalog.projects.map((project) => ({
      owner: project.address.owner,
      d: project.address.identifier,
      name: project.name,
    })),
    repositories,
    tasks: input.workItems.tasks.flatMap((task) => {
      const parsed = parseAddressableCoordinate(task.repository.coordinate);
      return parsed
        ? [
            {
              owner: parsed.owner,
              d: parsed.d,
              id: task.root.id,
              title: task.title,
            },
          ]
        : [];
    }),
    commits: [...commits.values()],
    logs: repositories.flatMap((repository) => [
      {
        owner: repository.owner,
        d: repository.d,
        tab: "log" as const,
        label: `${repository.name} Log`,
      },
      {
        owner: repository.owner,
        d: repository.d,
        tab: "oplog" as const,
        label: `${repository.name} Op Log`,
      },
    ]),
  };
}
