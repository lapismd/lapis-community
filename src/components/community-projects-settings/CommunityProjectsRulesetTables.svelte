<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import CircleMinusIcon from "@lucide/svelte/icons/circle-minus";
  import CirclePlusIcon from "@lucide/svelte/icons/circle-plus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import {
    rulesetBypassLabel,
    rulesetTargetLabel,
    type ProjectForgeProtectionRule,
  } from "../../projects/protection-ruleset.js";
  import {
    compileRulesetPattern,
    rulesetBypassMember,
    withRulesetBypass,
    withRulesetTarget,
  } from "./community-projects-ruleset-draft.js";
  import CommunityProjectsRulesetPanel from "./CommunityProjectsRulesetPanel.svelte";
  import CommunityProjectsRulesetRules from "./CommunityProjectsRulesetRules.svelte";

  let {
    draft = $bindable(),
    patternDraft = $bindable(""),
    patternMode = $bindable("include"),
    patternOpen = $bindable(false),
    idPrefix = "ruleset",
    members = [],
    onAddMember,
    error = $bindable(""),
  }: {
    draft: ProjectForgeProtectionRule;
    patternDraft?: string;
    patternMode?: "include" | "exclude";
    patternOpen?: boolean;
    idPrefix?: string;
    members?: readonly CommunityMemberModel[];
    onAddMember: () => void;
    error?: string;
  } = $props();

  function addPattern(): void {
    const pattern = compileRulesetPattern(patternDraft);
    if (!pattern) {
      error = "Enter a branch name, prefix/*, or prefix/** pattern.";
      return;
    }
    draft = withRulesetTarget(draft, { type: patternMode, pattern });
    patternDraft = "";
    patternOpen = false;
    error = "";
  }
</script>

<CommunityProjectsRulesetPanel
  title="Bypass list"
  headingId={`${idPrefix}-bypass`}
  description="Exempt channel roles and members from this ruleset by adding them to the bypass list."
  toolbar="Actors"
  empty={draft.bypass.length === 0 ? "Bypass list is empty" : undefined}
>
  {#snippet action()}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} type="button" variant="outline" size="sm">
            <PlusIcon aria-hidden="true" />
            Add bypass
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item
          onSelect={() =>
            queueMicrotask(
              () => (draft = withRulesetBypass(draft, { kind: "admin" })),
            )}
        >
          Channel creator / relay admin
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() =>
            queueMicrotask(
              () => (draft = withRulesetBypass(draft, { kind: "maintainer" })),
            )}
        >
          Maintainer
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => queueMicrotask(onAddMember)}>
          Specific member…
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/snippet}
  {#each draft.bypass as actor, index (`${actor.kind}:${actor.pubkey ?? index}`)}
    {@const member = rulesetBypassMember(actor, members)}
    <li>
      <span class="community-projects-ruleset-tables__actor">
        {#if member}
          <CommunityMemberHoverCard {member} avatarSize="small" />
          {member.name}
        {:else}
          {rulesetBypassLabel(actor)}
        {/if}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${member?.name ?? rulesetBypassLabel(actor)}`}
        onclick={() =>
          (draft = {
            ...draft,
            bypass: draft.bypass.filter((item) => item !== actor),
          })}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
    </li>
  {/each}
</CommunityProjectsRulesetPanel>

<CommunityProjectsRulesetPanel
  title="Target branches"
  headingId={`${idPrefix}-targets`}
  description="Which branches should be matched?"
  toolbar="Branch targeting criteria"
  empty={draft.targets.length === 0
    ? "Branch targeting has not been configured"
    : undefined}
>
  {#snippet action()}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} type="button" variant="outline" size="sm">
            Add target
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item
          onSelect={() =>
            queueMicrotask(
              () => (draft = withRulesetTarget(draft, { type: "default" })),
            )}
        >
          <CirclePlusIcon class="community-projects-ruleset-tables__include" aria-hidden="true" />
          Include default branch
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() =>
            queueMicrotask(
              () => (draft = withRulesetTarget(draft, { type: "all" })),
            )}
        >
          <CirclePlusIcon class="community-projects-ruleset-tables__include" aria-hidden="true" />
          Include all branches
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => {
            queueMicrotask(() => {
              patternMode = "include";
              patternOpen = true;
            });
          }}
        >
          <CirclePlusIcon class="community-projects-ruleset-tables__include" aria-hidden="true" />
          Include by pattern
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => {
            queueMicrotask(() => {
              patternMode = "exclude";
              patternOpen = true;
            });
          }}
        >
          <CircleMinusIcon class="community-projects-ruleset-tables__exclude" aria-hidden="true" />
          Exclude by pattern
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/snippet}
  {#each draft.targets as target, index (`${target.type}:${target.pattern ?? index}`)}
    <li>
      <span class="community-projects-ruleset-tables__target">
        {#if target.type === "exclude"}
          <CircleMinusIcon class="community-projects-ruleset-tables__exclude" aria-hidden="true" />
        {:else}
          <CirclePlusIcon class="community-projects-ruleset-tables__include" aria-hidden="true" />
        {/if}
        {#if target.type === "include" || target.type === "exclude"}
          <CommunityChip size="compact">{rulesetTargetLabel(target)}</CommunityChip>
        {:else}
          {rulesetTargetLabel(target)}
        {/if}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${rulesetTargetLabel(target)}`}
        onclick={() =>
          (draft = {
            ...draft,
            targets: draft.targets.filter((item) => item !== target),
          })}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
    </li>
  {/each}
</CommunityProjectsRulesetPanel>
{#if patternOpen}
  <div class="community-projects-ruleset-tables__add">
    <Input
      bind:value={patternDraft}
      placeholder={patternMode === "exclude" ? "releases/legacy" : "releases/**"}
      aria-label={patternMode === "exclude" ? "Exclude pattern" : "Include pattern"}
    />
    <Button type="button" variant="outline" size="sm" onclick={addPattern}>
      Add pattern
    </Button>
  </div>
{/if}

<CommunityProjectsRulesetRules bind:draft {idPrefix} />

<style>
  .community-projects-ruleset-tables__add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }

  .community-projects-ruleset-tables__actor,
  .community-projects-ruleset-tables__target {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.community-projects-ruleset-tables__include) {
    color: var(--success, var(--primary));
  }

  :global(.community-projects-ruleset-tables__exclude) {
    color: var(--destructive);
  }
</style>
