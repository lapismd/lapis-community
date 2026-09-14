<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";
  import CommunityAgentProcessingControl from "./CommunityAgentProcessingControl.svelte";
  import Example from "../community-patterns/examples/AgentProcessingExample.svelte";
  import source from "../community-patterns/examples/AgentProcessingExample.svelte?raw";
  const enabled = {
    enabled: true,
    revision: 0,
    status: "applied" as const,
    updatedAt: 1,
  };
  const disabled = { ...enabled, enabled: false, revision: 1 };
  const { Story } = defineMeta({
    title: "Community/Agents/Processing",
    component: CommunityAgentProcessingControl,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: source,
        },
      },
    },
  });
</script>

<Story
  name="Acknowledged transitions"
  args={{
    agentPubkey: "agent",
    onLoad: fn(async () => enabled),
    onSet: fn(async (active: boolean, revision: number) => ({
      ...enabled,
      enabled: active,
      revision: revision + 1,
    })),
  }}
  play={async ({ canvas, args }) => {
    const disable = await canvas.findByRole("button", { name: "Disable" });
    let acknowledge: (value: typeof disabled) => void = () => {};
    args.onSet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }),
    );
    await userEvent.click(disable);
    await expect(
      canvas.getByRole("button", { name: "Disabling…" }),
    ).toBeDisabled();
    await expect(canvas.queryByText("Disabled")).not.toBeInTheDocument();
    acknowledge(disabled);
    await expect(await canvas.findByText("Disabled")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Enable" }));
    await waitFor(() => expect(args.onSet).toHaveBeenLastCalledWith(true, 1));
    await expect(
      await canvas.findByRole("button", { name: "Disable" }),
    ).toBeVisible();
  }}
/>
<Story
  name="Cancellation failure and retry"
  args={{
    agentPubkey: "agent",
    onLoad: fn(async () => ({
      ...disabled,
      status: "error" as const,
      error: "Runtime cancellation failed",
    })),
    onSet: fn(async () => ({ ...disabled, revision: 2 })),
  }}
  play={async ({ canvas, args }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Runtime cancellation failed",
    );
    await expect(canvas.queryByText("Disabled")).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Retry Disable" }),
    );
    await waitFor(() => expect(args.onSet).toHaveBeenCalledWith(false, 1));
    await expect(await canvas.findByText("Disabled")).toBeVisible();
  }}
/>
<Story
  name="Unknown availability"
  args={{
    agentPubkey: "agent",
    connected: false,
    onLoad: fn(async () => enabled),
    onSet: fn(async () => disabled),
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Processing unknown")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Check processing state" }),
    ).toBeDisabled();
  }}
/>

<Story
  name="Public example"
  play={async ({ canvas }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Disable", exact: true }),
    );
    await expect(
      await canvas.findByText("Disabled", { exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Enable", exact: true }),
    );
    await expect(
      await canvas.findByRole("button", { name: "Disable", exact: true }),
    ).toBeVisible();
  }}>{#snippet template()}<Example />{/snippet}</Story
>
