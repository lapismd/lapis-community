<script lang="ts">
  import * as Chat from "@lapismd/design-core/ai/chat";
  import { projectRouteToHash } from "../community-application/project-route.js";
  let {
    commitIds,
    repositoryAddress,
  }: { commitIds: readonly string[]; repositoryAddress?: string | undefined } =
    $props();
</script>

<Chat.SystemMessage variant="divider" aria-label="Code checkpoint">
  <span>Checkpoint</span>
  {#each commitIds as commitId (commitId)}
    {#if repositoryAddress}<a
        href={projectRouteToHash({
          kind: "repository",
          coordinate: repositoryAddress,
          surface: "commits",
          commitSha: commitId,
        })}>{commitId.slice(0, 12)}</a
      >{:else}<code>{commitId.slice(0, 12)}</code>{/if}
  {/each}
</Chat.SystemMessage>
