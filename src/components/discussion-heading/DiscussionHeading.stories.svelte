<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import DiscussionHeading from "./DiscussionHeading.svelte";

  const { Story } = defineMeta({
    title: "Community/Discussion/Heading",
    component: DiscussionHeading,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Paginated discussion"
  args={{
    total: 184,
    displayedStart: 41,
    displayedEnd: 60,
    onRefresh: fn(),
  }}
  play={async ({ args, canvas }) => {
    await expect(canvas.getByText("Loaded posts 41–60 of 184.")).toBeVisible();
    const refresh = canvas.getByRole("button", { name: "Refresh discussion" });
    await userEvent.hover(refresh);
    await expect(
      within(document.body).getByText("Refresh discussion", {
        selector: '[data-ui-part="tooltip-content"] p',
      }),
    ).toBeVisible();
    await userEvent.click(refresh);
    await expect(args.onRefresh).toHaveBeenCalledOnce();
  }}
/>
