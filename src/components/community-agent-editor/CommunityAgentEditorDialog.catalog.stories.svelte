<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within, userEvent } from "storybook/test";
  import CommunityAgentEditorDialog from "./CommunityAgentEditorDialog.svelte";
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
  play={async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Customize for this agent" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Agent harness" }),
    );
    await userEvent.click(body.getByRole("option", { name: "Cursor" }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Model" }),
    );
    await expect(
      body.getByRole("option", { name: "Composer 2.5" }),
    ).toBeVisible();
    await expect(
      body.queryByRole("option", { name: "GPT-6" }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Agent harness" }),
    );
    await userEvent.click(body.getByRole("option", { name: "Claude Code" }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Model" }),
    );
    await expect(
      body.getByRole("option", { name: "Claude Sonnet" }),
    ).toBeVisible();
    await expect(
      body.queryByRole("option", { name: "Composer 2.5" }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  }}
  >{#snippet template()}<CommunityAgentEditorDialog
      bind:open
      agent={storyAgent}
      personas={storyPersonas}
      runtime={storyAgentRuntime}
      onSaveAgent={saveAgent}
      onSaveRuntime={saveRuntime}
    />{/snippet}</Story
>

<Story
  name="Empty model catalog"
  play={async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Customize for this agent" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Agent harness" }),
    );
    await userEvent.click(body.getByRole("option", { name: "Cursor" }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Model" }),
    );
    await expect(
      body.getByRole("option", { name: "Loading models…" }),
    ).toBeVisible();
    await expect(
      body.queryByRole("option", { name: "Composer 2.5" }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  }}
  >{#snippet template()}<CommunityAgentEditorDialog
      bind:open
      agent={storyAgent}
      personas={storyPersonas}
      runtime={storyPendingCatalogRuntime}
      onSaveAgent={saveAgent}
      onSaveRuntime={saveRuntime}
    />{/snippet}</Story
>
