<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import type { RegistryDirectoryState } from "../../registry/index.js";
  import { registryStoryEntries } from "../registry-browser/story-fixtures.js";
  import RegistryDirectory from "./RegistryDirectory.svelte";
  import RegistryDirectoryStoryHarness from "./RegistryDirectoryStoryHarness.svelte";

  const initialState: RegistryDirectoryState = {
    query: "",
    categories: [],
    platforms: [],
    statuses: [],
    officialOnly: false,
    sort: "name",
    view: "grid",
  };

  const { Story } = defineMeta({
    title: "Community/Registry/Directory",
    component: RegistryDirectory,
    tags: ["visual-pending"],
    args: {
      plugins: registryStoryEntries,
      state: initialState,
      onOpenPlugin: fn(),
    },
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryDirectory {plugins} bind:state={directoryState} onOpenPlugin={openPlugin} />`,
        },
      },
    },
  });
</script>

<Story
  name="Search, filters, sorting, and views"
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByRole("heading", { name: "Plugins", level: 1 }),
    ).not.toBeInTheDocument();
    const search = canvas.getByRole("textbox", {
      name: "Search registry plugins",
    });
    await userEvent.type(search, "graph");
    await expect(canvas.getByText("1 results")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Open Graph View" }),
    ).toBeVisible();

    await userEvent.clear(search);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Available 5$/u }),
    );
    await expect(
      canvas
        .getByRole("button", { name: /^Available 5$/u })
        .querySelector('[data-filter-icon="check"]'),
    ).not.toBeNull();
    await expect(canvas.getByText("5 results")).toBeVisible();
    const activeButtons = canvas.getAllByRole("button", { name: /Available/u });
    await userEvent.click(activeButtons.at(-1)!);
    await expect(canvas.getByText("8 results")).toBeVisible();

    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Sort plugins" }),
      "updated",
    );
    await userEvent.click(canvas.getByRole("button", { name: "List" }));
    await expect(canvas.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const resizeHandle = canvas.getByRole("button", {
      name: "Resize plugin filters panel",
    });
    const widthBeforeResize = Number(
      resizeHandle.getAttribute("data-current-width"),
    );
    resizeHandle.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(Number(resizeHandle.getAttribute("data-current-width"))).toBe(
      widthBeforeResize + 16,
    );

    const filters = canvas.getByRole("complementary", {
      name: "Plugin filters",
    });
    const resultsRegion = canvas.getByRole("region", {
      name: "Plugin directory results",
    });
    const filterViewport = filters.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    )!;
    const resultViewport = resultsRegion.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    )!;
    filterViewport.scrollTop = 24;
    resultViewport.scrollTop = 64;
    await expect(filterViewport.scrollTop).toBe(24);
    await expect(resultViewport.scrollTop).toBe(64);

    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse Category filters" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand Category filters" }),
    ).toHaveAttribute("aria-expanded", "false");
  }}
>
  {#snippet template(args)}
    <RegistryDirectoryStoryHarness {...args} />
  {/snippet}
</Story>

<Story
  name="Empty results"
  args={{
    state: { ...initialState, query: "no matching extension" },
  }}
>
  {#snippet template(args)}
    <RegistryDirectoryStoryHarness {...args} />
  {/snippet}
</Story>

<Story
  name="Dark compact directory"
  args={{ state: { ...initialState, view: "list" } }}
  parameters={{ viewport: { defaultViewport: "mobile1" } }}
>
  {#snippet template(args)}
    <RegistryDirectoryStoryHarness {...args} dark />
  {/snippet}
</Story>
