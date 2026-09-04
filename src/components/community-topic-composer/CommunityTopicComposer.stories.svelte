<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";
  import CommunityTopicComposer from "./CommunityTopicComposer.svelte";
  const { Story } = defineMeta({
    title: "Community/Forums/Topic composer",
    component: CommunityTopicComposer,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="New topic"
  args={{ forumName: "support", onPublish: fn(async () => {}) }}
  play={async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Start a new post in support" }),
    );
    await userEvent.type(
      canvas.getByRole("combobox", { name: "Message" }),
      "How should portable forums work?",
    );
    await userEvent.keyboard("{Enter}");
    await expect(args.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "How should portable forums work?",
        content: "How should portable forums work?",
      }),
    );
  }}
>
  {#snippet template(args)}<CommunityTopicComposer {...args} />{/snippet}</Story
>

<Story
  name="Participation warning"
  args={{
    forumName: "support",
    disabled: true,
    disabledReason: "Join this room before posting or reacting",
    composerStatus: {
      type: "warning" as const,
      message: "Join this room before posting or reacting",
    },
    onPublish: fn(async () => {}),
  }}
  play={async ({ canvas }) => {
    const warning = canvas.getByRole("status");
    await expect(warning).toHaveTextContent(
      "Join this room before posting or reacting",
    );
    await expect(warning).toHaveAttribute("data-status", "warning");
    await expect(
      warning.closest('[data-ui-component="ai-chat-composer"]'),
    ).not.toBeNull();
    await expect(canvas.getByRole("combobox")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(
      canvas.queryByRole("button", { name: "Start a new post in support" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}<CommunityTopicComposer {...args} />{/snippet}
</Story>
