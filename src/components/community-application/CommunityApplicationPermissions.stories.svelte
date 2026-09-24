<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import { toast } from "svelte-sonner";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import Harness from "./CommunityAgentsApplicationStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Application permissions",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: '<CommunityApplication {controller} initialDestination="agents" />',
        },
      },
    },
    beforeEach: async () => {
      const dismiss = async () => {
        toast.dismiss();
        await waitFor(() =>
          expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(
            0,
          ),
        );
      };
      await dismiss();
      return dismiss;
    },
  });
  const notice = "Research is waiting for your permission";
</script>

<Story
  name="Notify with Activity closed and open the exact thread"
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Request permission", exact: true }),
      ).toBeEnabled(),
    );
    await expect(page.queryByText(notice)).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Request permission", exact: true }),
    );
    await waitFor(() => expect(page.getByText(notice)).toBeVisible());
    await userEvent.click(page.getByRole("button", { name: "Review request" }));
    await expect(
      canvas.findByText("Write the requested file", { exact: true }),
    ).resolves.toBeVisible();
    await waitFor(() => {
      const hash = canvasElement.ownerDocument.defaultView!.location.hash;
      expect(hash).toContain("activity=1");
      expect(hash).toContain("permission-root");
      expect(hash).toContain("story");
    });
    await userEvent.click(
      canvas.getByRole("button", { name: "Request permission", exact: true }),
    );
    await expect(
      canvas.findByText("Fixture frames sent: 2"),
    ).resolves.toBeVisible();
    await expect(page.queryByText(notice)).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness
      notifications
      showControls={false}
    />{/snippet}</Story
>

<Story
  name="Dismiss on settlement and do not notify again after remount"
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Request permission", exact: true }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Request permission", exact: true }),
    );
    await waitFor(() => expect(page.getByText(notice)).toBeVisible());
    await userEvent.click(
      canvas.getByRole("button", { name: "Remount application" }),
    );
    await expect(
      canvas.findByRole("button", { name: "View Research" }),
    ).resolves.toBeVisible();
    await waitFor(() =>
      expect(page.queryByText(notice)).not.toBeInTheDocument(),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Request permission", exact: true }),
    );
    await expect(
      canvas.findByText("Fixture frames sent: 2"),
    ).resolves.toBeVisible();
    await expect(page.queryByText(notice)).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Resolve permission" }),
    );
  }}
  >{#snippet template()}<Harness
      notifications
      showControls={false}
    />{/snippet}</Story
>

<Story
  name="Resolved requests dismiss their toast"
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Request permission", exact: true }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Request permission", exact: true }),
    );
    await waitFor(() => expect(page.getByText(notice)).toBeVisible());
    await userEvent.click(
      canvas.getByRole("button", { name: "Resolve permission" }),
    );
    await waitFor(() =>
      expect(page.queryByText(notice)).not.toBeInTheDocument(),
    );
  }}
  >{#snippet template()}<Harness
      notifications
      showControls={false}
    />{/snippet}</Story
>

<Story
  name="Expired requests dismiss their toast"
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Request permission", exact: true }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Request expiring permission" }),
    );
    await waitFor(() => expect(page.getByText(notice)).toBeVisible());
    await waitFor(
      () => expect(page.queryByText(notice)).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
  }}
  >{#snippet template()}<Harness
      notifications
      showControls={false}
    />{/snippet}</Story
>

<Story
  name="Historical permission replay stays silent"
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.findByRole("button", { name: "View Research" }),
    ).resolves.toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Request permission", exact: true }),
    );
    await expect(
      canvas.findByText("Fixture frames sent: 1"),
    ).resolves.toBeVisible();
    await expect(page.queryByText(notice)).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness
      notifications
      replayPermission
      showControls={false}
    />{/snippet}</Story
>
