<script module lang="ts">
  import { turnControlKey } from "../../community/agent-turn-controls.js";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyAgentPubkey,
    storyAgentState,
  } from "../community-agents/story-fixtures.js";
  let settle: { resolve(): void; reject(error: Error): void };
  const stopped = {
    agentPubkey: storyAgentPubkey,
    scopeKey: "scope/original",
    requestId: "request",
    sessionId: "session",
    turnId: "turn",
    state: "failed" as const,
    active: false,
  };
  const { Story } = defineMeta({
    title: "Community/Agents/Continue",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: "<CommunityAgentActivity {model} {onContinueTurn} {onCancelTurn} {onLatest} {onLoadOlder} {onClearHistory} />",
        },
      },
    },
  });
</script>

<Story
  name="Continue targets the stopped attempt and awaits acknowledgement"
  args={{
    onCancelTurn: fn(async () => {}),
    onContinueTurn: fn(
      () =>
        new Promise<void>((resolve, reject) => {
          settle = { resolve, reject };
        }),
    ),
  }}
  play={async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    const button = canvas.getByRole("button", {
      name: "Continue",
      exact: true,
    });
    await userEvent.click(button);
    await expect(args.onContinueTurn).toHaveBeenCalledWith(
      storyAgentPubkey,
      "scope/original",
      { requestId: "request", sessionId: "session", turnId: "turn" },
    );
    await expect(args.onCancelTurn).not.toHaveBeenCalled();
    await expect(button).toBeDisabled();
    await expect(
      canvas.getByRole("status", { name: "Agent control status" }),
    ).toHaveTextContent("Waiting for the controller to acknowledge Continue");
    settle.reject(
      new Error(
        "Prior tool outcome needs reconciliation. Refresh activity and retry.",
      ),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "needs reconciliation",
    );
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await expect(args.onContinueTurn).toHaveBeenCalledTimes(2);
    settle.resolve();
    await waitFor(() =>
      expect(
        canvas.getByRole("status", { name: "Agent control status" }),
      ).toHaveTextContent("Continue acknowledged"),
    );
    await expect(args.onCancelTurn).not.toHaveBeenCalled();
  }}
>
  {#snippet template(args)}
    <CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        conversationScopes: { request: stopped },
      })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
      onContinueTurn={args.onContinueTurn}
      onCancelTurn={args.onCancelTurn}
    />
  {/snippet}
</Story>
<Story
  name="Uncertain work requires reconciliation"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    await expect(
      canvas.getByText("Outcome uncertain", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Continue", exact: true }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        conversationScopes: {
          request: { ...stopped, state: "uncertain", active: true },
        },
      })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
      onContinueTurn={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Acknowledged failure survives changing Activity tabs"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Capture is unavailable",
    );
    await expect(
      canvas.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("tab", { name: "Activity", exact: true }),
    );
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Capture is unavailable",
    );
  }}
>
  {#snippet template()}
    <CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        conversationScopes: { request: stopped },
        turnControls: {
          [turnControlKey(storyAgentPubkey, stopped.scopeKey, stopped)]: {
            ...stopped,
            controlId: "control",
            status: "acknowledged",
            invocationId: "new-attempt",
            outcome: "failed",
            message:
              "Capture is unavailable. Open the new attempt for details.",
          },
        },
      })}
      onContinueTurn={async () => {}}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Completed work can explicitly continue with feedback"
  args={{ onContinueTurn: fn(async () => {}) }}
  play={async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Continue", exact: true }),
    );
    await expect(args.onContinueTurn).toHaveBeenCalledWith(
      storyAgentPubkey,
      "scope/original",
      { requestId: "request", sessionId: "session", turnId: "turn" },
    );
    await expect(
      canvas.getByRole("status", { name: "Agent control status" }),
    ).toHaveTextContent("Continue acknowledged");
  }}
>
  {#snippet template(args)}<CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        conversationScopes: { request: { ...stopped, state: "completed" } },
      })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
      onContinueTurn={args.onContinueTurn}
    />{/snippet}
</Story>
