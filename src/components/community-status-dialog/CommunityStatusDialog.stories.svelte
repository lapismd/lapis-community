<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityStatusDialog from "./CommunityStatusDialog.svelte";

  const { Story } = defineMeta({
    title: "Community/Identity/Status Dialog",
    component: CommunityStatusDialog,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: '<CommunityStatusDialog bind:open value="🏠 Working remotely" onSave={(status) => updateStatus(status)} />',
        },
      },
    },
  });
</script>

<Story
  name="Working remotely"
  args={{
    open: true,
    value: "🏠 Working remotely",
    onSave: fn(),
  }}
  play={async ({ args, canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", { name: "Set a status" });
    await expect(
      within(dialog).getByText("Let others know what you're up to."),
    ).toBeVisible();
    await expect(
      within(dialog).getByLabelText("What's your status?"),
    ).toHaveValue("Working remotely");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "In a meeting" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await expect(args.onSave).toHaveBeenCalledWith("🗣️ In a meeting");
  }}
/>

<Story
  name="Persistent failure"
  args={{
    open: true,
    value: "🏠 Working remotely",
    error: "rate-limited: please wait before updating your status",
    retryable: true,
    onSave: fn(),
    onRetry: fn(),
    onDismissError: fn(),
  }}
/>

<Story
  name="Publishing"
  args={{
    open: true,
    value: "🏠 Working remotely",
    pending: true,
    onSave: fn(),
  }}
/>

<Story
  name="Accepted, still syncing"
  args={{
    open: true,
    value: "🗣️ In a meeting",
    operationMessage: "Accepted by relay, still syncing.",
    onSave: fn(),
  }}
/>
