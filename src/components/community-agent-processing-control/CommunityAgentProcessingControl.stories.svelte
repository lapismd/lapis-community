<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";
  import { Toaster, toast } from "svelte-sonner";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityProfileActions from "../community-profile-actions/CommunityProfileActions.svelte";
  import CommunityAgentProcessingControl from "./CommunityAgentProcessingControl.svelte";
  import Example from "../community-patterns/examples/AgentProcessingExample.svelte";
  import source from "../community-patterns/examples/AgentProcessingExample.svelte?raw";
  const enabled = {
    enabled: true,
    revision: 0,
    status: "applied" as const,
    updatedAt: 1,
  };
  let finishChecking: (value: typeof enabled) => void = () => {};
  const disabled = { ...enabled, enabled: false, revision: 1 };
  const { Story } = defineMeta({
    title: "Community/Agents/Processing",
    component: CommunityAgentProcessingControl,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source } } },
    beforeEach: () => {
      toast.dismiss();
    },
  });
</script>

<Story
  name="Acknowledged transitions"
  args={{
    agentPubkey: "agent",
    presentation: "profile",
    onLoad: fn(async () => enabled),
    onSet: fn(async (active: boolean, revision: number) => ({
      ...enabled,
      enabled: active,
      revision: revision + 1,
    })),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const stop = await canvas.findByRole("button", {
      name: "Stop",
      exact: true,
    });
    await expect(stop).toHaveAttribute("data-variant", "outline");
    await expect(stop.querySelector('svg[aria-hidden="true"]')).toBeVisible();
    let acknowledge: (value: typeof disabled) => void = () => {};
    args.onSet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }),
    );
    await userEvent.click(stop);
    const enabledBadge = body.getByText("Enabled", { exact: true });
    await expect(enabledBadge).toHaveAttribute("data-chip-tone", "success");
    const enabledBackground = getComputedStyle(enabledBadge).backgroundColor;
    await expect(
      body.getByRole("menuitem", { name: "Start agent" }),
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(body.getByRole("menuitem", { name: "Stop agent" }));
    const stopping = canvas.getByRole("button", { name: "Stopping…" });
    await expect(stopping).toBeDisabled();
    await expect(stopping.textContent?.trim()).toBe("");
    await expect(stopping.querySelectorAll("svg")).toHaveLength(1);
    await expect(
      stopping.querySelector('[data-ui-component="spinner"]'),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Start", exact: true }),
    ).not.toBeInTheDocument();
    acknowledge(disabled);
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Start", exact: true }),
    );
    const disabledBadge = body.getByText("Disabled", { exact: true });
    await expect(disabledBadge).toBeVisible();
    await expect(disabledBadge).toHaveAttribute("data-chip-tone", "neutral");
    await expect(getComputedStyle(disabledBadge).backgroundColor).not.toBe(
      enabledBackground,
    );
    await userEvent.click(body.getByRole("menuitem", { name: "Start agent" }));
    await waitFor(() => expect(args.onSet).toHaveBeenLastCalledWith(true, 1));
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Stop", exact: true }),
    );
    await userEvent.click(
      body.getByRole("menuitem", { name: "Refresh status" }),
    );
    await waitFor(() => expect(args.onLoad).toHaveBeenCalledTimes(2));
  }}
  >{#snippet template(args)}<CommunityAgentProcessingControl
      {...args}
    /><Toaster />{/snippet}</Story
>

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
  play={async ({ canvas, canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByText("Runtime cancellation failed")).toBeVisible(),
    );
    await expect(
      canvasElement.querySelector('.agent-processing [role="alert"]'),
    ).toBeNull();
    await userEvent.click(
      await canvas.findByRole("button", { name: "Retry Stop" }),
    );
    await expect(body.getByText("Cancellation failed")).toHaveAttribute(
      "data-chip-tone",
      "danger",
    );
    await expect(
      body.getByRole("menuitem", { name: "Start agent" }),
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(body.getByRole("menuitem", { name: "Retry stop" }));
    await waitFor(() => expect(args.onSet).toHaveBeenCalledWith(false, 1));
    await expect(
      await canvas.findByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
  }}
  >{#snippet template(args)}<CommunityAgentProcessingControl
      {...args}
    /><Toaster />{/snippet}</Story
>

<Story
  name="Unknown availability"
  args={{
    agentPubkey: "agent",
    connected: false,
    onLoad: fn(async () => enabled),
    onSet: fn(async () => disabled),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Agent controls, status unknown" }),
    ).toBeDisabled();
  }}
/>

<Story
  name="Refresh unknown state"
  args={{
    agentPubkey: "agent",
    onLoad: fn(async (): Promise<typeof enabled> => {
      throw new Error("Controller unavailable");
    }),
    onSet: fn(async () => disabled),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByText("Controller unavailable")).toBeVisible(),
    );
    args.onLoad.mockImplementation(async () => enabled);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Agent controls, status unknown",
      }),
    );
    await expect(body.getByText("Status unknown")).toHaveAttribute(
      "data-chip-tone",
      "neutral",
    );
    for (const name of ["Start agent", "Stop agent"])
      await expect(body.getByRole("menuitem", { name })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    await userEvent.click(
      body.getByRole("menuitem", { name: "Refresh status" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "Stop", exact: true }),
    ).toBeVisible();
    await expect(args.onSet).not.toHaveBeenCalled();
  }}
  >{#snippet template(args)}<CommunityAgentProcessingControl
      {...args}
    /><Toaster />{/snippet}</Story
>

<Story
  name="Public example"
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Stop", exact: true }),
    );
    await userEvent.click(body.getByRole("menuitem", { name: "Stop agent" }));
    await expect(
      await canvas.findByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
  }}>{#snippet template()}<Example />{/snippet}</Story
>

<Story
  name="Checking status"
  args={{
    agentPubkey: "checking-agent",
    presentation: "card",
    onLoad: fn(
      () =>
        new Promise<typeof enabled>((resolve) => {
          finishChecking = resolve;
        }),
    ),
    onSet: fn(async () => disabled),
  }}
  play={async ({ canvas }) => {
    const checking = await canvas.findByRole("button", { name: "Checking…" });
    await expect(checking).toBeDisabled();
    await expect(checking).toHaveAttribute("aria-busy", "true");
    await expect(checking).toHaveAttribute("data-variant", "secondary");
    await expect(checking.textContent?.trim()).toBe("");
    await expect(checking.querySelectorAll("svg")).toHaveLength(1);
    await expect(getComputedStyle(checking).borderTopWidth).toBe("1px");
    await expect(getComputedStyle(checking).boxShadow).not.toBe("none");
    await expect(
      checking.querySelector('[data-ui-component="spinner"]'),
    ).toBeVisible();
    finishChecking(enabled);
    await expect(
      await canvas.findByRole("button", { name: "Stop", exact: true }),
    ).toBeEnabled();
  }}
/>

<Story
  name="Checking profile status"
  args={{
    agentPubkey: "checking-profile-agent",
    presentation: "profile",
    onLoad: fn(
      () =>
        new Promise<typeof enabled>((resolve) => {
          finishChecking = resolve;
        }),
    ),
    onSet: fn(async () => disabled),
  }}
  play={async ({ canvas }) => {
    const checking = await canvas.findByRole("button", { name: "Checking…" });
    await expect(checking).toBeDisabled();
    await expect(checking.textContent?.trim()).toBe("");
    await expect(checking.querySelectorAll("svg")).toHaveLength(1);
    await expect(
      checking.querySelector('[data-ui-component="spinner"]'),
    ).toBeVisible();
    finishChecking(enabled);
    const stop = await canvas.findByRole("button", { name: "Stop", exact: true });
    const message = canvas.getByRole("button", { name: "Message" });
    const stopBox = stop.getBoundingClientRect();
    const messageBox = message.getBoundingClientRect();
    await expect(stop).toBeEnabled();
    await expect(stop).toHaveAttribute("data-variant", "outline");
    await expect(Math.abs(stopBox.top - messageBox.top)).toBeLessThan(1);
    await expect(Math.abs(stopBox.width - messageBox.width)).toBeLessThan(1);
    await expect(Math.abs(stopBox.height - messageBox.height)).toBeLessThan(1);
    await expect(
      `${Math.round(stopBox.width)}x${Math.round(stopBox.height)}`,
    ).toBe("210x120");
  }}
  >{#snippet template(args)}<CommunityProfileActions label="Agent profile actions"
      ><Button variant="outline">Message</Button><CommunityAgentProcessingControl
        {...args}
      /></CommunityProfileActions
    >{/snippet}</Story
>

<Story
  name="Cancelling status"
  args={{
    agentPubkey: "cancelling-agent",
    onLoad: fn(async () => ({ ...disabled, status: "cancelling" as const })),
    onSet: fn(async () => disabled),
  }}
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Retry Stop" }),
    );
    await expect(body.getByText("Cancelling", { exact: true })).toHaveAttribute(
      "data-chip-tone",
      "warning",
    );
    await expect(
      body.getByRole("menuitem", { name: "Start agent" }),
    ).toHaveAttribute("aria-disabled", "true");
  }}
/>
