import type {
  ProjectForgeActivityItem,
  ProjectForgeBoundChannel,
  ProjectForgeCatalog,
  ProjectForgeCommitActivity,
  ProjectForgeProject,
  ProjectForgeRepository,
  ProjectForgeWorkItems,
} from "./model.js";

export function projectForgeBoundChannels(
  project: ProjectForgeProject,
  repositories: readonly ProjectForgeRepository[],
): ProjectForgeBoundChannel[] {
  const channels: ProjectForgeBoundChannel[] = [];
  const seen = new Set<string>();
  const add = (channel: ProjectForgeBoundChannel) => {
    const id = channel.channelId.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    channels.push({ ...channel, channelId: id });
  };

  add({ channelId: project.channelId, role: "home" });
  for (const channelId of project.relatedChannelIds) {
    add({ channelId, role: "related" });
  }
  for (const reference of project.repositories) {
    const repository = repositories.find(
      (candidate) => candidate.address.coordinate === reference.coordinate,
    );
    if (!repository) continue;
    add({
      channelId: repository.channelId,
      repositoryCoordinate: repository.address.coordinate,
      role: "related",
    });
  }
  return channels;
}

export function projectForgeChildChannels(
  project: ProjectForgeProject,
  repositories: readonly ProjectForgeRepository[],
): ProjectForgeBoundChannel[] {
  return projectForgeBoundChannels(project, repositories);
}

export function buildProjectForgeActivity(
  catalog: ProjectForgeCatalog,
  workItems: ProjectForgeWorkItems,
  commits: readonly ProjectForgeCommitActivity[] = [],
): ProjectForgeActivityItem[] {
  const projects = [...catalog.projects].sort((left, right) =>
    left.address.coordinate.localeCompare(right.address.coordinate),
  );
  const projectForRepository = (coordinate: string) =>
    projects.find((project) =>
      project.repositories.some(
        (reference) => reference.coordinate === coordinate,
      ),
    );
  const items: ProjectForgeActivityItem[] = [];

  for (const project of projects) {
    items.push({
      id: `project:${project.event.id}`,
      kind: "project",
      createdAt: project.event.created_at,
      actorPubkey: project.event.pubkey,
      action: "created a project",
      title: project.name,
      body: project.description,
      projectCoordinate: project.address.coordinate,
    });
  }

  for (const repository of catalog.repositories) {
    const project = projectForRepository(repository.address.coordinate);
    if (!project) continue;
    items.push({
      id: `repository:${repository.event.id}`,
      kind: "repository",
      createdAt: repository.event.created_at,
      actorPubkey: repository.event.pubkey,
      action: "created a repository in",
      title: repository.name,
      body: repository.description,
      detail: repository.repositoryClass,
      projectCoordinate: project.address.coordinate,
      repositoryCoordinate: repository.address.coordinate,
    });
  }

  for (const task of workItems.tasks) {
    const project = projectForRepository(task.repository.coordinate);
    if (!project) continue;
    items.push({
      id: `task:${task.root.id}`,
      kind: "task",
      createdAt: task.createdAt,
      actorPubkey: task.root.pubkey,
      action: "created a task in",
      title: task.title,
      body: task.content,
      detail: task.lifecycle,
      projectCoordinate: project.address.coordinate,
      repositoryCoordinate: task.repository.coordinate,
    });
    for (const activity of task.activity) {
      items.push({
        id: `task-activity:${activity.event.id}`,
        kind: activity.assignment ? "assignment" : "comment",
        createdAt: activity.event.created_at,
        actorPubkey: activity.event.pubkey,
        action: activity.assignment
          ? `${activity.assignment === "assign" ? "assigned" : "unassigned"} a task in`
          : "commented on a task in",
        title: task.title,
        body: activity.event.content,
        projectCoordinate: project.address.coordinate,
        repositoryCoordinate: task.repository.coordinate,
      });
    }
  }

  for (const pullRequest of workItems.pullRequests) {
    const project = projectForRepository(pullRequest.repository.coordinate);
    if (!project) continue;
    items.push({
      id: `review:${pullRequest.root.id}`,
      kind: "review",
      createdAt: pullRequest.createdAt,
      actorPubkey: pullRequest.root.pubkey,
      action: "opened a review in",
      title: pullRequest.title,
      body: pullRequest.content,
      detail: pullRequest.lifecycle,
      projectCoordinate: project.address.coordinate,
      repositoryCoordinate: pullRequest.repository.coordinate,
    });
    for (const update of pullRequest.updates) {
      items.push({
        id: `review-update:${update.event.id}`,
        kind: "review-update",
        createdAt: update.event.created_at,
        actorPubkey: update.event.pubkey,
        action: "updated a review in",
        title: pullRequest.title,
        body: update.event.content,
        detail: update.commit.slice(0, 10),
        projectCoordinate: project.address.coordinate,
        repositoryCoordinate: pullRequest.repository.coordinate,
      });
    }
    for (const comment of pullRequest.comments) {
      const kind = comment.isTrustedDecision
        ? comment.decision === "approved"
          ? "approval"
          : comment.decision === "changes-requested"
            ? "changes-requested"
            : "comment"
        : "comment";
      items.push({
        id: `review-comment:${comment.event.id}`,
        kind,
        createdAt: comment.event.created_at,
        actorPubkey: comment.event.pubkey,
        action:
          kind === "approval"
            ? "approved a review in"
            : kind === "changes-requested"
              ? "requested changes to a review in"
              : "commented on a review in",
        title: pullRequest.title,
        body: comment.event.content,
        projectCoordinate: project.address.coordinate,
        repositoryCoordinate: pullRequest.repository.coordinate,
      });
    }
  }

  for (const entry of commits) {
    items.push({
      id: `commit:${entry.repositoryCoordinate}:${entry.commit.sha}`,
      kind: "commit",
      createdAt: Math.floor(
        new Date(entry.commit.author_date ?? 0).getTime() / 1_000,
      ),
      actorPubkey: "",
      action: "pushed a commit to",
      title: entry.commit.subject || entry.commit.sha.slice(0, 10),
      body: entry.commit.body ?? "",
      detail: entry.commit.sha.slice(0, 10),
      projectCoordinate: entry.projectCoordinate,
      repositoryCoordinate: entry.repositoryCoordinate,
    });
  }

  return items
    .filter((item) => Number.isFinite(item.createdAt))
    .sort(
      (left, right) =>
        right.createdAt - left.createdAt || left.id.localeCompare(right.id),
    );
}
