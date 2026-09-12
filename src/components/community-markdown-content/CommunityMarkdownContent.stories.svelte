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
      layout: "padded",
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
    onMessageMember: fn(),
    onWaveMember: fn(),
    onOpenRoom: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const mention = canvas.getByRole("button", { name: "Ben Stone" });
    await expect(
      mention.querySelector('[data-ui-component="community-member-avatar"]'),
    ).not.toBeNull();
    const mentionAvatar = mention.querySelector<HTMLElement>(
      '[data-ui-component="community-member-avatar"]',
    )!;
    const mentionStyle = getComputedStyle(mention);
    const mentionFontSize = Number.parseFloat(mentionStyle.fontSize);
    const mentionLineHeight =
      Number.parseFloat(mentionStyle.lineHeight) || mentionFontSize * 1.5;
    await expect(mention.getBoundingClientRect().height).toBeLessThanOrEqual(
      mentionLineHeight + mentionFontSize * 0.2,
    );
    await expect(
      mentionAvatar.getBoundingClientRect().height,
    ).toBeLessThanOrEqual(mentionLineHeight);
    await expect(
      Math.abs(
        mention.getBoundingClientRect().top +
          mention.getBoundingClientRect().height / 2 -
          (mentionAvatar.getBoundingClientRect().top +
            mentionAvatar.getBoundingClientRect().height / 2),
      ),
    ).toBeLessThan(1);
    await userEvent.hover(mention);
    await expect(
      await page.findByRole("group", {
        name: "Ben Stone contact preview",
      }),
    ).toBeVisible();
    await userEvent.click(
      page.getByRole("button", { name: "Message Ben Stone" }),
    );
    await expect(args.onMessageMember).toHaveBeenCalledWith(
      communityComposerStoryMembers[1],
    );
    await userEvent.hover(mention);
    await userEvent.click(
      page.getByRole("button", { name: "Wave to Ben Stone" }),
    );
    await expect(args.onWaveMember).toHaveBeenCalledWith(
      communityComposerStoryMembers[1],
    );
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
    const particleCanvas = spoiler.querySelector<HTMLCanvasElement>(
      '[data-ui-part="spoiler-particles"]',
    );
    const spoilerContent = spoiler.querySelector<HTMLElement>(
      '[data-ui-part="spoiler-content"]',
    );
    if (!particleCanvas || !spoilerContent) {
      throw new Error("Expected the spoiler particle and content layers");
    }
    await expect(particleCanvas).toBeVisible();
    await expect(particleCanvas.width).toBeGreaterThan(1);
    await expect(getComputedStyle(spoilerContent).opacity).toBe("0");
    await userEvent.hover(spoiler);
    await expect(spoiler).toHaveAttribute("aria-pressed", "false");
    spoiler.focus();
    await expect(spoiler).toHaveAttribute("aria-pressed", "false");
    await userEvent.keyboard("{Enter}");
    await expect(spoiler).toHaveAttribute("aria-pressed", "true");
    await expect(spoiler).toHaveAttribute("data-revealed", "true");
    await expect(spoilerContent).toHaveAttribute("aria-hidden", "false");
  }}
/>

<Story
  name="Sparkle spoilers"
  args={{
    content:
      "The launch phrase is ||opal river||. A longer concealed passage like ||the relay migration begins after the final signature|| keeps its inline width while the particle density scales to the hidden content.",
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
