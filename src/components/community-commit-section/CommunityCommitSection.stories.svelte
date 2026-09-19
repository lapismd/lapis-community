<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";
  import CommunityCommitSection from "./CommunityCommitSection.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Commit Section",
    component: CommunityCommitSection,
    tags: ["visual-pending"],
    args: { title: "Files changed", open: true },
    parameters: {
      docs: {
        source: {
          code: '<CommunityCommitSection title="Files changed" bind:open>Commit diff</CommunityCommitSection>',
        },
      },
    },
  });
</script>

<Story
  name="Keyboard disclosure"
  play={async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Files changed" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText("Commit diff")).toBeVisible();
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(canvas.getByText("Commit diff")).not.toBeVisible(),
    );
    await userEvent.keyboard(" ");
    await expect(canvas.getByText("Commit diff")).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityCommitSection {...args}>Commit diff</CommunityCommitSection>
  {/snippet}
</Story>
