<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityNavigationShellFixture from "../community-navigation/CommunityNavigationShellFixture.svelte";

  const { Story } = defineMeta({
    title: "Shell/App Shell",
    component: CommunityNavigationShellFixture,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        description: {
          component:
            "A Community composition of the public Design Core App Shell: the completed navigation sidebar beside an Inbox body split into independently scrolling list and thread regions.",
        },
      },
    },
  });
</script>

<Story
  name="Two expanded sidebars"
  play={async ({ canvas, canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const storybookRoot =
      document.querySelector<HTMLElement>("#storybook-root");
    const leftSidebar = canvas.getByLabelText("Left sidebar");
    const mainBody = canvas.getByRole("main", { name: "Inbox workspace" });
    const shellRoot = leftSidebar.closest<HTMLElement>("[data-shell-root]");
    const inboxList = canvas.getByLabelText("Inbox conversations");
    const thread = canvas.getByRole("region", {
      name: "Selected inbox thread",
    });
    const inboxOptions = canvas.getByRole("button", {
      name: "Inbox options",
    });

    await expect(leftSidebar).toHaveAttribute("data-state", "expanded");
    await expect(canvas.queryByLabelText("Right sidebar")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: /right sidebar/i }),
    ).toBeNull();
    await expect(
      canvas.getByRole("searchbox", { name: "Search community" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "plugin-releases" }),
    ).toBeVisible();
    await expect(within(inboxList).getByText("Fizz")).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "Thread in #Welcome" }),
    ).toBeVisible();
    await expect(inboxList).toBeVisible();
    await expect(thread).toBeVisible();
    await expect(
      canvas.getByRole("combobox", { name: "Message" }),
    ).toBeVisible();
    await expect(mainBody).toHaveStyle("overflow: hidden");
    await expect(mainBody).toHaveAttribute("data-layout", "regions");
    await expect(mainBody.scrollHeight).toBe(mainBody.clientHeight);

    await userEvent.click(canvas.getByRole("button", { name: "All" }));
    const overlay = within(document.body);
    await expect(
      overlay.getByRole("menuitemradio", { name: "All" }),
    ).toHaveAttribute("data-state", "checked");
    await expect(
      overlay.getByRole("menuitemradio", { name: "Mentions" }),
    ).toHaveAttribute("data-state", "unchecked");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(getComputedStyle(inboxOptions).pointerEvents).not.toBe("none");
    });

    await userEvent.click(inboxOptions);
    await expect(
      overlay.getByRole("menuitemcheckbox", { name: "Show unread only" }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("menuitem", { name: "Mark all as read" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    const manageChannel = canvas.getByRole("button", {
      name: "Manage channel",
    });
    await waitFor(() => {
      expect(getComputedStyle(manageChannel).pointerEvents).not.toBe("none");
    });

    await userEvent.click(manageChannel);
    await expect(canvas.getByLabelText("Channel settings")).toBeVisible();
    await expect(canvas.getByText("Channel Settings")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close channel settings" }),
    );
    await expect(canvas.queryByLabelText("Channel settings")).toBeNull();
    await expect(shellRoot).toBeInTheDocument();
    if (storybookRoot) {
      await expect(getComputedStyle(storybookRoot).padding).toBe("0px");
    }
    await expect(document.body.scrollHeight).toBe(document.body.clientHeight);
  }}
/>
