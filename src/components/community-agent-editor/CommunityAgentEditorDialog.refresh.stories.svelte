<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";
  import CommunityAgentEditorDialog from "./CommunityAgentEditorDialog.svelte";
  import {
    storyAgent,
    storyAgentRuntime,
    storyPersonas,
  } from "../community-agents/story-fixtures.js";
  import { storyEmptyCatalogRuntime } from "../community-agents/empty-runtime-story-fixtures.js";
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
  name="Refresh empty catalog"
  args={{
    onLoadRuntime: fn(() => new Promise<CommunityAgentRuntimeState>(() => {})),
  }}
  play={async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    await expect(within(dialog).getByLabelText("Agent name")).toBeEnabled();
    await waitFor(() => expect(args.onLoadRuntime).toHaveBeenCalledTimes(1));
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Customize for this agent" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Model" }),
    );
    await expect(
      body.getByRole("option", { name: "Loading models…" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
  }}
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
