<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import {
    communityComposerStoryEmojis,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "../community-chat-composer/story-fixtures.js";
  import CommunityMarkdownContent from "./CommunityMarkdownContent.svelte";

  const unsafeMarkdown =
    "Unknown @Person and #not-a-room stay plain.\n\n<scr" +
    "ipt>window.storybookUnsafe = true</scr" +
    "ipt>\n\n[Unsafe](javascript:alert('no'))";

  const { Story } = defineMeta({
    title: "Community/Channels/Markdown Content",
    component: CommunityMarkdownContent,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
      docs: {
        source: {
          code: `<CommunityMarkdownContent
  content={message.content}
  mentionPubkeys={message.mentionPubkeys}
  {members}
  {rooms}
  {communityEmojis}
  onOpenMember={openMember}
  onOpenRoom={openRoom}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Chat Markdown matrix"
  args={{
    content:
      'Hello @Ben Stone — the **registry fixture** is ready in #plugin-development :lapis: :shipit:.\n\n> Signed events remain the source of truth.\n\n- Verify the release manifest\n- Run `pnpm local:smoke`\n\n```ts\nconst source = "nostr";\n```\n\nA [safe link](https://lapis.md) and ||a spoiler for reviewers||.',
    mentionPubkeys: ["ben"],
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    onOpenMember: fn(),
    onOpenRoom: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const mention = canvas.getByRole("button", { name: "@Ben Stone" });
    await userEvent.hover(mention);
    await expect(
      await page.findByRole("group", {
        name: "Ben Stone contact preview",
      }),
    ).toBeVisible();
    await userEvent.click(mention);
    await expect(args.onOpenMember).toHaveBeenCalledWith(
      communityComposerStoryMembers[1],
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "#plugin-development" }),
    );
    await expect(args.onOpenRoom).toHaveBeenCalledWith("plugin-development");
    const lapisEmoji = canvas.getByRole("img", { name: ":lapis:" });
    const shipitEmoji = canvas.getByRole("img", { name: ":shipit:" });
    await expect(lapisEmoji).toBeVisible();
    await expect(shipitEmoji).toBeVisible();
    await expect(getComputedStyle(lapisEmoji).display).toBe("inline-block");
    await expect(
      Math.abs(
        lapisEmoji.getBoundingClientRect().top -
          shipitEmoji.getBoundingClientRect().top,
      ),
    ).toBeLessThan(2);
    const spoiler = canvas.getByRole("button", { name: "Reveal spoiler" });
    await userEvent.click(spoiler);
    await expect(spoiler).toHaveAttribute("aria-pressed", "true");
  }}
/>

<Story
  name="Ambiguous and unsafe input"
  args={{
    content: unsafeMarkdown,
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
  }}
  play={async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("script")).toBeNull();
    await expect(
      canvasElement.querySelector('a[href^="javascript:"]'),
    ).toBeNull();
  }}
/>
