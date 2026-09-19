<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import type { ProjectForgeRepository } from "../../projects/index.js";
  import CommunityProjectsRepositorySections from "./CommunityProjectsRepositorySections.svelte";

  const notes = {
    address: {
      kind: 30_617,
      owner: "1".repeat(64),
      identifier: "notes",
      coordinate: "30617:owner:notes",
    },
    name: "notes-desktop",
    repositoryClass: "hosted",
  } as ProjectForgeRepository;

  const { Story } = defineMeta({
    title: "Community/Projects/Repository sections",
    component: CommunityProjectsRepositorySections,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Project workspace tabs"
  args={{
    sections: [{ repository: notes, count: 2 }],
    empty: "No repository commit history is available.",
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText("notes-desktop")).toBeVisible();
    await expect(canvas.getByText("Grouped row")).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySections {...args}>
      {#snippet children()}
        <p>Grouped row</p>
      {/snippet}
    </CommunityProjectsRepositorySections>
  {/snippet}
</Story>
