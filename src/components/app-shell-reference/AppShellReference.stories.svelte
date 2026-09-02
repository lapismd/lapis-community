<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
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
            "The canonical Design Core App Shell reference with only its bounded left-sidebar content replaced by Lapis Community navigation.",
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
    const mainBody = canvas.getByRole("main", { name: "Workspace content" });
    const shellRoot = leftSidebar.closest<HTMLElement>("[data-shell-root]");
    const bodyViewport = mainBody.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    );

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
    await expect(canvas.getByText("Application workspace")).toBeVisible();
    await expect(mainBody).toHaveStyle("overflow: hidden");
    await expect(bodyViewport).toBeInTheDocument();
    await expect(bodyViewport!.scrollHeight).toBeGreaterThan(
      bodyViewport!.clientHeight,
    );
    await expect(mainBody.scrollHeight).toBe(mainBody.clientHeight);
    await expect(shellRoot).toBeInTheDocument();
    if (storybookRoot) {
      await expect(getComputedStyle(storybookRoot).padding).toBe("0px");
    }
    await expect(document.body.scrollHeight).toBe(document.body.clientHeight);
  }}
/>
