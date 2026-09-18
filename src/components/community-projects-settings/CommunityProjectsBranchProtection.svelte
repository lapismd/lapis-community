<script lang="ts">
  import { untrack } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import { Input } from "@lapismd/design-core/shadcn/input";

  import type { ProjectForgeRepositoryCapabilities } from "../../projects/model.js";
  import type { ProjectForgeProtectionDocumentInput } from "../../projects/protection-document.js";
  import {
    normalizeProtectedPattern,
    protectedRefPatternsHelp,
  } from "../../projects/protected-refs.js";
  import { repositoryProtectionSummary } from "./community-projects-settings.js";

  let {
    capabilities,
    canMaintain = false,
    onSaveProtection,
  }: {
    capabilities?: ProjectForgeRepositoryCapabilities | undefined;
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

  let draftPatterns = $state(untrack(() => [...protection.documentPatterns]));
  let requiredApprovals = $state(untrack(() => protection.requiredApprovals));
  let adminBypass = $state(untrack(() => protection.adminBypass));
  let patternDraft = $state("");
  let saveError = $state("");
  let saving = $state(false);

  function addPattern(): void {
    const compiled = normalizeProtectedPattern(patternDraft);
    if (!compiled) {
      saveError = "Enter a branch name or prefix/* pattern.";
      return;
    }
    if (!draftPatterns.includes(compiled)) {
      draftPatterns = [...draftPatterns, compiled];
    }
    patternDraft = "";
    saveError = "";
  }

  function removePattern(pattern: string): void {
    draftPatterns = draftPatterns.filter((entry) => entry !== pattern);
  }

  async function saveProtection(): Promise<void> {
    if (!onSaveProtection) return;
    saving = true;
    saveError = "";
    try {
      await onSaveProtection({
        protected_patterns: draftPatterns,
        required_approvals: Number(requiredApprovals),
        admin_bypass: adminBypass,
      });
    } catch (error) {
      saveError =
        error instanceof Error
          ? error.message
          : "Could not save branch protection";
    } finally {
      saving = false;
    }
  }
</script>

{#if protection.githubAuthoritative}
  <p>
    Clone, push, and branch protection stay on GitHub for this repository. The
    relay still requires a channel maintainer to create, review, and merge Nostr
    collaboration events.
  </p>
{:else}
  <dl>
    <div>
      <dt>Default branch</dt>
      <dd>{protection.defaultBranch}</dd>
    </div>
    <div>
      <dt>Protected ref</dt>
      <dd>{protection.protectedRef}</dd>
    </div>
    {#if editable}
      <div>
        <dt>
          <label for="community-projects-protection-pattern"
            >Extra protected refs</label
          >
        </dt>
        <dd>
          {#if draftPatterns.length > 0}
            <ul>
              {#each draftPatterns as pattern (pattern)}
                <li>
                  <span>{pattern}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onclick={() => removePattern(pattern)}
                  >
                    Remove {pattern}
                  </Button>
                </li>
              {/each}
            </ul>
          {:else}
            <p>None yet. The live default branch stays protected.</p>
          {/if}
          <div class="community-projects-protection__add">
            <Input
              id="community-projects-protection-pattern"
              bind:value={patternDraft}
              placeholder="release/*"
              autocomplete="off"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onclick={addPattern}
            >
              Add pattern
            </Button>
          </div>
        </dd>
      </div>
      <div>
        <dt>
          <label for="community-projects-protection-approvals"
            >Required approvals</label
          >
        </dt>
        <dd>
          <Input
            id="community-projects-protection-approvals"
            type="number"
            min="1"
            max="16"
            bind:value={requiredApprovals}
          />
        </dd>
      </div>
      <div>
        <dt>Admin bypass</dt>
        <dd>
          <label class="community-projects-protection__bypass">
            <Checkbox
              checked={adminBypass}
              onCheckedChange={(checked) => (adminBypass = checked === true)}
              aria-label="Allow admin bypass"
            />
            <span>
              Channel creator and relay administrators may update protected refs
              and merge without the extra approval count. Deletes stay denied.
            </span>
          </label>
        </dd>
      </div>
    {:else}
      <div>
        <dt>Extra protected refs</dt>
        <dd>
          {#if protection.protectedPatterns.length > 0}
            {protection.protectedPatterns.join(", ")}
          {:else}
            None. The live default branch stays protected.
          {/if}
        </dd>
      </div>
      <div>
        <dt>Required approvals</dt>
        <dd>{protection.requiredApprovals}</dd>
      </div>
      <div>
        <dt>Admin bypass</dt>
        <dd>{protection.adminBypass ? "Enabled" : "Disabled"}</dd>
      </div>
    {/if}
    {#if protection.announcementPatterns.length > 0}
      <div>
        <dt>Also from announcement</dt>
        <dd>{protection.announcementPatterns.join(", ")}</dd>
      </div>
    {/if}
    <div>
      <dt>Pull requests required</dt>
      <dd>{protection.pullRequestsRequired ? "Yes" : "No"}</dd>
    </div>
    <div>
      <dt>Who can merge</dt>
      <dd>{protection.mergeActors}</dd>
    </div>
  </dl>
  <p>{protectedRefPatternsHelp()}</p>
  {#if editable}
    {#if saveError}
      <p role="alert">{saveError}</p>
    {/if}
    <Button
      type="button"
      size="sm"
      disabled={saving}
      onclick={() => void saveProtection()}
    >
      {saving ? "Saving branch protection…" : "Save branch protection"}
    </Button>
  {/if}
{/if}

<style>
  p,
  dd {
    margin: 0;
    color: var(--muted-foreground);
  }

  dl {
    display: grid;
    gap: 0.5rem;
    margin: 0;
  }

  dt {
    font-weight: 600;
  }

  ul {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li,
  .community-projects-protection__add,
  .community-projects-protection__bypass {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
</style>
