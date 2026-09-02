<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityInbox from "./CommunityInbox.svelte";
  import CommunityInboxStoryHarness from "./CommunityInboxStoryHarness.svelte";

  const consumerSource = `<script lang="ts">
  import { AppShell } from "@lapismd/design-core/shell";
  import { CommunityInbox, type CommunityInboxModel } from "@lapismd/lapis-community/components";

  let { inbox }: { inbox: CommunityInboxModel } = $props();
<\/script>

<AppShell.Root>
  <AppShell.Main>
    <CommunityInbox model={inbox} />
  </AppShell.Main>
</AppShell.Root>`;

  const { Story } = defineMeta({
    title: "Community/Inbox/Inbox",
    component: CommunityInbox,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "An Inbox view composed from Design Core App Shell body regions, with an independently scrolling item list and selected thread.",
        },
      },
    },
  });
</script>

<Story
  name="Selected thread"
  play={async ({ canvas, canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const runtime = canvas.getByTestId("community-inbox-runtime");

    await waitFor(() => {
      expect(runtime).toHaveAttribute("data-community-status", "connected");
    });

    await expect(canvas.getByLabelText("Inbox conversations")).toBeVisible();
    await expect(
      canvas.getByRole("region", { name: "Selected inbox thread" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "general" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("combobox", { name: "Message" }),
    ).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "All" }));
    await userEvent.click(
      overlay.getByRole("menuitemradio", { name: "Mentions" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Mentions" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    const inboxOptions = canvas.getByRole("button", {
      name: "Inbox options",
    });
    await waitFor(() => {
      expect(getComputedStyle(inboxOptions).pointerEvents).not.toBe("none");
    });

    await userEvent.click(inboxOptions);
    await userEvent.click(
      overlay.getByRole("menuitemcheckbox", { name: "Show unread only" }),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(getComputedStyle(inboxOptions).pointerEvents).not.toBe("none");
    });
    await userEvent.click(inboxOptions);
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "Mark all as read" }),
    );
    await expect(canvas.getByText("You're all caught up")).toBeVisible();

    const composer = canvas.getByRole("combobox", { name: "Message" });
    await userEvent.type(composer, "An inbox interaction fixture");
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByText("An inbox interaction fixture"),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityInboxStoryHarness />
  {/snippet}
</Story>
