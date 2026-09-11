<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityReportDialog from "./CommunityReportDialog.svelte";

  const { Story } = defineMeta({
    title: "Community/Messages/Report Dialog",
    component: CommunityReportDialog,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: "<CommunityReportDialog bind:open onSubmit={(report) => reportMessage(message.id, report)} />",
        },
      },
    },
  });
</script>

<Story
  name="Choose a reason"
  args={{ open: true, onSubmit: fn() }}
  play={async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", { name: "Report message" });
    const view = within(dialog);
    await userEvent.click(view.getByRole("radio", { name: "Spam" }));
    const editor = view
      .getByRole("group", { name: "Additional context" })
      .querySelector<HTMLElement>('.cm-content[contenteditable="true"]')!;
    await userEvent.click(editor);
    await userEvent.keyboard("Repeated links across several channels.");
    await userEvent.click(view.getByRole("button", { name: "Submit report" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      category: "spam",
      context: "Repeated links across several channels.",
    });
  }}
/>
