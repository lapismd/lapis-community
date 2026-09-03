<script module lang="ts">
  import { Composer } from "@lapismd/design-core/ai/chat";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import CommunityReplyContext from "./CommunityReplyContext.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Reply Context",
    component: CommunityReplyContext,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "Shared reply context used by Inbox, channel, forum, direct-message, and thread composers.",
        },
        source: {
          language: "svelte",
          code: `<Composer>
  {#snippet drawer()}
    <CommunityReplyContext {target} onCancel={cancelReply} />
  {/snippet}
</Composer>`,
        },
      },
    },
  });
</script>

<Story
  name="Composer reply target"
  args={{
    target: {
      eventId: "message-release",
      roomId: "general",
      authorId: "ada",
      authorName: "Ada Lovelace",
      content:
        "I have published the AI plugin fixture so the release can be reviewed.",
      kind: "channel",
    },
    onCancel: fn(),
  }}
  play={async ({ canvas, args }) => {
    const context = canvas.getByLabelText("Replying to Ada Lovelace");
    const composer = context.closest<HTMLElement>(
      '[data-ui-component="ai-chat-composer"]',
    );
    const composerBody = composer?.querySelector<HTMLElement>(
      ':scope > [data-ui-part="body"]',
    );
    await expect(context).toBeVisible();
    await expect(composerBody).not.toBeNull();
    await expect(getComputedStyle(context).borderTopLeftRadius).toBe(
      getComputedStyle(composerBody!).borderTopLeftRadius,
    );
    await expect(getComputedStyle(context).borderTopRightRadius).toBe(
      getComputedStyle(composerBody!).borderTopRightRadius,
    );
    await expect(getComputedStyle(context).borderBottomLeftRadius).toBe("0px");
    const title = canvas.getByText("Replying to Ada Lovelace");
    const message = canvas.getByText(
      "I have published the AI plugin fixture so the release can be reviewed.",
    );
    await expect(message.getBoundingClientRect().left).toBe(
      title.getBoundingClientRect().left,
    );
    const closeButton = canvas.getByRole("button", { name: "Cancel reply" });
    await expect(closeButton).toHaveClass("community-reply-context__close");
    await userEvent.click(closeButton);
    await expect(args.onCancel).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <div style="width: min(100%, 42rem); padding: 1rem;">
      <Composer
        value=""
        placeholder="Message #general"
        style="--ui-ai-chat-composer-radius: 0.75rem"
      >
        {#snippet drawer()}
          <CommunityReplyContext {...args} />
        {/snippet}
      </Composer>
    </div>
  {/snippet}
</Story>
