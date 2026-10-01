<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  const original =
    "Original message with enough text to extend beyond the available width. "
      .repeat(8)
      .trim();
  const { Story } = defineMeta({
    title: "Community/Discussion/Composer edit context",
    component: CommunityChatComposer,
    tags: ["visual-pending"],
    args: {
      value: "Original message",
      mode: "form",
      showSubmitButton: true,
      ariaLabel: "Edit composer",
      onSubmit: fn(),
      onCancelContext: fn(),
    },
  });
</script>

<Story
  name="Original preview stays above the changing draft"
  args={{ context: { kind: "edit", id: "original", label: original } }}
  play={async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const preview = canvas.getByTitle(original);
    await expect(preview).toBeVisible();
    await expect(getComputedStyle(preview).textOverflow).toBe("ellipsis");
    await expect(getComputedStyle(preview).whiteSpace).toBe("nowrap");
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
      " changed draft",
    );
    await expect(preview).toHaveTextContent(original.trim());
    await userEvent.click(canvas.getByRole("button", { name: "Save message" }));
    await expect(args.onSubmit).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel edit" }));
    await expect(args.onCancelContext).toHaveBeenCalled();
  }}
>
  {#snippet template(args)}<div style="width: min(100%, 22rem)">
      <CommunityChatComposer {...args} />
    </div>{/snippet}
</Story>
<Story
  name="Editing context without a preview"
  args={{ context: { kind: "edit", id: "original" } }}
  play={async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("group", { name: "Editing message" }),
    ).toBeVisible();
  }}
/>
