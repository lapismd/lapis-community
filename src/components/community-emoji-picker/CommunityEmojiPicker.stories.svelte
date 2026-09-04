<script module lang="ts">
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunityEmojiPicker from "./CommunityEmojiPicker.svelte";

  const { Story } = defineMeta({
    title: "Community/Emoji/Picker",
    component: CommunityEmojiPicker,
    tags: ["visual-pending"],
    parameters: { layout: "centered" },
  });
</script>

<Story
  name="Community and standard emoji"
  args={{
    label: "Add reaction",
    presets: ["👍", "❤️", "🎉", "👀", "⭐"],
    communityEmojis: [
      {
        shortcode: "lapis",
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%234f46e5'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='15' fill='white'%3EL%3C/text%3E%3C/svg%3E",
        ownerPubkey: "story",
        owned: true,
      },
    ],
    onSelect: fn(),
  }}
  play={async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add reaction" }));
    await expect(
      within(document.body).getByRole("heading", { name: "Emoji" }),
    ).toBeVisible();
    await userEvent.click(
      within(document.body).getByRole("button", { name: "React 👍" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("👍");
  }}
/>

<Story
  name="Full picker hover and selection"
  args={{ label: "Choose reaction", onSelect: fn() }}
  play={async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Choose reaction" }),
    );
    const picker = await waitFor(() => {
      const element =
        document.body.querySelector<HTMLElement>("em-emoji-picker");
      expect(element?.shadowRoot).not.toBeNull();
      return element!;
    });
    const emoji = await waitFor(() => {
      const button = picker.shadowRoot?.querySelector<HTMLButtonElement>(
        'button[aria-label="🤣"]',
      );
      expect(button).not.toBeNull();
      return button!;
    });
    await userEvent.hover(emoji);
    await waitFor(() => {
      const background = emoji.querySelector<HTMLElement>(".background")!;
      expect(getComputedStyle(background).backgroundColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });
    await userEvent.click(emoji);
    await expect(args.onSelect).toHaveBeenCalledWith("🤣");
  }}
/>
