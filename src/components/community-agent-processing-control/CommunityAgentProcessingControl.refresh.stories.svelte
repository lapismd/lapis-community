<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, waitFor } from "storybook/test";
  import CommunityAgentProcessingControl from "./CommunityAgentProcessingControl.svelte";
  const enabled = {
    enabled: true,
    revision: 0,
    status: "applied" as const,
    updatedAt: 1,
  };
  let finishChecking: (value: typeof enabled) => void = () => {};
  const { Story } = defineMeta({
    title: "Community/Agents/Processing",
    component: CommunityAgentProcessingControl,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Last-known status during refresh"
  args={{
    agentPubkey: "known-agent",
    presentation: "card",
    state: enabled,
    onLoad: fn(
      () =>
        new Promise<typeof enabled>((resolve) => {
          finishChecking = resolve;
        }),
    ),
    onSet: fn(async () => ({ ...enabled, enabled: false, revision: 1 })),
  }}
  play={async ({ canvas, args }) => {
    const stop = await canvas.findByRole("button", {
      name: "Stop",
      exact: true,
    });
    await expect(stop).toBeEnabled();
    await expect(stop).toHaveAttribute("aria-busy", "false");
    await expect(
      canvas.queryByRole("button", { name: "Checking…" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(args.onLoad).toHaveBeenCalledTimes(1));
    finishChecking(enabled);
    await expect(
      await canvas.findByRole("button", { name: "Stop", exact: true }),
    ).toBeEnabled();
  }}
/>
