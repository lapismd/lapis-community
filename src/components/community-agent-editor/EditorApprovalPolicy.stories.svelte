<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import { storyLongCursorRuntime } from "../community-agents/long-cursor-runtime-story-fixtures.js";
  import CommunityAgentEditorDialog from "./CommunityAgentEditorDialog.svelte";
  import {
    storyAgent,
    storyAgentRuntime,
  } from "../community-agents/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Agents/Approval policy",
    component: CommunityAgentEditorDialog,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: "<CommunityAgentEditorDialog bind:open {agent} {runtime} {onSaveAgent} {onSaveRuntime} />",
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Legacy defaults allow all and Ask saves explicitly"
  args={{ onSaveRuntime: fn(async () => storyAgentRuntime) }}
  play={async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const policy = body.getByRole("button", { name: "Permissions" });
    await expect(policy).toHaveTextContent("Allow all");
    await userEvent.click(policy);
    await userEvent.click(
      body.getByRole("option", { name: "Ask", exact: true }),
    );
    await expect(policy).toHaveTextContent("Ask");
    await userEvent.click(body.getByRole("button", { name: "Save changes" }));
    await expect(args.onSaveRuntime).toHaveBeenCalledWith({
      approvalPolicy: "ask",
    });
  }}
>
  {#snippet template(args)}
    <CommunityAgentEditorDialog
      open
      agent={storyAgent}
      runtime={{ ...storyAgentRuntime, saved: null }}
      onSaveAgent={async () => {}}
      onSaveRuntime={args.onSaveRuntime}
    />
  {/snippet}
</Story>

<Story
  name="Explicit Ask survives missing native modes"
  play={async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      body.getByRole("button", { name: "Permissions" }),
    ).toHaveTextContent("Ask");
  }}
>
  {#snippet template()}
    <CommunityAgentEditorDialog
      open
      agent={storyAgent}
      runtime={{
        ...storyAgentRuntime,
        effective: { ...storyAgentRuntime.effective, approvalPolicy: "ask" },
        catalog: { ...storyAgentRuntime.catalog, configOptions: [] },
      }}
      onSaveAgent={async () => {}}
      onSaveRuntime={async () => storyAgentRuntime}
    />
  {/snippet}
</Story>

<Story
  name="Ask survives a harness and model change"
  args={{ onSaveRuntime: fn(async () => storyLongCursorRuntime) }}
  play={async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const permissions = body.getByRole("button", { name: "Permissions" });
    await userEvent.click(permissions);
    await userEvent.click(
      body.getByRole("option", { name: "Ask", exact: true }),
    );
    await userEvent.click(
      body.getByRole("tab", { name: "Customize for this agent" }),
    );
    await userEvent.click(
      body.getByRole("tab", { name: "Cursor", exact: true }),
    );
    await userEvent.click(
      body.getByRole("option", { name: /Composer 2.5 Fast/ }),
    );
    await expect(permissions).toHaveTextContent("Ask");
    await userEvent.click(body.getByRole("button", { name: "Save changes" }));
    await expect(args.onSaveRuntime).toHaveBeenCalledWith({
      runtimeAgent: "cursor",
      model: "composer-2.5-fast",
      approvalPolicy: "ask",
    });
  }}
>
  {#snippet template(args)}
    <CommunityAgentEditorDialog
      open
      agent={storyAgent}
      runtime={storyLongCursorRuntime}
      onSaveAgent={async () => {}}
      onSaveRuntime={args.onSaveRuntime}
    />
  {/snippet}
</Story>
