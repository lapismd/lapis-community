<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within, userEvent, fn, waitFor } from "storybook/test";
  import CommunityAgentEditorDialog from "./CommunityAgentEditorDialog.svelte";
  import {
    storyAgent,
    storyAgentRuntime,
    storyPersonas,
  } from "../community-agents/story-fixtures.js";
  import type {
    CommunityAgentRuntimeState,
    CommunityAgentSaveInput,
  } from "../../community/agent-contracts.js";

  import { Button } from "@lapismd/design-core/shadcn/button";
  const members = [
    { id: "a".repeat(64), name: "Ada Chen", handle: "ada", initials: "AC" },
    { id: "b".repeat(64), name: "Noor Rahman", handle: "noor", initials: "NR" },
  ];
  const unknown = "f".repeat(64);
  const allowedAgent = {
    ...storyAgent,
    instance: { ...storyAgent.instance!, dmAllowlist: [unknown] },
  };
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
  name="Compact participant list"
  args={{
    agent: storyAgent,
    members: Array.from({ length: 12 }, (_, index) => ({
      id: (index + 1).toString(16).padStart(64, "0"),
      name: `Community user ${index + 1}`,
      handle: `user${index + 1}`,
      initials: "CU",
    })),
    onSaveAgent: fn(async () => {}),
  }}
  play={async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const field = body.getByRole("group", {
      name: "Who can message this agent",
      exact: true,
    });
    const command = field.querySelector<HTMLElement>(
      '[data-ui-component="command-view"][data-ui-part="root"]',
    )!;
    const viewport = within(field)
      .getByRole("listbox")
      .closest<HTMLElement>('[data-ui-part="scroll-area-viewport"]')!;
    await expect(command).toBeVisible();
    await expect(getComputedStyle(command).margin).toBe("0px");
    await expect(getComputedStyle(command).padding).toBe("0px");
    await expect(
      Math.abs(
        command.getBoundingClientRect().left -
          field.getBoundingClientRect().left,
      ),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(
        command.getBoundingClientRect().right -
          field.getBoundingClientRect().right,
      ),
    ).toBeLessThanOrEqual(1);
    await expect(viewport.getBoundingClientRect().height).toBeLessThanOrEqual(
      160,
    );
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    await userEvent.type(
      within(field).getByRole("combobox", { name: "Search community users" }),
      "user 12",
    );
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      within(field).getByRole("button", { name: "Remove Community user 12" }),
    ).toBeVisible();
  }}
  >{#snippet template(args)}<CommunityAgentEditorDialog
      {...args}
      bind:open
    />{/snippet}</Story
>

<Story
  name="Harness defaults"
  play={async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    await expect(
      within(dialog).getByRole("tab", { name: "Use harness defaults" }),
    ).toBeVisible();
    await expect(within(dialog).getByText("Harness")).toBeVisible();
    await expect(within(dialog).getByText("Codex")).toBeVisible();
    await expect(within(dialog).getByText("GPT-6")).toBeVisible();
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
  name="Messaging participant selection"
  args={{ agent: allowedAgent, members, onSaveAgent: fn(async () => {}) }}
  play={async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(body.getByRole("dialog", { name: "Edit agent" }));
    await expect(body.getAllByRole("dialog")).toHaveLength(1);
    const search = dialog.getByRole("combobox", {
      name: "Search community users",
    });
    await userEvent.type(search, "Ada");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      dialog.getByRole("button", { name: "Remove Ada Chen" }),
    ).toBeVisible();
    await userEvent.clear(search);
    await userEvent.click(dialog.getByRole("option", { name: /Noor/ }));
    await expect(
      dialog.getByRole("button", { name: "Remove Noor Rahman" }),
    ).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: "Remove ffffffffffff" }),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await expect(args.onSaveAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        dmAllowlist: members.map((member) => member.id),
      }),
    );
  }}
  >{#snippet template(args)}<CommunityAgentEditorDialog
      {...args}
      bind:open
    />{/snippet}</Story
>

<Story
  name="Rejected participant save"
  args={{
    agent: allowedAgent,
    members,
    onSaveAgent: fn(async (): Promise<void> => {
      throw new Error("Relay rejected this update");
    }),
  }}
  play={async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(body.getByRole("dialog", { name: "Edit agent" }));
    await userEvent.click(dialog.getByRole("option", { name: /Ada/ }));
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await expect(
      await dialog.findByText("Relay rejected this update"),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Remove Ada Chen" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Remove ffffffffffff" }),
    ).toBeVisible();
    args.onSaveAgent.mockImplementation(async () => {});
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await expect(args.onSaveAgent).toHaveBeenLastCalledWith(
      expect.objectContaining({ dmAllowlist: [unknown, members[0].id] }),
    );
  }}
  >{#snippet template(args)}<CommunityAgentEditorDialog
      {...args}
      bind:open
    />{/snippet}</Story
>

<Story
  name="Cancel participant changes"
  args={{ agent: storyAgent, members, onSaveAgent: fn(async () => {}) }}
  play={async ({ canvas, canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    let dialog = within(body.getByRole("dialog", { name: "Edit agent" }));
    await userEvent.click(dialog.getByRole("option", { name: /Ada/ }));
    await expect(
      dialog.getByRole("button", { name: "Remove Ada Chen" }),
    ).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    );
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Reopen editor" }),
    );
    dialog = within(body.getByRole("dialog", { name: "Edit agent" }));
    await expect(
      dialog.queryByRole("button", { name: "Remove Ada Chen" }),
    ).not.toBeInTheDocument();
    await expect(args.onSaveAgent).not.toHaveBeenCalled();
  }}
  >{#snippet template(args)}<Button onclick={() => (open = true)}
      >Reopen editor</Button
    ><CommunityAgentEditorDialog {...args} bind:open />{/snippet}</Story
>
