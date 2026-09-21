<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";
  import CommunityAgentEditorDialog from "./CommunityAgentEditorDialog.svelte";
  import {
    playEmptyModelCatalog,
    playHarnessModelCatalog,
  } from "./editor-harness-catalog-story.js";
  import { storyLongCursorRuntime } from "../community-agents/long-cursor-runtime-story-fixtures.js";
  import {
    storyAgent,
    storyAgentRuntime,
    storyPendingCatalogRuntime,
    storyPersonas,
  } from "../community-agents/story-fixtures.js";
  import type {
    CommunityAgentRuntimeState,
    CommunityAgentSaveInput,
  } from "../../community/agent-contracts.js";

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
  name="Harness model catalog"
  args={{ onSaveRuntime: fn(saveRuntime) }}
  play={playHarnessModelCatalog}
  >{#snippet template(args)}<CommunityAgentEditorDialog
      bind:open
      agent={storyAgent}
      personas={storyPersonas}
      runtime={storyLongCursorRuntime}
      onSaveAgent={saveAgent}
      onSaveRuntime={args.onSaveRuntime}
    />{/snippet}</Story
>

<Story name="Empty model catalog" play={playEmptyModelCatalog}
  >{#snippet template()}<CommunityAgentEditorDialog
      bind:open
      agent={storyAgent}
      personas={storyPersonas}
      runtime={storyPendingCatalogRuntime}
      onSaveAgent={saveAgent}
      onSaveRuntime={saveRuntime}
    />{/snippet}</Story
>
