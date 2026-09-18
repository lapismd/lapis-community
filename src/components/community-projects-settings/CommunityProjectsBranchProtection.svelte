<script lang="ts">
  import { untrack } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";

  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type { ProjectForgeRepositoryCapabilities } from "../../projects/model.js";
  import type { ProjectForgeProtectionDocumentInput } from "../../projects/protection-document.js";
  import type { ProjectForgeProtectionRule } from "../../projects/protection-ruleset.js";
  import { repositoryProtectionSummary } from "./community-projects-settings.js";
  import CommunityProjectsRulesetList from "./CommunityProjectsRulesetList.svelte";

  let {
    capabilities,
    members = [],
    canMaintain = false,
    onSaveProtection,
  }: {
    capabilities?: ProjectForgeRepositoryCapabilities | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    canMaintain?: boolean | undefined;
    onSaveProtection?:
      | ((input: ProjectForgeProtectionDocumentInput) => Promise<void>)
      | undefined;
  } = $props();

  const protection = $derived(repositoryProtectionSummary(capabilities));
  const editable = $derived(
    canMaintain &&
      onSaveProtection !== undefined &&
      !protection.githubAuthoritative,
  );

  let rules = $state(untrack(() => [...protection.rules]));
  let saveError = $state("");
  let saving = $state(false);

  async function persist(next: ProjectForgeProtectionRule[]): Promise<void> {
    if (!onSaveProtection) return;
    saving = true;
    saveError = "";
    try {
      await onSaveProtection({ version: 1, rules: next });
      rules = next;
    } catch (error) {
      saveError =
        error instanceof Error ? error.message : "Could not save rulesets";
    } finally {
      saving = false;
    }
  }

  function upsert(rule: ProjectForgeProtectionRule): Promise<void> {
    return persist(
      rules.some((item) => item.id && item.id === rule.id)
        ? rules.map((item) => (item.id === rule.id ? rule : item))
        : [...rules, rule],
    );
  }
</script>

{#if protection.githubAuthoritative}
  <p>
    Clone, push, and branch protection stay on GitHub for this repository. The
    relay still requires a channel maintainer to create, review, and merge Nostr
    collaboration events.
  </p>
{:else}
  <CommunityProjectsRulesetList
    {rules}
    {members}
    canMaintain={editable}
    onSave={upsert}
    onToggle={(id) =>
      persist(
        rules.map((rule) =>
          rule.id === id
            ? {
                ...rule,
                enforcement:
                  rule.enforcement === "active" ? "disabled" : "active",
              }
            : rule,
        ),
      )}
    onDelete={(id) => persist(rules.filter((rule) => rule.id !== id))}
  />
  {#if protection.announcementPatterns.length > 0}
    <p>Also from announcement: {protection.announcementPatterns.join(", ")}</p>
  {/if}
  <p>Pull requests required: {protection.pullRequestsRequired ? "Yes" : "No"}</p>
  <p>Who can merge: {protection.mergeActors}</p>
  {#if saveError}
    <p role="alert">{saveError}</p>
  {/if}
  {#if saving}
    <Button type="button" size="sm" disabled>Saving rulesets…</Button>
  {/if}
{/if}

<style>
  p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
