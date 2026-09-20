<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import CommunityComposerMentionButton from "./CommunityComposerMentionButton.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Composer Mention Button",
    component: CommunityComposerMentionButton,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
    },
    args: {
      onclick: fn(),
      onDismiss: fn(),
    },
  });

  const fizz = {
    id: "a".repeat(64),
    name: "Fizz",
    handle: "fizz",
    initials: "FI",
    kind: "agent" as const,
  };
</script>

<Story name="Plain mention control" />

<Story
  name="Addressed agent lock"
  args={{ member: fizz }}
  play={async ({ canvas, args }) => {
    const mention = canvas.getByRole("button", { name: "Mention someone" });
    const lock = canvas.getByRole("button", {
      name: "Don't automatically mention Fizz in this thread",
    });
    const host = mention.closest(
      "[data-ui-component='community-composer-mention-button']",
    );
    await expect(host).toHaveAttribute("data-addressed", "true");
    const addressed = getComputedStyle(host!);
    await expect(addressed.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(parseFloat(addressed.borderRadius)).toBeGreaterThan(0);
    await expect(parseFloat(addressed.borderRadius)).toBeLessThan(
      host!.getBoundingClientRect().height / 2,
    );
    await expect(
      mention.querySelector("[data-ui-part='composer-mention-at']"),
    ).not.toBeNull();
    await expect(
      lock.querySelector("[data-ui-component='community-member-avatar']"),
    ).not.toBeNull();
    await expect(
      lock.querySelector("[data-ui-part='composer-mention-dismiss']"),
    ).not.toBeNull();
    await userEvent.hover(lock);
    await userEvent.click(lock);
    await expect(args.onDismiss).toHaveBeenCalledWith(fizz.id);
    await expect(args.onclick).not.toHaveBeenCalled();
  }}
/>
