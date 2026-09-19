<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import type { ProjectForgeRepository } from "../../projects/index.js";
  import CommunityProjectsProjectRepositoriesRail from "./CommunityProjectsProjectRepositoriesRail.svelte";

  const notes = {
    address: {
      kind: 30_617,
      owner: "1".repeat(64),
      identifier: "notes",
      coordinate: "30617:owner:notes",
    },
    name: "notes-desktop",
    channelId: "plugin-development",
    repositoryClass: "hosted",
  } as ProjectForgeRepository;
  const probe = {
    address: {
      kind: 30_617,
      owner: "1".repeat(64),
      identifier: "probe",
      coordinate: "30617:owner:probe",
    },
    name: "jj-nostr-probe",
    channelId: "plugin-development",
    repositoryClass: "hosted",
  } as ProjectForgeRepository;

  const { Story } = defineMeta({
    title: "Community/Projects/Project repositories rail",
    component: CommunityProjectsProjectRepositoriesRail,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Project repositories rail"
  args={{
    repositories: [notes, probe],
    selectedCoordinate: probe.address.coordinate,
    channelName: (repository: ProjectForgeRepository) =>
      repository.channelId.replace(/^#/, ""),
    onSelectRepository: fn(),
    onSelectChannel: fn(),
  }}
  play={async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByText("Repositories")).toBeVisible();
    const selected = canvas.getByRole("button", { name: "jj-nostr-probe" });
    await expect(selected.querySelector(".lucide-folder-git-2")).not.toBeNull();
    await expect(selected).toHaveAttribute("aria-current", "page");
    const row = selected.closest(
      ".community-projects-project-repositories-rail__row",
    );
    await expect(row).toHaveAttribute("data-active", "");
    await expect(getComputedStyle(row!).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(selected.getBoundingClientRect().width).toBeGreaterThan(96);
    const toggle = canvas.getByRole("button", {
      name: "Collapse jj-nostr-probe",
    });
    await expect(
      toggle.querySelector("svg")?.getBoundingClientRect().width,
    ).toBeLessThanOrEqual(14);
    const channel = canvas.getAllByRole("button", {
      name: "plugin-development",
    })[0]!;
    await expect(
      channel.querySelector('[data-ui-part="project-channel-icon"]'),
    ).not.toBeNull();
    await expect(Number.parseFloat(getComputedStyle(channel).fontSize)).toBeLessThan(
      Number.parseFloat(getComputedStyle(selected).fontSize),
    );
    await expect(channel.getBoundingClientRect().left).toBeGreaterThan(
      selected.getBoundingClientRect().left + 12,
    );
    await userEvent.click(canvas.getByRole("button", { name: "notes-desktop" }));
    await expect(args.onSelectRepository).toHaveBeenCalled();
    await userEvent.click(
      canvas.getAllByRole("button", { name: "plugin-development" })[0]!,
    );
    await expect(args.onSelectChannel).toHaveBeenCalled();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsProjectRepositoriesRail {...args} />
  {/snippet}
</Story>
