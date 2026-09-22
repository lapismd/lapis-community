<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import CommunityComposerSlashStoryHost from "./CommunityComposerSlashStoryHost.svelte";
  import { composerSlashStoryLongTaskTitle } from "./composer-slash-story-catalog.js";
  import {
    communityComposerStoryEmojis,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";

  const onSubmit = fn();

  const { Story } = defineMeta({
    title: "Community/Channels/Chat Composer Entity Links",
    component: CommunityComposerSlashStoryHost,
    tags: ["visual-pending"],
    parameters: { layout: "padded" },
  });
</script>

<Story
  name="Slash kind inserts a scheme chip"
  args={{
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    onSubmit,
  }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "/tasks/awesome");
    const option = await canvas.findByRole("option", { name: /Awesome/i });
    await userEvent.click(option);
    const chip = await waitFor(() => {
      const found = canvasElement.querySelector("[data-link-kind='task']");
      expect(found).not.toBeNull();
      return found!;
    });
    await expect(chip).toHaveTextContent("Awesome");
    await expect(chip).toHaveAttribute("title", "Awesome");
    await expect(editor).not.toHaveTextContent("/tasks/awesome");
  }}
/>

<Story
  name="Dismiss removes a scheme chip"
  args={{
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    onSubmit,
  }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "/tasks/awesome");
    const option = await canvas.findByRole("option", { name: /Awesome/i });
    await userEvent.click(option);
    const chip = await waitFor(() => {
      const found = canvasElement.querySelector("[data-link-kind='task']");
      expect(found).not.toBeNull();
      return found!;
    });
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Awesome" }),
    );
    await waitFor(() => {
      expect(canvasElement.querySelector("[data-link-kind='task']")).toBeNull();
      expect(
        canvasElement.querySelector("[data-ui-part='composer-chip-dismiss']"),
      ).toBeNull();
    });
    await expect(chip.isConnected).toBe(false);
    await expect(editor).not.toHaveTextContent("lapis-community://");
    await expect(editor).not.toHaveTextContent("/tasks/awesome");
  }}
/>

<Story
  name="Dismiss removes a mention chip"
  args={{
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    value: "Ask @Ben Stone to review.",
    onSubmit,
  }}
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("button", { name: "Ben Stone" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Ben Stone" }),
    );
    await waitFor(() => {
      expect(canvas.queryByRole("button", { name: "Ben Stone" })).toBeNull();
      expect(
        canvasElement.querySelector("[data-ui-part='composer-chip-dismiss']"),
      ).toBeNull();
    });
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await expect(editor).toHaveTextContent("Ask to review.");
    await expect(editor).not.toHaveTextContent("@Ben Stone");
  }}
/>

<Story
  name="Long entity chip title ellipsizes"
  args={{
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    onSubmit,
  }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "/tasks/milestone");
    const option = await canvas.findByRole("option", {
      name: /milestone/i,
    });
    await userEvent.click(option);
    const chip = await waitFor(() => {
      const found = canvasElement.querySelector("[data-link-kind='task']");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    await expect(chip).toHaveAttribute(
      "title",
      composerSlashStoryLongTaskTitle,
    );
    const token = chip.closest("[data-ui-part='composer-removable-token']");
    expect(token).not.toBeNull();
    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    expect(token!.getBoundingClientRect().width).toBeLessThanOrEqual(
      16 * rem + 1,
    );
    const label = chip.querySelector(".community-entity-label");
    expect(label).not.toBeNull();
    await expect(getComputedStyle(label!).textOverflow).toBe("ellipsis");
    expect(label!.scrollWidth).toBeGreaterThan(label!.clientWidth);
  }}
/>
