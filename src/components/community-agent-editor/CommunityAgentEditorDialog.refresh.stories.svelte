<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";
  import CommunityAgentEditorDialog from "./CommunityAgentEditorDialog.svelte";
  import {
    storyAgent,
    storyAgentRuntime,
    storyPendingCatalogRuntime,
    storyPersonas,
  } from "../community-agents/story-fixtures.js";
  import { storyEmptyCatalogRuntime } from "../community-agents/empty-runtime-story-fixtures.js";
  import type {
    CommunityAgentRuntimeState,
    CommunityAgentSaveInput,
  } from "../../community/agent-contracts.js";
  import {
    playRefreshEmptyCatalog,
    playRefreshSelectedHarnessCatalog,
  } from "./editor-harness-catalog-story.js";

  const { Story } = defineMeta({
    title: "Community/Agents/Editor",
    component: CommunityAgentEditorDialog,
    tags: ["visual-pending"],
  });
</script>

<script lang="ts">
  let open = $state(true);
  async function saveAgent(_input: CommunityAgentSaveInput): Promise<void> {}
  async function saveRuntime(): Promise<CommunityAgentRuntimeState> {
    return storyAgentRuntime;
  }
</script>

<Story
  name="Refresh empty catalog"
  args={{
    onLoadRuntime: fn(() => new Promise<CommunityAgentRuntimeState>(() => {})),
  }}
  play={playRefreshEmptyCatalog}
  >{#snippet template(args)}<CommunityAgentEditorDialog
      bind:open
      agent={storyAgent}
      personas={storyPersonas}
      runtime={storyEmptyCatalogRuntime}
      onSaveAgent={saveAgent}
      onSaveRuntime={saveRuntime}
      onLoadRuntime={args.onLoadRuntime}
    />{/snippet}</Story
>

<Story
  name="Refresh selected harness catalog"
  args={{
    onLoadRuntime: fn(async () => storyAgentRuntime),
  }}
  play={playRefreshSelectedHarnessCatalog}
  >{#snippet template(args)}<CommunityAgentEditorDialog
      bind:open
      agent={storyAgent}
      personas={storyPersonas}
      runtime={storyPendingCatalogRuntime}
      onSaveAgent={saveAgent}
      onSaveRuntime={saveRuntime}
      onLoadRuntime={args.onLoadRuntime}
    />{/snippet}</Story
>
