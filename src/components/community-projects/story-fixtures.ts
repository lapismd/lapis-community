import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import {
  addRepositoryToProjectTemplate,
  createProjectTemplate,
  createPullRequestTemplate,
  createRepositoryTemplate,
  createReviewDecisionTemplate,
  createTaskTemplate,
} from "../../projects/index.js";
import type {
  ProjectForgeCatalog,
  ProjectForgeDataSource,
  ProjectForgePullRequestDiff,
  ProjectForgeSession,
  ProjectForgeWorkItems,
  PullRequestState,
} from "../../projects/index.js";
import type { RegistrySigner } from "../../auth/index.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";

export const projectStoryOwner =
  "d793631af7aa0e709439dd47fc001acd0b0727670b6670ea528ac83cb0127f4a";
export const projectStoryAuthor =
  "a8397a935f0dfceba6ba9618f6451ef4d80637abf4e6af2669fbc9de6a8fd2ac";
export const projectStoryProjectCoordinate = `30621:${projectStoryOwner}:community-client`;
export const projectStoryRepositoryCoordinate = `30617:${projectStoryOwner}:community-client`;

export async function seedProjectStoryRelay(options: {
  source: ProjectForgeDataSource;
  relayUrl: string;
  channelId: string;
  owner: RegistrySigner;
  author: RegistrySigner;
}): Promise<void> {
  const relatedChannelId = options.channelId.startsWith("general-")
    ? `support-${options.channelId.slice("general-".length)}`
    : "support";
  const httpBaseUrl = relayHttpBaseUrl(options.relayUrl);
  const ownerSession = await options.source.open({
    relayUrl: options.relayUrl,
    httpBaseUrl,
    identity: options.owner,
  });
  const authorSession = await options.source.open({
    relayUrl: options.relayUrl,
    httpBaseUrl,
    identity: options.author,
  });

  try {
    let catalog = await ownerSession.loadCatalog(options.channelId);
    let repository = catalog.repositories.find(
      (candidate) =>
        candidate.address.coordinate === projectStoryRepositoryCoordinate,
    );
    let project = catalog.projects.find(
      (candidate) =>
        candidate.address.coordinate === projectStoryProjectCoordinate,
    );

    if (!repository) {
      const event = await ownerSession.publish(
        createRepositoryTemplate(
          {
            identifier: "community-client",
            name: "community-client",
            description: "Hosted browser and desktop client.",
            channelId: options.channelId,
          },
          1_700_000_011,
        ),
      );
      catalog = await ownerSession.loadCatalog(options.channelId);
      repository = catalog.repositories.find(
        (candidate) => candidate.event.id === event.id,
      );
    }

    if (!project) {
      const template = createProjectTemplate(
        {
          identifier: "community-client",
          name: "Community Client",
          description: "The shared Lapis community experience.",
          channelId: options.channelId,
        },
        1_700_000_010,
      );
      template.tags.push(["buzz-related-channel", relatedChannelId]);
      const event = await ownerSession.publishHttp(template);
      catalog = await ownerSession.loadCatalog(options.channelId);
      project = catalog.projects.find(
        (candidate) => candidate.event.id === event.id,
      );
    }

    if (!repository || !project) {
      throw new Error(
        "The Docker project fixture could not create its catalog",
      );
    }

    if (
      !project.repositories.some(
        (reference) =>
          reference.coordinate === projectStoryRepositoryCoordinate,
      )
    ) {
      await ownerSession.publish(
        addRepositoryToProjectTemplate(
          project.event,
          projectStoryRepositoryCoordinate,
          options.relayUrl,
          1_700_000_012,
        ),
      );
    }

    await waitForHostedRepository(ownerSession);

    let workItems = await ownerSession.loadWorkItems(repository.event);
    if (
      !workItems.tasks.some(
        (task) => task.title === "Polish the project overview rail",
      )
    ) {
      await authorSession.publish(
        createTaskTemplate(
          {
            repository: projectStoryRepositoryCoordinate,
            repositoryOwner: projectStoryOwner,
            title: "Polish the project overview rail",
            content: "Keep the shell shape aligned with plugin releases.",
            labels: ["design"],
            assignees: [projectStoryAuthor],
          },
          1_700_000_020,
        ),
      );
    }

    workItems = await ownerSession.loadWorkItems(repository.event);
    let pullRequest = workItems.pullRequests.find(
      (candidate) => candidate.title === "Add project file and diff views",
    );
    if (!pullRequest) {
      const event = await authorSession.publishHttp(
        createPullRequestTemplate(
          {
            repository: projectStoryRepositoryCoordinate,
            repositoryOwner: projectStoryOwner,
            title: "Add project file and diff views",
            content:
              "Adds hosted file browsing and a browser-safe review surface.",
            commit: "d".repeat(40),
            cloneUrls: [
              new URL(
                `/git/${projectStoryOwner}/community-client.git`,
                httpBaseUrl,
              ).toString(),
            ],
            branchName: "projects-ui",
            targetBranch: "main",
            mergeBase: "c".repeat(40),
          },
          1_700_000_030,
        ),
      );
      pullRequest = (
        await ownerSession.loadWorkItems(repository.event)
      ).pullRequests.find((candidate) => candidate.root.id === event.id);
    }

    if (!pullRequest) {
      throw new Error("The Docker project fixture could not create its review");
    }
    if (pullRequest.approvals.length === 0) {
      await ownerSession.publish(
        createReviewDecisionTemplate(
          pullRequest.root,
          projectStoryRepositoryCoordinate,
          "approved",
          pullRequest.currentCommit,
          "The responsive file layout looks good.",
          1_700_000_040,
        ),
      );
    }
  } finally {
    authorSession.close();
    ownerSession.close();
  }
}

