<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CheckIcon from "@lucide/svelte/icons/check";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
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

<Story
  name="Variants"
  play={async ({ canvas }) => {
    const count = canvas.getByText("13");
    await expect(count).toHaveAttribute("data-chip-variant", "subtle");
    await expect(getComputedStyle(count).borderWidth).toBe("0px");
    await expect(getComputedStyle(count).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    const sync = canvas.getByText("jj-sync");
    await expect(sync).toHaveAttribute("data-chip-shape", "square");
    await expect(sync).toHaveAttribute("data-chip-variant", "muted");
    await expect(
      Number.parseFloat(getComputedStyle(sync).borderRadius),
    ).toBeLessThan(
      Number.parseFloat(
        getComputedStyle(canvas.getByText("Private")).borderRadius,
      ),
    );
    await expect(sync.querySelector(".lucide-refresh-cw")).not.toBeNull();
  }}
>
  {#snippet template()}
    <div class="community-chip-story">
      <CommunityChip>Desktop</CommunityChip>
      <CommunityChip variant="muted">Private</CommunityChip>
      <CommunityChip variant="solid" tone="accent">Featured</CommunityChip>
      <CommunityChip tone="success">Approved</CommunityChip>
      <CommunityChip tone="warning">Pending</CommunityChip>
      <CommunityChip tone="danger">Rejected</CommunityChip>
      <CommunityChip size="indicator" tone="accent">3</CommunityChip>
      <CommunityChip size="compact" variant="subtle">13</CommunityChip>
      <CommunityChip tone="success">
        {#snippet leading()}<CheckIcon aria-hidden="true" />{/snippet}
        Verified
      </CommunityChip>
      <CommunityChip variant="muted" shape="square" size="compact">
        {#snippet leading()}<RefreshCwIcon aria-hidden="true" />{/snippet}
        jj-sync
      </CommunityChip>
    </div>
    <p class="community-chip-story__inline">
      Ask <CommunityChip variant="muted" size="inline">@Ben Stone</CommunityChip
      >
      to review this message.
    </p>
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

  .community-chip-story__inline {
    padding-inline: 1rem;
  }
</style>
