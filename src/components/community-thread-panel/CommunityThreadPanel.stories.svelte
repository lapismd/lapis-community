<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "The thread sidebar has its own scroll-to-latest recovery control and scroll state, independent from the main conversation.",
        },
      },
    },
  });
</script>

<Story
  name="Nested replies shown chronologically"
  args={{
    thread: communityStoryThread,
    members: communityStoryMembers,
    onSendReply: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
    onCopyMessageLink: fn(),
    onDeleteMessage: fn(),
    onReply: fn(),
    onCancelReply: fn(),
    replyTarget: {
      eventId: "thread-1",
      roomId: "general",
      authorId: "mara",
      authorName: "Mara Chen",
      content:
        "Confirmed here too. The approval is visible in the public read model but the relay still treats it as an ordinary signed message.",
      kind: "channel",
    },
  }}
  play={async ({ canvas, args }) => {
    const list = canvas.getByRole("log", { name: "Thread replies" });
    const inner = list.querySelector<HTMLElement>(
      ':scope > [data-ui-part="list-inner"]',
    );
    const spacer = inner?.querySelector<HTMLElement>(
      ':scope > [data-ui-part="list-spacer"]',
    );
    const firstContent = spacer?.nextElementSibling as HTMLElement | null;
    await expect(inner).not.toBeNull();
    await expect(spacer).not.toBeNull();
    await expect(firstContent).not.toBeNull();
    await expect(getComputedStyle(spacer!).display).toBe("none");
    await expect(
      firstContent!.getBoundingClientRect().top -
        inner!.getBoundingClientRect().top,
    ).toBeLessThanOrEqual(
      Number.parseFloat(getComputedStyle(inner!).paddingTop) + 1,
    );

    const composer = canvas.getByRole("textbox", {
      name: "Markdown editor",
    });
    await expect(canvas.queryByLabelText("Thread from Ben Stone")).toBeNull();
    await expect(
      canvas
        .getByLabelText("Replying to Mara Chen")
        .closest('[data-ui-component="ai-chat-composer-drawer"]'),
    ).toBeVisible();
    await expect(
      canvas.getAllByText(/I have published the AI plugin fixture/u)[0],
    ).toBeVisible();
    await userEvent.type(composer, "An isolated thread reply");
    await userEvent.keyboard("{Enter}");
    await expect(args.onSendReply).toHaveBeenCalledWith(
      "message-release",
      "An isolated thread reply",
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "2 reactions with 👍" }),
    );
    await expect(args.onToggleReaction).toHaveBeenCalledWith("thread-1", "👍");

    await userEvent.click(canvas.getAllByRole("button", { name: "Reply" })[0]!);
    await expect(args.onReply).toHaveBeenCalledWith("thread-1");
    await userEvent.click(canvas.getByRole("button", { name: "Cancel reply" }));
    await expect(args.onCancelReply).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Participation failure stays with reply composer"
  args={{
    thread: communityStoryThread,
    members: communityStoryMembers,
    disabled: true,
    disabledReason: "Connection lost while publishing",
    composerStatus: {
      type: "error" as const,
      message: "Connection lost while publishing",
    },
    onRetryComposerStatus: fn(),
    onDismissComposerStatus: fn(),
  }}
  play={async ({ canvas, args }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Connection lost while publishing");
    await expect(
      alert.closest('[data-ui-component="ai-chat-composer"]'),
    ).not.toBeNull();
    const retry = canvas.getByRole("button", { name: "Retry" });
    const dismiss = canvas.getByRole("button", { name: "Dismiss" });
    await expect(retry).toHaveAttribute("data-size", "icon-xs");
    await expect(dismiss).toHaveAttribute("data-size", "icon-xs");
    const alertBounds = alert.getBoundingClientRect();
    const composerBodyBounds = alert
      .closest('[data-ui-component="ai-chat-composer"]')!
      .querySelector(':scope > [data-ui-part="body"]')!
      .getBoundingClientRect();
    const retryBounds = retry.getBoundingClientRect();
    const dismissBounds = dismiss.getBoundingClientRect();
    await expect(retryBounds.left).toBeGreaterThan(
      alertBounds.left + alertBounds.width / 2,
    );
    await expect(alertBounds.right - dismissBounds.right).toBeLessThanOrEqual(
      12,
    );
    await expect(
      Math.abs(
        retryBounds.top +
          retryBounds.height / 2 -
          (alertBounds.top + (composerBodyBounds.top - alertBounds.top) / 2),
      ),
    ).toBeLessThanOrEqual(1);
    await expect(retry.querySelector("svg")).not.toBeNull();
    await expect(dismiss.querySelector("svg")).not.toBeNull();
    await userEvent.click(retry);
    await expect(args.onRetryComposerStatus).toHaveBeenCalledOnce();
    await userEvent.click(dismiss);
    await expect(args.onDismissComposerStatus).toHaveBeenCalledOnce();
    dismiss.blur();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>
