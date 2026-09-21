<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
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
  play={async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    const scoped = within(dialog);
    await userEvent.click(
      scoped.getByRole("tab", { name: "Customize for this agent" }),
    );
    await userEvent.click(
      scoped.getByRole("button", { name: "Agent harness" }),
    );
    await userEvent.click(body.getByRole("option", { name: "Cursor" }));
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
    await expect(
      scoped.getByRole("option", { name: /^Composer 2.5$/ }),
    ).toBeVisible();
    await expect(
      scoped.queryByRole("option", { name: /^GPT-6$/ }),
    ).not.toBeInTheDocument();
    await userEvent.type(search, "Fast");
    await expect(
      scoped.getByRole("option", { name: /^Composer 2.5 Fast$/ }),
    ).toBeVisible();
    await expect(
      scoped.queryByRole("option", { name: /^Composer 2.5$/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      scoped.getByRole("option", { name: /^Composer 2.5 Fast$/ }),
    );
    await expect(
      scoped.getByText("Selected model: Composer 2.5 Fast"),
    ).toBeVisible();
    await userEvent.click(
      scoped.getByRole("button", { name: "Agent harness" }),
    );
    await userEvent.click(body.getByRole("option", { name: "Claude Code" }));
    await expect(
      scoped.getByRole("option", { name: /^Claude Sonnet$/ }),
    ).toBeVisible();
    await expect(
      scoped.queryByRole("option", { name: /^Composer 2.5 Fast$/ }),
    ).not.toBeInTheDocument();
  }}
  >{#snippet template()}<CommunityAgentEditorDialog
      bind:open
      agent={storyAgent}
      personas={storyPersonas}
      runtime={storyLongCursorRuntime}
      onSaveAgent={saveAgent}
      onSaveRuntime={saveRuntime}
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
