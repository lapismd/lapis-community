<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, waitFor, within } from "storybook/test";

  import CommunityProjectsRulesetList from "./CommunityProjectsRulesetList.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Ruleset list",
    component: CommunityProjectsRulesetList,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Named ruleset list"
  args={{
    canMaintain: true,
    onSave: fn(),
    onToggle: fn(),
    onDelete: fn(),
    members: [
      { id: "a".repeat(64), name: "Ada", handle: "ada", initials: "A" },
    ],
    rules: [
      {
        id: "default",
        name: "Default",
        enforcement: "active",
        targets: [{ type: "default" }],
        bypass: [],
        restrict_creations: false,
        restrict_updates: true,
        restrict_deletions: true,
        required_approvals: 1,
      },
      {
        id: "paused",
        name: "Paused",
        enforcement: "disabled",
        targets: [{ type: "default" }],
        bypass: [{ kind: "member", pubkey: "a".repeat(64) }],
        restrict_creations: false,
        restrict_updates: false,
        restrict_deletions: false,
        required_approvals: 2,
      },
    ],
  }}
  play={async ({ canvas, canvasElement, userEvent }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText("Rulesets")).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Repository rulesets" })).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Default.*targeting default branch/u }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Paused.*branch rule/u }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /Paused.*branch rule/u }),
    );
    const paused = within(
      canvasElement.querySelector(
        '[data-ui-part="collapsible"][data-state="open"]',
      ) as HTMLElement,
    );
    await expect(paused.getByText("Ada")).toBeVisible();
    await expect(
      paused.getByRole("slider", { name: "Required approvals" }),
    ).toHaveAttribute("aria-valuenow", "2");
    await userEvent.click(canvas.getByRole("button", { name: "Default ruleset actions" }));
    await expect(overlay.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("data-variant", "destructive");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe("none"));
    const newRuleset = canvas.getByRole("button", { name: "New ruleset" });
    await expect(newRuleset.querySelector(".lucide-chevron-down")).not.toBeNull();
    await userEvent.click(newRuleset);
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "New branch ruleset" }),
    );
    const editor = within(
      canvasElement.querySelector(
        '[data-ui-part="collapsible"][data-state="open"]',
      ) as HTMLElement,
    );
    await expect(editor.getByLabelText("Ruleset name")).toHaveValue(
      "New branch ruleset",
    );
    await expect(editor.getByRole("switch", { name: "Enforcement status" })).toBeVisible();
    await expect(editor.getByText("Bypass list is empty")).toBeVisible();
    await expect(
      editor.getByText(/Exempt channel roles and members/u),
    ).toBeVisible();
    await expect(editor.getByText("Branch rules")).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRulesetList {...args} />
  {/snippet}
</Story>
