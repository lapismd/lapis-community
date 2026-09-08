import type { NostrEventTemplate } from "../protocol/index.js";
import {
  createProjectTemplate,
  createRepositoryTemplate,
  createTaskTemplate,
} from "../projects/index.js";

export interface LocalProjectForgeFixtureOptions {
  ownerPubkey: string;
  contributorPubkey: string;
  channelId: string;
  relayUrl: string;
  createdAt: number;
}

export interface LocalProjectForgePublication {
  signer: "owner" | "contributor";
  template: NostrEventTemplate;
}

export interface LocalProjectForgeFixture {
  projectCoordinate: string;
  repositoryCoordinate: string;
  taskAnchorCoordinate: string;
  publications: readonly LocalProjectForgePublication[];
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

  return {
    projectCoordinate,
    repositoryCoordinate,
    taskAnchorCoordinate,
    publications: [
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
    ],
  };
}
