<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import ChipExample from "./examples/ChipExample.svelte";
  import source from "./examples/ChipExample.svelte?raw";

  const { Story } = defineMeta({
    title: "Community/Patterns/Chip",
    component: CommunityChip,
    tags: ["visual-pending"],
    parameters: { docs: { source: { language: "svelte", code: source } } },
  });
</script>

<Story
  name="Contract"
  play={async ({ canvas }) => {
    const count = canvas.getByLabelText("12 unread");
    await expect(count).toBeVisible();
    await expect(count).toHaveTextContent("12");
    await expect(getComputedStyle(count).borderWidth).toBe("0px");
    await expect(getComputedStyle(count).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
  }}
>
  {#snippet template()}
    <ChipExample />
  {/snippet}
</Story>
