<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";

  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import {
    createProtectionRule,
    rulesetListSummary,
    type ProjectForgeProtectionRule,
  } from "../../projects/protection-ruleset.js";
  import CommunityProjectsRulesetEditor from "./CommunityProjectsRulesetEditor.svelte";

  let {
    rules,
    members = [],
    canMaintain = false,
    onSave,
    onDelete,
    onToggle,
  }: {
    rules: ProjectForgeProtectionRule[];
    members?: readonly CommunityMemberModel[];
    canMaintain?: boolean;
    onSave: (rule: ProjectForgeProtectionRule) => Promise<void>;
    onDelete: (ruleId: string) => Promise<void>;
    onToggle: (ruleId: string) => Promise<void>;
  } = $props();

  let drafts = $state<ProjectForgeProtectionRule[]>([]);
  let openId = $state<string>();
  let draftEnforcement = $state<Record<string, ProjectForgeProtectionRule["enforcement"]>>({});

  const rows = $derived([
    ...rules,
    ...drafts.filter((draft) => !rules.some((rule) => rule.id === draft.id)),
  ]);

  function rowId(rule: ProjectForgeProtectionRule, index: number): string {
    return rule.id || `draft-${index}`;
  }

  function setOpen(id: string, open: boolean): void {
    openId = open ? id : openId === id ? undefined : openId;
  }

  function startNew(preset: "branch" | "tag"): void {
    const rule = createProtectionRule(
      preset === "tag" ? "New tag ruleset" : "New branch ruleset",
    );
    rule.id = `draft-${crypto.randomUUID()}`;
    drafts = [...drafts, rule];
    openId = rule.id;
  }

  async function persist(rule: ProjectForgeProtectionRule): Promise<void> {
    await onSave(rule);
    drafts = drafts.filter((item) => item.id !== rule.id);
    openId = undefined;
    const next = { ...draftEnforcement };
    delete next[rule.id];
    draftEnforcement = next;
  }

  function cancel(rule: ProjectForgeProtectionRule): void {
    drafts = drafts.filter((item) => item.id !== rule.id);
    openId = openId === rule.id ? undefined : openId;
    const next = { ...draftEnforcement };
    delete next[rule.id];
    draftEnforcement = next;
  }
</script>

<div class="community-projects-rulesets">
  <div class="community-projects-rulesets__header">
    <h3>Rulesets</h3>
    {#if canMaintain}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button {...props} type="button" size="sm">New ruleset<ChevronDownIcon data-icon="inline-end" aria-hidden="true" /></Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={() => queueMicrotask(() => startNew("branch"))}>
            New branch ruleset
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => queueMicrotask(() => startNew("tag"))}>
            New tag ruleset
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
  </div>
  {#if rows.length === 0}
    <p>No rulesets yet. Create a branch or tag ruleset to protect refs.</p>
  {:else}
    <div class="community-projects-rulesets__list" role="list" aria-label="Repository rulesets">
      {#each rows as rule, index (rowId(rule, index))}
        {@const id = rowId(rule, index)}
        {@const name = rule.name || "Untitled ruleset"}
        {@const summary = rulesetListSummary(rule)}
        {@const enforcement = draftEnforcement[id] ?? rule.enforcement}
        <Collapsible.Root
          class="community-projects-rulesets__card"
          role="listitem"
          open={openId === id}
          onOpenChange={(open) => setOpen(id, open)}
        >
          <div class="community-projects-rulesets__row">
            <Collapsible.Trigger class="community-projects-rulesets__trigger">
              {#if enforcement === "active"}
                <CircleCheckIcon aria-hidden="true" />
              {:else}
                <CircleXIcon aria-hidden="true" />
              {/if}
              <span class="community-projects-rulesets__copy">
                <strong>{name}</strong>
                <span>{summary}</span>
              </span>
            </Collapsible.Trigger>
            {#if canMaintain}
              <div class="community-projects-rulesets__actions">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${name} ruleset actions`}
                    >
                      <EllipsisIcon aria-hidden="true" />
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item onSelect={() => queueMicrotask(() => setOpen(id, openId !== id))}>
                    {openId === id ? "Collapse" : "Edit"}
                  </DropdownMenu.Item>
                  {#if !id.startsWith("draft-")}
                    <DropdownMenu.Item onSelect={() => void onToggle(id)}>
                      {rule.enforcement === "active" ? "Disable" : "Enable"}
                    </DropdownMenu.Item>
                  {/if}
                  <DropdownMenu.Item
                    variant="destructive"
                    onSelect={() =>
                      queueMicrotask(() =>
                        id.startsWith("draft-") ? cancel(rule) : void onDelete(id))}
                  >Delete</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              </div>
            {/if}
          </div>
          <Collapsible.Content class="community-projects-rulesets__editor">
            <CommunityProjectsRulesetEditor
              {rule}
              {members}
              {canMaintain}
              idPrefix={id}
              onSave={persist}
              onCancel={() => cancel(rule)}
              onEnforcementChange={(value) =>
                (draftEnforcement = { ...draftEnforcement, [id]: value })}
            />
          </Collapsible.Content>
        </Collapsible.Root>
      {/each}
    </div>
  {/if}
</div>

<style>
  .community-projects-rulesets,
  .community-projects-rulesets__list,
  .community-projects-rulesets__copy {
    display: grid;
    gap: 0.75rem;
  }

  .community-projects-rulesets {
    justify-items: stretch;
    width: 100%;
  }

  .community-projects-rulesets__header,
  .community-projects-rulesets__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .community-projects-rulesets__row {
    flex-wrap: nowrap;
  }

  .community-projects-rulesets__row:hover {
    background: var(--muted);
  }

  .community-projects-rulesets__copy {
    gap: 0.15rem;
  }

  .community-projects-rulesets__actions {
    display: flex;
    align-items: center;
    padding-inline-end: 0.45rem;
  }

  h3,
  p {
    margin: 0;
  }

  p,
  .community-projects-rulesets__copy span {
    color: var(--muted-foreground);
  }

  :global(.community-projects-rulesets__card) {
    overflow: hidden;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--background);
  }

  :global(.community-projects-rulesets__trigger) {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    padding: 0.7rem 1rem;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  :global(.community-projects-rulesets__editor) {
    padding: 1rem 1rem 1.1rem;
    border-top: 1px solid var(--border);
    background: var(--background);
  }
</style>
