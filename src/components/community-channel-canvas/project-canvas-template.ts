import {
  projectForgeBoundChannels,
  type ProjectForgeCatalog,
  type ProjectForgeProject,
  type ProjectForgeRepository,
} from "../../projects/index.js";
import type { CommunityRoomModel } from "../community-workspace/model.js";

function inlineCode(value: string): string {
  return `\`${value.replaceAll("`", "'").replace(/[\r\n]+/gu, " ")}\``;
}

function markdownText(value: string): string {
  return value
    .replace(/[\r\n]+/gu, " ")
    .replace(/([\\`*_[\]{}<>#+.!|-])/gu, "\\$1");
}

function projectRepositories(
  project: ProjectForgeProject,
  catalog: ProjectForgeCatalog,
): readonly ProjectForgeRepository[] {
  return project.repositories
    .map((reference) =>
      catalog.repositories.find(
        (repository) => repository.address.coordinate === reference.coordinate,
      ),
    )
    .filter((repository) => repository !== undefined);
}

export function projectCanvasStarterForChannel(
  catalog: ProjectForgeCatalog,
  room: CommunityRoomModel,
): string | undefined {
  const channelId = room.groupId ?? room.id;
  const project = catalog.projects.find((candidate) =>
    projectForgeBoundChannels(candidate, catalog.repositories).some(
      (binding) => binding.channelId === channelId,
    ),
  );
  if (!project) return undefined;

  const repositories = projectRepositories(project, catalog);
  const initialRepository = repositories[0];
  const projectName = markdownText(project.name);
  const cloneUrl =
    initialRepository?.cloneUrls[0] ?? initialRepository?.webUrls[0];
  const facts = [
    `- Project address: ${inlineCode(project.address.coordinate)}`,
    `- Project owner: ${inlineCode(project.event.pubkey)}`,
    `- Project channel: ${inlineCode(channelId)}`,
    ...(initialRepository
      ? [`- Initial repository: ${inlineCode(initialRepository.name)}`]
      : []),
    ...(cloneUrl ? [`- Clone URL: ${inlineCode(cloneUrl)}`] : []),
  ].join("\n");

  return `# Project channel: ${projectName}

This channel is the working home of **${projectName}**.

${facts}

Everything about this project—decisions, tasks, code review, agent work, and releases—happens here, in the open.

## How to think about this channel

- **The channel is the project's memory.** Post milestones such as picked up, blocked, review ready, merged, and done as top-level messages; keep details in threads.
- **Tasks are the work queue.** Start from a task and claim it before building so work is not duplicated.
- **The repository is the source of truth for code; the channel is the source of truth for intent.** Read both before acting.
- **One owner per task.** If someone else owns it, review or unblock their work.

## Working with agents

- Mention a configured agent in this channel or a task thread and give it a bounded request, acceptance criteria, and the relevant repository.
- The Nostr agent controller binds the request to this channel and repository while keeping signer custody and owner-only telemetry outside the agent runtime.
- The owner can follow live reasoning and tool progress in Agent Activity. Completed messages and code checkpoints are published beside repository activity.
- Review the agent's diff, checks, and final report before merging or releasing. Controller-mediated writes still require owner approval.

## What you can do here

| Action | In Lapis Community |
| --- | --- |
| Inspect project activity | Open **Activity** from the project workspace |
| Browse repository history | Open **Log**, **Op Log**, or **Commits** from the repository |
| Create and track work | Use **Tasks** and keep status changes in the task thread |
| Review changes | Use **Reviews** and link decisions back to the task |
| Ask an agent to work | Mention the configured agent with the repository and acceptance criteria |
| Follow a live run | Open the agent profile and choose **Activity** |
| Update this document | Open **Canvas**, edit the Markdown, and save a new relay revision |

## Workflow

1. **Pick up:** Find or create a task, assign one owner, and post a short picked-up message.
2. **Build:** Work in the linked repository and keep implementation decisions in the task thread.
3. **Verify:** Run the fullest relevant checks and report failures with enough detail to reproduce them.
4. **Checkpoint:** Let the controller publish meaningful Jujutsu checkpoints and completed agent context beside the code.
5. **Report:** Deliver the result or blocker in the original thread and mention whoever must act next.

Keep this canvas current as the project evolves.`;
}
