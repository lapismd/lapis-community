<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, waitFor, within } from "storybook/test";

  async function waitForPointerTarget(
    element: Element,
    overlay: ReturnType<typeof within>,
  ): Promise<void> {
    await waitFor(() => {
      expect(overlay.queryByRole("menu")).not.toBeInTheDocument();
      expect(getComputedStyle(element).pointerEvents).not.toBe("none");
    });
  }

  import CommunityProjectsRepositorySettings from "./CommunityProjectsRepositorySettings.svelte";

  const hostedProtection = {
    merge: true,
    protection: {
      default_branch: "main",
      protected_ref: "refs/heads/main",
      protected_patterns: ["refs/heads/release/*"],
      document_patterns: ["refs/heads/release/*"],
      required_approvals: 2,
      admin_bypass: false,
      pull_requests_required: true,
      merge_actors: "channel_maintainers",
    },
  };

  const { Story } = defineMeta({
    title: "Community/Projects/Repository settings",
    component: CommunityProjectsRepositorySettings,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Hosted branch protection"
  args={{
    capabilities: hostedProtection,
    owners: {
      rules: [{ path: "docs/", pubkeys: ["a".repeat(64)] }],
    },
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Rulesets")).toBeVisible();
    await expect(
      canvas.getByRole("list", { name: "Repository rulesets" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Default.*2 branch rules/u }),
    ).toBeVisible();
    await expect(canvas.getByText(/docs\//u)).toBeVisible();
    await expect(
      canvas.queryByText(
        /lives at the repository root|additive Active rule|Pull requests required|Who can merge/u,
      ),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>

<Story
  name="GitHub authoritative protection"
  args={{
    capabilities: {
      merge: true,
      protection: { github_authoritative: true, merge_actors: "github" },
    },
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText(/stay on GitHub/u)).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>

<Story
  name="Saves hosted branch protection"
  args={{
    canMaintain: true,
    capabilities: hostedProtection,
    members: [
      { id: "a".repeat(64), name: "Ada", handle: "ada", initials: "A" },
    ],
    onSaveProtection: fn(),
  }}
  play={async ({ args, canvas, canvasElement, userEvent }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: /2 branch rules/u }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Add target" }));
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "Include by pattern" }),
    );
    const includePattern = canvas.getByLabelText("Include pattern");
    await waitForPointerTarget(includePattern, overlay);
    await userEvent.type(includePattern, "hotfix/*");
    await userEvent.click(canvas.getByRole("button", { name: "Add pattern" }));
    await userEvent.click(canvas.getByLabelText("Restrict creations"));
    await userEvent.click(canvas.getByRole("button", { name: "Add bypass" }));
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "Channel creator / relay admin" }),
    );
    await expect(
      canvas.getByText("Channel creator / relay admin"),
    ).toBeVisible();
    const save = canvas.getByRole("button", { name: "Save ruleset" });
    await waitForPointerTarget(save, overlay);
    await userEvent.click(save);
    await expect(args.onSaveProtection).toHaveBeenCalledWith({
      version: 1,
      rules: [
        expect.objectContaining({
          id: "default",
          name: "Default",
          restrict_creations: true,
          restrict_updates: true,
          restrict_deletions: true,
          targets: expect.arrayContaining([
            { type: "default" },
            { type: "include", pattern: "refs/heads/release/*" },
            { type: "include", pattern: "refs/heads/hotfix/*" },
          ]),
          bypass: [{ kind: "admin" }],
        }),
      ],
    });
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>

<Story
  name="Creates named ruleset"
  args={{
    canMaintain: true,
    capabilities: {
      merge: true,
      protection: {
        default_branch: "main",
        protected_ref: "refs/heads/main",
        rules: [],
        pull_requests_required: true,
        merge_actors: "channel_maintainers",
      },
    },
    onSaveProtection: fn(),
  }}
  play={async ({ args, canvas, canvasElement, userEvent }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "New ruleset" }));
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "New branch ruleset" }),
    );
    const name = canvas.getByLabelText("Ruleset name");
    await waitForPointerTarget(name, overlay);
    await userEvent.clear(name);
    await userEvent.type(canvas.getByLabelText("Ruleset name"), "Keep history");
    await userEvent.click(canvas.getByLabelText("Restrict deletions"));
    await userEvent.click(canvas.getByRole("button", { name: "Save ruleset" }));
    await expect(args.onSaveProtection).toHaveBeenCalledWith({
      version: 1,
      rules: [
        expect.objectContaining({
          name: "Keep history",
          restrict_deletions: true,
          restrict_updates: false,
          targets: [{ type: "default" }],
        }),
      ],
    });
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>

<Story
  name="Opens channel People"
  args={{
    capabilities: hostedProtection,
    peopleChannelName: "dev",
    onOpenPeople: fn(),
  }}
  play={async ({ args, canvas, userEvent }) => {
    const people = canvas.getByRole("button", { name: "Add people to #dev" });
    await expect(people.querySelector(".lucide-user-plus")).not.toBeNull();
    await userEvent.click(people);
    await expect(args.onOpenPeople).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>
