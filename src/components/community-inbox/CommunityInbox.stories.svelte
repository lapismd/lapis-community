<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityInbox from "./CommunityInbox.svelte";
  import CommunityInboxStoryHarness from "./CommunityInboxStoryHarness.svelte";

  const consumerSource = `<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import {
    CommunityAppShell,
    CommunityInbox,
    type CommunityInboxModel,
  } from "@lapismd/lapis-community/components";

  let { inbox }: { inbox: CommunityInboxModel } = $props();
  // controller is the connected CommunityController that owns inbox.
  const shell = new AppShellController();
<\/script>

<CommunityAppShell controller={shell}>
  <AppShell.Main>
    <CommunityInbox
      model={inbox}
      onSelect={(id) => controller.actions.selectInboxItem?.(id)}
      onFilterChange={(filter, unreadOnly) => controller.actions.setInboxFilter?.(filter, unreadOnly)}
      onSend={(content) => controller.actions.sendInboxMessage?.(content)}
      onMarkAllRead={() => controller.actions.markAllRead()}
      onOpenChannelSettings={() => controller.actions.openDetails()}
    />
  </AppShell.Main>
</CommunityAppShell>`;

  const { Story } = defineMeta({
    title: "Community/Inbox/Inbox",
    component: CommunityInbox,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
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
  name="No messages"
  play={async ({ canvas }) => {
    const runtime = canvas.getByTestId("community-inbox-runtime");

    await waitFor(() => {
      expect(runtime).toHaveAttribute("data-community-status", "connected");
    });
    await expect(canvas.getByText("No activity yet")).toBeVisible();
    await expect(
      canvas.getByText("New activity will appear here."),
    ).toBeVisible();
    await expect(canvas.getByText("Select a message")).toBeVisible();
    await expect(
      canvas.getByText(
        "Pick an inbox item to see the full message and react to it.",
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("textbox", { name: "Markdown editor" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityInboxStoryHarness empty />
  {/snippet}
</Story>

<Story
  name="Partial history"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Updating older Inbox activity…"),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityInboxStoryHarness historyUpdating />
  {/snippet}
</Story>

<Story
  name="Selected thread"
  play={async ({ canvas, canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const runtime = canvas.getByTestId("community-inbox-runtime");

    await waitFor(() => {
      expect(runtime).toHaveAttribute("data-community-status", "connected");
    });
    if (runtime.dataset.communityBackend === "live") return;
    await waitFor(() => {
      expect(runtime).toHaveAttribute(
        "data-community-content-sync",
        "complete",
      );
    });

    await expect(canvas.getByLabelText("Inbox conversations")).toBeVisible();
    await expect(
      canvas.getByRole("region", { name: "Selected inbox thread" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /^support:/u }));
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "support" })).toBeVisible(),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
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
    await expect(
      overlay
        .getByRole("menu")
        .querySelector('[data-ui-part$="-separator"]:last-child'),
    ).toBeNull();
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
    await expect(canvas.getByText("No unread mentions")).toBeVisible();

    const composer = canvas.getByRole("textbox", {
      name: "Markdown editor",
    });
    await userEvent.type(composer, "An inbox interaction fixture");
    await expect(composer).toHaveTextContent("An inbox interaction fixture");
  }}
>
  {#snippet template()}
    <CommunityInboxStoryHarness />
  {/snippet}
</Story>

<Story
  name="Initial loading"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("status", { name: "Loading Inbox conversations" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("status", { name: "Loading Inbox messages" }),
    ).toBeVisible();
    await expect(canvas.queryByText("No activity yet")).not.toBeInTheDocument();
  }}
  >{#snippet template()}<CommunityInboxStoryHarness
      empty
      loading
    />{/snippet}</Story
>
