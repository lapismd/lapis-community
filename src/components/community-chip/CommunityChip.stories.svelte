<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import { expect, fn, userEvent } from "storybook/test";

  import CommunityChip from "./CommunityChip.svelte";

  const { Story } = defineMeta({
    title: "Community/Primitives/Chip",
    component: CommunityChip,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityChip variant="outline">Desktop</CommunityChip>
<CommunityChip tone="success">Approved</CommunityChip>
<CommunityChip onclick={removeFilter} ariaLabel="Remove Desktop filter">
  {#snippet leading()}<XIcon aria-hidden="true" />{/snippet}
  Desktop
</CommunityChip>`,
        },
      },
    },
  });
</script>

<Story name="Variants">
  {#snippet template()}
    <div class="community-chip-story">
      <CommunityChip>Desktop</CommunityChip>
      <CommunityChip variant="muted">Private</CommunityChip>
      <CommunityChip variant="solid" tone="accent">Featured</CommunityChip>
      <CommunityChip tone="success">Approved</CommunityChip>
      <CommunityChip tone="warning">Pending</CommunityChip>
      <CommunityChip tone="danger">Rejected</CommunityChip>
      <CommunityChip size="compact" variant="muted">13</CommunityChip>
      <CommunityChip tone="success">
        {#snippet leading()}<CheckIcon aria-hidden="true" />{/snippet}
        Verified
      </CommunityChip>
    </div>
  {/snippet}
</Story>

<Story
  name="Interactive"
  args={{ onclick: fn() }}
  play={async ({ canvas, args }) => {
    const chip = canvas.getByRole("button", { name: "Remove Desktop filter" });
    await expect(chip).toHaveAttribute("data-ui-part", "community-chip");
    await expect(chip).toHaveAttribute("data-ui-component", "button");
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    chip.focus();
    await expect(chip).toHaveFocus();
    await userEvent.click(chip);
    await expect(args.onclick).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <CommunityChip
      onclick={args.onclick}
      pressed
      ariaLabel="Remove Desktop filter"
    >
      Desktop
      <XIcon data-icon="inline-end" aria-hidden="true" />
    </CommunityChip>
  {/snippet}
</Story>

<Story
  name="Links"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Desktop" })).toHaveAttribute(
      "href",
      "#/registry/plugins",
    );
    const disabled = canvas.getByRole("link", { name: "Web unavailable" });
    await expect(disabled).toHaveAttribute("aria-disabled", "true");
    await expect(disabled).toHaveAttribute("tabindex", "-1");
  }}
>
  {#snippet template()}
    <div class="community-chip-story">
      <CommunityChip href="#/registry/plugins">Desktop</CommunityChip>
      <CommunityChip
        href="#/registry/plugins"
        disabled
        ariaLabel="Web unavailable">Web</CommunityChip
      >
    </div>
  {/snippet}
</Story>

<style>
  .community-chip-story {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
  }
</style>
