<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within, waitFor } from "storybook/test";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import Harness from "./CommunityAgentsApplicationStoryHarness.svelte";

  const { Story } = defineMeta({
    title: "Community/Agents/Mobile toolbar",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: { layout: "fullscreen", communityAppShell: true },
  });

  function activeMain(application: HTMLElement): HTMLElement {
    const main = application.querySelector<HTMLElement>(
      '[data-ui-part="mobile-main-lane"]:not([aria-hidden="true"]) .community-application__main[data-ui-part="main"]',
    );
    if (!main) throw new Error("Expected the active application main surface");
    return main;
  }

  function directToolbars(application: HTMLElement): HTMLElement[] {
    return Array.from(activeMain(application).children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.getAttribute("data-ui-part") === "toolbar",
    );
  }

  async function expectMobileShell(application: HTMLElement): Promise<void> {
    const shell = application.querySelector<HTMLElement>("[data-shell-root]");
    if (!shell) throw new Error("Expected the responsive App Shell root");
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-display-mode", "mobile");
      expect(shell).toHaveAttribute("data-mobile-stage", "main");
    });
  }
</script>

<Story
  name="Agents owns mobile toolbar"
  globals={{ viewport: { value: "tablet", isRotated: false } }}
  play={async ({ canvas }) => {
    const mobileShell = await canvas.findByRole("group", {
      name: "Mobile application shell",
    });
    const application = mobileShell.closest<HTMLElement>(
      '[data-ui-component="community-app-shell"]',
    );
    if (!application)
      throw new Error("Expected the Community application shell");
    await expectMobileShell(application);
    const toolbars = directToolbars(application);
    await waitFor(() =>
      expect(toolbars.map((item) => item.getAttribute("aria-label"))).toEqual([
        "Agents page header",
      ]),
    );
    const toolbar = within(toolbars[0]!);
    const buttons = toolbar.getAllByRole("button");
    await expect(buttons[0]).toHaveAccessibleName("Open navigation sidebar");
    await expect(buttons[1]).toHaveAccessibleName("Back");
    await expect(buttons[2]).toHaveAccessibleName("Forward");
    await expect(toolbars[0]!).toHaveTextContent("Agents");
    await expect(
      await toolbar.findByRole(
        "button",
        { name: "Refresh agents" },
        { timeout: 15_000 },
      ),
    ).toHaveAccessibleName("Refresh agents");
  }}
>
  {#snippet template()}<Harness showControls={false} />{/snippet}
</Story>