function relayHttpBaseUrl(relayUrl: string): URL {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function waitForHostedRepository(
  session: ProjectForgeSession,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await session.loadRefs(projectStoryRepositoryCoordinate);
      return;
    } catch (cause) {
      lastError = cause;
      await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    }
  }
  throw new Error("The Docker project fixture could not reach hosted Git", {
    cause: lastError,
  });
}

function storyEvent(
  id: string,
  kind: number,
  pubkey: string,
  tags: string[][],
  content = "",
  createdAt = 1_700_000_000,
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    pubkey,
    kind,
    tags,
    content,
    created_at: createdAt,
    sig: id.repeat(128).slice(0, 128),
  };
}

export function createProjectStoryFixture(channelId = "general-projects") {
  const relatedChannelId = channelId.startsWith("general-")
    ? `support-${channelId.slice("general-".length)}`
    : "support";
  const projectEvent = storyEvent(
    "1",
    30_621,
    projectStoryOwner,
    [
      ["d", "community-client"],
      ["name", "Community Client"],
      ["description", "The shared Lapis community experience."],
      ["buzz-channel", channelId],
      ["buzz-related-channel", relatedChannelId],
      ["r", projectStoryRepositoryCoordinate, "wss://relay.example.com"],
    ],
    "",
    1_700_000_010,
  );
  const repositoryEvent = storyEvent(
    "2",
    30_617,
    projectStoryOwner,
    [
      ["d", "community-client"],
      ["name", "community-client"],
      ["description", "Hosted browser and desktop client."],
      ["buzz-channel", channelId],
    ],
    "",
    1_700_000_011,
  );
  const repository = {
    event: repositoryEvent,
    address: {
      kind: 30_617,
      owner: projectStoryOwner,
      identifier: "community-client",
      coordinate: projectStoryRepositoryCoordinate,
    },
    name: "community-client",
    description: "Hosted browser and desktop client.",
    channelId,
    cloneUrls: [],
    webUrls: [],
    repositoryClass: "hosted" as const,
  };
  const project = {
    event: projectEvent,
    address: {
      kind: 30_621,
      owner: projectStoryOwner,
      identifier: "community-client",
      coordinate: projectStoryProjectCoordinate,
    },
    name: "Community Client",
    description: "The shared Lapis community experience.",
    channelId,
    relatedChannelIds: [relatedChannelId],
    listing: "listed" as const,
    repositories: [
      {
        coordinate: projectStoryRepositoryCoordinate,
        relayHint: "wss://relay.example.com",
      },
    ],
  };
  const taskRoot = storyEvent(
    "3",
    1_621,
    projectStoryAuthor,
    [
      ["a", projectStoryRepositoryCoordinate],
      ["p", projectStoryOwner],
      ["subject", "Polish the project overview rail"],
      ["t", "design"],
    ],
    "Keep the shell shape aligned with plugin releases.",
    1_700_000_020,
  );
  const taskComment = storyEvent(
    "7",
    1,
    projectStoryOwner,
    [
      ["e", taskRoot.id, "", "root"],
      ["a", projectStoryRepositoryCoordinate],
    ],
    "The sidebar should stay contextual and quiet as the task changes.",
    1_700_000_022,
  );
  const pullRequestRoot = storyEvent(
    "4",
    1_618,
    projectStoryAuthor,
    [
      ["a", projectStoryRepositoryCoordinate],
      ["p", projectStoryOwner],
      ["subject", "Add project file and diff views"],
      ["c", "d".repeat(40)],
      ["clone", "https://relay.example.com/git/community-client.git"],
      ["branch-name", "projects-ui"],
      ["target-branch", "main"],
    ],
    "Adds hosted file browsing and a browser-safe review surface.",
    1_700_000_030,
  );
  const reviewCommentEvent = storyEvent(
    "5",
    1,
    projectStoryOwner,
    [
      ["e", pullRequestRoot.id, "", "root"],
      ["a", projectStoryRepositoryCoordinate],
      ["c", "d".repeat(40)],
      ["t", "approval"],
    ],
    "The responsive file layout looks good. <!-- lapis:story-review-comment -->",
    1_700_000_040,
  );
  const inlineCommentEvent = storyEvent(
    "6",
    1,
    projectStoryAuthor,
    [
      ["e", pullRequestRoot.id, "", "root"],
      ["a", projectStoryRepositoryCoordinate],
      ["c", "d".repeat(40)],
      ["file", "project.conf"],
      ["line", "2", "old"],
    ],
    "Can we retain a note explaining why projects were disabled?",
    1_700_000_041,
  );
  const pullRequest: PullRequestState = {
    root: pullRequestRoot,
    repository: repository.address,
    title: "Add project file and diff views",
    content: pullRequestRoot.content,
    labels: [],
    recipients: [projectStoryOwner],
    initialCommit: "d".repeat(40),
    currentCommit: "d".repeat(40),
    cloneUrls: ["https://relay.example.com/git/community-client.git"],
    branchName: "projects-ui",
    targetBranch: "main",
    mergeBase: "c".repeat(40),
    lifecycle: "open",
    mergeCommit: "",
    mergeReferences: [],
    reviewers: [projectStoryOwner],
    approvals: [
      {
        event: reviewCommentEvent,
        reviewer: projectStoryOwner,
        commit: "d".repeat(40),
        decision: "approved",
      },
    ],
    changeRequests: [],
    updates: [],
    lifecycleEvents: [],
    comments: [
      {
        event: reviewCommentEvent,
        encoding: "buzz-kind-1",
        commit: "d".repeat(40),
        isInlineComment: false,
        isReviewRequest: false,
        isTrustedReviewRequest: false,
        reviewerPubkeys: [],
        decision: "approved",
        isTrustedDecision: true,
        decisionStatus: "current",
        reactions: [],
      },
      {
        event: inlineCommentEvent,
        encoding: "buzz-kind-1",
        commit: "d".repeat(40),
        anchor: { path: "project.conf", side: "old", line: 2 },
        isInlineComment: true,
        inlineStatus: "current",
        isReviewRequest: false,
        isTrustedReviewRequest: false,
        reviewerPubkeys: [],
        isTrustedDecision: false,
        reactions: [{ emoji: "❤️", count: 2, selected: true }],
      },
    ],
    createdAt: pullRequestRoot.created_at,
    updatedAt: inlineCommentEvent.created_at,
  };
  const catalog: ProjectForgeCatalog = {
    projects: [project],
    repositories: [repository],
    events: [projectEvent, repositoryEvent],
  };
  const workItems: ProjectForgeWorkItems = {
    tasks: [
      {
        root: taskRoot,
        repository: repository.address,
        title: "Polish the project overview rail",
        content: taskRoot.content,
        labels: ["design"],
        lifecycle: "open",
        assignees: [projectStoryAuthor],
        activity: [
          {
            event: taskComment,
            encoding: "buzz-kind-1",
            assignees: [],
          },
        ],
        createdAt: taskRoot.created_at,
        updatedAt: taskRoot.created_at,
      },
    ],
    pullRequests: [pullRequest],
    events: [
      taskRoot,
      taskComment,
      pullRequestRoot,
      reviewCommentEvent,
      inlineCommentEvent,
    ],
  };
  const diff: ProjectForgePullRequestDiff = {
    pull_request: pullRequestRoot.id,
    repository: projectStoryRepositoryCoordinate,
    lifecycle: "open",
    base_source: "target-branch",
    target_branch: "main",
    base: "c".repeat(40),
    head: "d".repeat(40),
    merge_base: "c".repeat(40),
    files: [
      {
        path: "project.conf",
        status: "modified",
        additions: 2,
        deletions: 1,
        patch:
          "@@ -1,2 +1,3 @@\n app=community\n-projects=off\n+projects=on\n+hosted_files=on",
      },
      {
        path: "README.md",
        status: "modified",
        additions: 1,
        deletions: 0,
        patch:
          "@@ -8,2 +8,3 @@\n ## Features\n+Project collaboration\n Community chat",
      },
    ],
    patch: "",
  };
  const members: readonly CommunityMemberModel[] = [
    {
      id: projectStoryOwner,
      name: "Maya Chen",
      handle: "@maya",
      initials: "MC",
      avatarUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='20' fill='%235b21b6'/%3E%3C/svg%3E",
      role: "Project owner",
      presence: "online",
    },
    {
      id: projectStoryAuthor,
      name: "Noor Patel",
      handle: "@noor",
      initials: "NP",
      avatarUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='20' fill='%230f766e'/%3E%3C/svg%3E",
      role: "Contributor",
      presence: "online",
    },
  ];
  return {
    catalog,
    workItems,
    project,
    repository,
    pullRequest,
    diff,
    members,
  };
}

