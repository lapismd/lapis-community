<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import { noop, storyPosts, storyProfiles } from "../story-fixtures.js";
  import DiscussionComposer from "./DiscussionComposer.svelte";

  const { Story } = defineMeta({
    title: "Community/Discussion/Composer",
    component: DiscussionComposer,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="New comment"
  args={{
    name: "AI",
    profiles: storyProfiles,
    postNumber: () => 1,
    signedInPubkey: "",
    comment: "",
    onCancel: noop,
    onSubmit: fn(async () => true),
  }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.queryByText(/NIP-07|signer is required/iu),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Start a discussion about AI" }),
    );
    const composer = canvas.getByRole("textbox", {
      name: "Markdown editor",
    });
    await expect(composer).toHaveFocus();
    await expect(
      canvas.queryByText(/NIP-07|signer is required/iu),
    ).not.toBeInTheDocument();
    await userEvent.type(composer, "A portable registry is useful.");
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith(
      "A portable registry is useful.",
    );
    await expect(
      canvas.getByRole("button", { name: "Start a discussion about AI" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Replying"
  args={{
    name: "AI",
    replyingTo: storyPosts[1],
    profiles: storyProfiles,
    postNumber: () => 2,
    signedInPubkey: storyPosts[0].event.pubkey,
    comment: "A progress affordance would help here.",
    onCancel: noop,
    onSubmit: noop,
  }}
  play={async ({ canvas }) => {
    const composer = canvas.getByRole("textbox", {
      name: "Markdown editor",
    });
    await expect(composer).toHaveTextContent(
      "A progress affordance would help here.",
    );
    await expect(
      canvas.getByRole("group", { name: "Replying to Ben Stone" }),
    ).toHaveTextContent(
      "I tested with roughly 8,000 notes. Index warm-up dominates, then responses stay comfortably interactive.",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile for Ada Lovelace" }),
    );
    await expect(
      within(document.body).getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Docked composer states"
  parameters={{ layout: "fullscreen" }}
  args={{
    name: "AI",
    profiles: storyProfiles,
    postNumber: () => 1,
    signedInPubkey: storyPosts[0].event.pubkey,
    comment: "This draft should survive docking changes.",
    variant: "docked",
    presentation: "open",
    height: 320,
    onCancel: noop,
    onHeightCommit: fn(),
    onSubmit: fn(async () => true),
  }}
  play={async ({ canvas, args }) => {
    const composer = canvas.getByRole("group", {
      name: "Discussion about AI",
    });
    await expect(composer).toBeVisible();
    const panel = composer.closest<HTMLElement>(
      '[data-ui-part="docked-panel"]',
    );
    await expect(panel).not.toBeNull();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await expect(panel!.getBoundingClientRect().width).toBeLessThan(
      window.innerWidth - 16,
    );
    const openBounds = panel!.getBoundingClientRect();
    await expect(
      Math.abs(openBounds.left + openBounds.width / 2 - window.innerWidth / 2),
    ).toBeLessThan(2);
    const editorViewport = composer.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    );
    await expect(editorViewport).not.toBeNull();
    await expect(
      editorViewport!.getBoundingClientRect().height,
    ).toBeGreaterThan(100);
    const resize = canvas.getByRole("separator", {
      name: /Resize discussion composer/u,
    });
    resize.focus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(args.onHeightCommit).toHaveBeenCalled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Minimize composer" }),
    );
    await expect(
      canvas.queryByRole("button", { name: "Restore composer" }),
    ).not.toBeInTheDocument();
    const restoreTitle = canvas.getByRole("button", {
      name: "Restore composer. Discussion about AI",
    });
    await expect(restoreTitle.querySelector("svg")).toBeVisible();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const minimizedBounds = panel!.getBoundingClientRect();
    await expect(
      Math.abs(
        minimizedBounds.left +
          minimizedBounds.width / 2 -
          window.innerWidth / 2,
      ),
    ).toBeLessThan(2);
    await userEvent.click(restoreTitle);
    await userEvent.click(
      canvas.getByRole("button", { name: "Fullscreen composer" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Exit fullscreen composer" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.getByRole("button", { name: "Fullscreen composer" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close composer" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Start a discussion about AI" }),
    ).toHaveFocus();
    await userEvent.click(
      canvas.getByRole("button", { name: "Start a discussion about AI" }),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveTextContent("This draft should survive docking changes.");
  }}
/>

<Story
  name="Docked minimized"
  parameters={{ layout: "fullscreen" }}
  args={{
    name: "AI",
    profiles: storyProfiles,
    postNumber: () => 1,
    signedInPubkey: storyPosts[0].event.pubkey,
    comment: "A retained minimized draft.",
    variant: "docked",
    presentation: "minimized",
    height: 320,
    onCancel: noop,
    onSubmit: noop,
  }}
/>

<Story
  name="Docked fullscreen"
  parameters={{ layout: "fullscreen" }}
  args={{
    name: "AI",
    profiles: storyProfiles,
    postNumber: () => 1,
    signedInPubkey: storyPosts[0].event.pubkey,
    comment: "A full-pane discussion draft.",
    variant: "docked",
    presentation: "fullscreen",
    height: 320,
    onCancel: noop,
    onSubmit: noop,
  }}
/>
