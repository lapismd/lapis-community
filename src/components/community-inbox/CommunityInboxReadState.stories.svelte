<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityInbox from "./CommunityInbox.svelte";
  import CommunityInboxReadStateHarness from "./CommunityInboxReadStateHarness.svelte";

  const { Story } = defineMeta({
    title: "Community/Inbox/Read state",
    component: CommunityInbox,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          code: `<script lang="ts">
  import { CommunityInbox } from "@lapismd/lapis-community/components";
<\/script>
<CommunityInbox model={inbox} onSelect={selectConversation} onFilterChange={setInboxFilter} onSend={send} onMarkAllRead={markAllRead} onOpenChannelSettings={openSettings} />`,
        },
      },
    },
  });
</script>

<Story
  name="Unread only retains selection until navigation"
  play={async ({ canvas, canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.getByRole("button", { name: /^Older thread:/ }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Inbox options" }),
    );
    await userEvent.click(
      overlay.getByRole("menuitemcheckbox", { name: "Show unread only" }),
    );
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.queryByRole("button", { name: /^Older thread:/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /^First thread:/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const second = canvas.getByRole("button", { name: /^Second thread:/ });
    await waitFor(() =>
      expect(getComputedStyle(second).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(second);
    await waitFor(() => expect(second).not.toHaveAttribute("data-unread"));
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(
      canvas.queryByRole("button", { name: /^First thread:/ }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByText("Second conversation content")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Receive a new First reply" }),
    );
    await expect(
      canvas.getByRole("button", { name: /^First thread:/ }),
    ).toHaveAttribute("data-unread");
    await expect(second).toHaveAttribute("aria-pressed", "true");
  }}
>
  {#snippet template()}<CommunityInboxReadStateHarness />{/snippet}
</Story>

<Story
  name="All keeps read history"
  play={async ({ canvas, canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Inbox options" }),
    );
    await expect(
      overlay.getByRole("menuitemcheckbox", { name: "Show unread only" }),
    ).toHaveAttribute("aria-checked", "false");
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "Mark all as read" }),
    );
    await userEvent.keyboard("{Escape}");
    for (const name of ["First", "Second", "Older"]) {
      const row = canvas.getByRole("button", {
        name: new RegExp(`^${name} thread:`),
      });
      await expect(row).toBeVisible();
      await expect(row).not.toHaveAttribute("data-unread");
    }
  }}
>
  {#snippet template()}<CommunityInboxReadStateHarness />{/snippet}
</Story>