export function createProjectStoryDataSource(
  channelId = "general-projects",
  repositoryBackend: "github" | "walgit" = "walgit",
  empty = false,
): ProjectForgeDataSource {
  const fixture = createProjectStoryFixture(channelId);
  const catalog: ProjectForgeCatalog = empty
    ? { projects: [], repositories: [], events: [] }
    : repositoryBackend === "github"
      ? {
          ...fixture.catalog,
          repositories: fixture.catalog.repositories.map((repository) => ({
            ...repository,
            cloneUrls: ["https://github.com/lapismd/community-client.git"],
            webUrls: ["https://github.com/lapismd/community-client"],
            repositoryClass: "external" as const,
          })),
        }
      : fixture.catalog;
  return {
    async open(context): Promise<ProjectForgeSession> {
      const publish = async (template: NostrEventTemplate) => {
        if (!context.identity)
          throw new Error("The story project source is read-only");
        return context.identity.signEvent(template);
      };
      return {
        relayUrl: context.relayUrl,
        async loadCatalog() {
          return catalog;
        },
        async loadWorkItems() {
          return fixture.workItems;
        },
        publish,
        async publishMany(templates) {
          return Promise.all(templates.map(publish));
        },
        publishHttp: publish,
        async queryHttp() {
          return [];
        },
        async subscribe(filters, listener) {
          queueMicrotask(() => {
            for (const _filter of filters) listener({ type: "eose" });
          });
          return () => undefined;
        },
        async loadCapabilities(repository) {
          return {
            repository,
            capabilities: {
              git_authority_backend: repositoryBackend,
              content_backend: repositoryBackend,
              git_backend: repositoryBackend,
              collaboration_backend: "relay",
              clone: { available: true, auth: "nostr" },
              smart_http: { read: true, write: true },
              browse: true,
              compare: true,
              ref_events: true,
              provision: true,
              import: false,
              issues: false,
              pull_requests: false,
              reviews: false,
              merge: false,
              mirror: false,
              ci: false,
              capability_limits: {},
            },
          };
        },
        async loadGitHubConnections() {
          return { connections: [] };
        },
        async createGitHubConnection(input) {
          return {
            id: "ghc-story",
            provider: "github",
            host: "github.com",
            installation_id: input.installationId,
            account_id: "7",
            account_login: "lapismd",
            bridge_pubkey: input.bridgePubkey,
            status: "active",
          };
        },
        async updateGitHubConnection(connectionId, input) {
          return {
            id: connectionId,
            provider: "github",
            host: "github.com",
            installation_id: input.installationId,
            account_id: "7",
            account_login: "lapismd",
            bridge_pubkey: input.bridgePubkey,
            status: "active",
          };
        },
        async revalidateGitHubConnection(connectionId) {
          return {
            id: connectionId,
            provider: "github",
            host: "github.com",
            installation_id: 99,
            account_id: "7",
            account_login: "lapismd",
            bridge_pubkey: "2".repeat(64),
            status: "active",
          };
        },
        async loadGitHubRepositories() {
          return { repositories: [] };
        },
        async attachGitHubRepository() {
          throw new Error("GitHub attachment is not configured in this story");
        },
        async loadRefs() {
          return {
            head: { name: "main", sha: "d".repeat(40) },
            refs: [{ name: "main", sha: "d".repeat(40) }],
          };
        },
        async loadTree(_repository, revision, path = "") {
          return {
            ref: revision,
            sha: "d".repeat(40),
            path,
            entries:
              path === "src"
                ? [
                    { name: "app.ts", type: "blob", size: 1_842 },
                    { name: "index.ts", type: "blob", size: 318 },
                  ]
                : [
                    { name: "README.md", type: "blob", size: 912 },
                    { name: "src", type: "tree" },
                  ],
          };
        },
        async loadBlob(_repository, _revision, path) {
          return {
            name: path.split("/").at(-1) ?? path,
            path,
            contents:
              "# Community Client\n\nNostr-native project collaboration.\n",
            size: 56,
          };
        },
        async loadCommits() {
          return {
            ref: "main",
            sha: "d".repeat(40),
            more: false,
            commits: [
              {
                sha: "d".repeat(40),
                subject: "Add project file and diff views",
                body: "Use the public Design Core diff primitives.",
                author_name: "Noor Patel",
                author_date: "2026-09-08T09:30:00Z",
              },
            ],
          };
        },
        async loadCommit(_repository, sha) {
          return {
            commit: { sha, subject: "Add project file and diff views" },
          };
        },
        async loadPullRequestDiff() {
          return fixture.diff;
        },
        async mergePullRequest(_eventId, _expectedHead) {
          return {
            operation_id: "fop-story-merge",
            state: "complete",
            command: "merge",
            repository: fixture.repository.address.coordinate,
            result: { state: "merged", merged_commit: "e".repeat(40) },
          };
        },
        close() {},
      };
    },
  };
}
