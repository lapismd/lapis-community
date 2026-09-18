<script lang="ts">
  import { untrack } from "svelte";

  import { Button } from "@lapismd/design-core/shadcn/button";

  import CommunityMemberCommand from "../community-member-command/CommunityMemberCommand.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type {
    ProjectForgeProtectionRule,
    RulesetEnforcement,
  } from "../../projects/protection-ruleset.js";
  import {
    cloneProtectionRule,
    withRulesetBypass,
  } from "./community-projects-ruleset-draft.js";
  import CommunityProjectsRulesetApprovals from "./CommunityProjectsRulesetApprovals.svelte";
  import CommunityProjectsRulesetFields from "./CommunityProjectsRulesetFields.svelte";
  import CommunityProjectsRulesetTables from "./CommunityProjectsRulesetTables.svelte";

  let {
    rule,
    members = [],
    canMaintain = false,
    idPrefix = "ruleset",
    onSave,
    onCancel,
    onEnforcementChange,
  }: {
    rule: ProjectForgeProtectionRule;
    members?: readonly CommunityMemberModel[];
    canMaintain?: boolean;
    idPrefix?: string;
    onSave: (rule: ProjectForgeProtectionRule) => Promise<void>;
    onCancel: () => void;
    onEnforcementChange?: (enforcement: RulesetEnforcement) => void;
  } = $props();

  let draft = $state(untrack(() => cloneProtectionRule(rule)));
  let error = $state("");
  let pending = $state(false);
  let memberOpen = $state(false);
  let patternDraft = $state("");
  let patternMode = $state<"include" | "exclude">("include");
  let patternOpen = $state(false);

  $effect(() => {
    const next = rule;
    untrack(() => {
      draft = cloneProtectionRule(next);
      error = "";
      memberOpen = false;
      patternDraft = "";
      patternOpen = false;
    });
  });

  async function persist(): Promise<void> {
    if (!draft.name.trim()) {
      error = "Enter a ruleset name.";
      return;
    }
    if (draft.targets.length === 0) {
      error = "Add at least one include target.";
      return;
    }
    pending = true;
    error = "";
    try {
      await onSave(draft);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      pending = false;
    }
  }
</script>

<form
  class="community-projects-ruleset-editor"
  onsubmit={(event) => {
    event.preventDefault();
    void persist();
  }}
>
  <CommunityProjectsRulesetFields
    bind:draft
    {canMaintain}
    {idPrefix}
    {onEnforcementChange}
  />
  <CommunityProjectsRulesetTables
    bind:draft
    bind:patternDraft
    bind:patternMode
    bind:patternOpen
    bind:error
    {members}
    {idPrefix}
    onAddMember={() => (memberOpen = true)}
  />
  <CommunityProjectsRulesetApprovals bind:draft {canMaintain} {idPrefix} />
  {#if error}
    <p class="community-projects-ruleset-editor__error" role="alert">{error}</p>
  {/if}
  <div class="community-projects-ruleset-editor__actions">
    <Button type="submit" disabled={!canMaintain || pending}>
      {pending ? "Saving…" : "Save ruleset"}
    </Button>
    <Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
  </div>
</form>

{#if memberOpen}
  <CommunityMemberCommand
    {members}
    bind:open={memberOpen}
    title="Bypass members"
    searchLabel="Search members"
    onSearch={() => {}}
    onSelect={(member) => {
      draft = withRulesetBypass(draft, {
        kind: "member",
        pubkey: member.id,
      });
      memberOpen = false;
    }}
    onRemove={() => {}}
  />
{/if}

<style>
  .community-projects-ruleset-editor {
    display: grid;
    gap: 0.85rem;
    padding-block: 0.75rem;
  }

  .community-projects-ruleset-editor__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .community-projects-ruleset-editor__error {
    margin: 0;
    color: var(--destructive);
  }
</style>
