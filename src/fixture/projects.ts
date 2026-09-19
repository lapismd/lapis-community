import type { NostrEventTemplate } from "../protocol/index.js";
import {
  createProjectTemplate,
  createRepositoryTemplate,
  createTaskTemplate,
} from "../projects/index.js";
import { createLocalProjectAgentContextFixture } from "./project-agent-context.js";

export interface LocalProjectForgeFixtureOptions {
  ownerPubkey: string;
  contributorPubkey: string;
  channelId: string;
  relatedChannelId?: string;
  relayUrl: string;
  createdAt: number;
}

export interface LocalProjectForgePublication {
  signer: "owner" | "contributor" | "agent";
  template: NostrEventTemplate;
}

export interface LocalProjectForgeFixture {
  projectCoordinate: string;
  repositoryCoordinate: string;
  taskAnchorCoordinate: string;
  publications: readonly LocalProjectForgePublication[];
  agentContext: {
    pagePublicationIndex: number;
    checkpointManifest(pageEventId: string): LocalProjectForgePublication;
  };
}

export function createLocalProjectForgeFixture(
  options: LocalProjectForgeFixtureOptions,
): LocalProjectForgeFixture {
  const projectIdentifier = "lapis-community";
  const repositoryIdentifier = "lapis-community";
  const taskAnchorIdentifier = "lapis-community-project-tasks";
  const projectCoordinate = `30621:${options.ownerPubkey}:${projectIdentifier}`;
  const repositoryCoordinate = `30617:${options.ownerPubkey}:${repositoryIdentifier}`;
  const taskAnchorCoordinate = `30617:${options.ownerPubkey}:${taskAnchorIdentifier}`;
  const project = createProjectTemplate(
    {
      identifier: projectIdentifier,
      name: "Lapis Community",
      description:
        "Community, Registry, and Nostr-native project collaboration.",
      channelId: options.channelId,
    },
    options.createdAt,
  );
  project.tags.push(
    ["a", repositoryCoordinate, options.relayUrl],
    ["a", taskAnchorCoordinate, options.relayUrl],
  );
  if (options.relatedChannelId) {
    project.tags.push(["buzz-related-channel", options.relatedChannelId]);
  }
  const repository = createRepositoryTemplate(
    {
      identifier: repositoryIdentifier,
      name: "lapis-community",
      description: "Hosted Community package repository.",
      channelId: options.channelId,
    },
    options.createdAt + 1,
  );
  const taskAnchor = createRepositoryTemplate(
    {
      identifier: taskAnchorIdentifier,
      name: "Lapis Community Project Tasks",
      description: "Project-level task container.",
      channelId: options.channelId,
    },
    options.createdAt + 2,
  );
  taskAnchor.tags.push(["project-task-anchor", "true"]);
  const publications: LocalProjectForgePublication[] = [
    { signer: "owner", template: repository },
    { signer: "owner", template: taskAnchor },
    { signer: "owner", template: project },
    {
      signer: "contributor",
      template: createTaskTemplate(
        {
          repository: repositoryCoordinate,
          repositoryOwner: options.ownerPubkey,
          title: "Connect Projects to the live Community app",
          content:
            "Keep the browser project surface on the active Community relay.",
          labels: ["community", "projects"],
          assignees: [options.contributorPubkey],
        },
        options.createdAt + 3,
      ),
    },
    {
      signer: "owner",
      template: createTaskTemplate(
        {
          repository: taskAnchorCoordinate,
          repositoryOwner: options.ownerPubkey,
          title: "Prepare the next Community project milestone",
          content:
            "Coordinate project-level work that does not belong to one code repository.",
          labels: ["planning"],
        },
        options.createdAt + 4,
      ),
    },
  ];
  const agentContext = createLocalProjectAgentContextFixture({
    repositoryCoordinate,
    channelId: options.channelId,
    createdAt: options.createdAt + publications.length,
  });
  const pagePublicationIndex =
    publications.length + agentContext.contextPageIndex;
  publications.push(
    ...agentContext.publications.map((template) => ({
      signer: "agent" as const,
      template,
    })),
  );

  return {
    projectCoordinate,
    repositoryCoordinate,
    taskAnchorCoordinate,
    publications,
    agentContext: {
      pagePublicationIndex,
      checkpointManifest: (pageEventId) => ({
        signer: "agent",
        template: agentContext.checkpointManifest(pageEventId),
      }),
    },
  };
}
