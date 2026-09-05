<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import { registryStoryEntries } from "../registry-browser/story-fixtures.js";
  import RegistryLanding from "./RegistryLanding.svelte";

  const { Story } = defineMeta({
    title: "Community/Registry/Landing",
    component: RegistryLanding,
    tags: ["visual-pending"],
    args: {
      plugins: registryStoryEntries,
      onOpenDirectory: fn(),
      onOpenPlugin: fn(),
      onOpenCategory: fn(),
    },
    globals: { viewport: { value: "desktop", isRotated: false } },
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryLanding {plugins} onOpenDirectory={() => navigate({ page: "directory" })} onOpenPlugin={openPlugin} />`,
        },
      },
    },
  });
</script>

<Story
  name="Discovery lanes"
  play={async ({ args, canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Open AI Assistant" })[0]!,
    );
    await expect(args.onOpenPlugin).toHaveBeenCalledWith(
      registryStoryEntries[0],
    );
    await userEvent.click(
      canvas.getByRole("button", { name: /AI, 1 plugin/u }),
    );
    await expect(args.onOpenCategory).toHaveBeenCalledWith("ai");
    await userEvent.click(
      canvas.getAllByRole("button", { name: /Plugins/u })[0]!,
    );
    await expect(args.onOpenDirectory).toHaveBeenCalled();
  }}
/>
