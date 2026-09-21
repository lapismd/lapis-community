<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityAgentEditorDialog from "./CommunityAgentEditorDialog.svelte";
  import { playEmptyModelCatalog } from "./editor-catalog-story.js";
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
  play={async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    const scoped = within(dialog);
    await userEvent.click(
      scoped.getByRole("tab", { name: "Customize for this agent" }),
    );
    const search = scoped.getByRole("combobox", { name: "Search models" });
    const picker = dialog.querySelector<HTMLElement>(
      '[data-ui-part="agent-editor-model-picker"]',
    )!;
    const viewport = within(picker)
      .getByRole("listbox")
      .closest<HTMLElement>('[data-ui-part="scroll-area-viewport"]')!;
    await expect(search).toBeVisible();
    await expect(viewport.getBoundingClientRect().height).toBeLessThanOrEqual(
      256,
    );
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    await expect(scoped.getByRole("option", { name: /GPT-6/ })).toBeVisible();
    await expect(scoped.getAllByText("Codex").length).toBeGreaterThan(0);
    await expect(scoped.getAllByText("Cursor").length).toBeGreaterThan(0);
    await expect(scoped.getAllByText("OpenCode").length).toBeGreaterThan(0);
    await userEvent.type(search, "Composer");
    await expect(
      scoped.getByRole("option", { name: /Composer 2.5 Fast/ }),
    ).toBeVisible();
    await expect(
      scoped.queryByRole("option", { name: /^GPT-6/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      scoped.getByRole("option", { name: /Composer 2.5 Fast/ }),
    );
    await expect(
      scoped.getByText("Selected model: Composer 2.5 Fast"),
    ).toBeVisible();
    await expect(scoped.queryByLabelText("Thinking")).not.toBeInTheDocument();
    await userEvent.click(scoped.getByRole("button", { name: "Save changes" }));
    await expect(args.onSaveRuntime).toHaveBeenCalledWith({
      runtimeAgent: "cursor",
      model: "composer-2.5-fast",
    });
  }}
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
