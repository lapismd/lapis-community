<script lang="ts">
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";

  import type { ProjectForgeProtectionRule } from "../../projects/protection-ruleset.js";

  let {
    draft = $bindable(),
    idPrefix = "ruleset",
  }: {
    draft: ProjectForgeProtectionRule;
    idPrefix?: string;
  } = $props();
</script>

<section class="community-projects-ruleset-rules" aria-labelledby={`${idPrefix}-rules`}>
  <h4 id={`${idPrefix}-rules`}>Branch rules</h4>
  <label>
    <Checkbox
      checked={draft.restrict_creations}
      onCheckedChange={(checked) =>
        (draft = { ...draft, restrict_creations: checked === true })}
      aria-label="Restrict creations"
    />
    <span class="community-projects-ruleset-rules__copy">
      <span>Restrict creations</span>
      <small>Only allow users with bypass permission to create matching refs.</small>
    </span>
  </label>
  <label>
    <Checkbox
      checked={draft.restrict_updates}
      onCheckedChange={(checked) =>
        (draft = { ...draft, restrict_updates: checked === true })}
      aria-label="Restrict updates"
    />
    <span class="community-projects-ruleset-rules__copy">
      <span>Restrict updates</span>
      <small>Only allow users with bypass permission to update matching refs.</small>
    </span>
  </label>
  <label>
    <Checkbox
      checked={draft.restrict_deletions}
      onCheckedChange={(checked) =>
        (draft = { ...draft, restrict_deletions: checked === true })}
      aria-label="Restrict deletions"
    />
    <span class="community-projects-ruleset-rules__copy">
      <span>Restrict deletions</span>
      <small>Only allow users with bypass permission to delete matching refs.</small>
    </span>
  </label>
</section>

<style>
  .community-projects-ruleset-rules {
    display: grid;
    gap: 0.35rem;
  }

  h4,
  small {
    margin: 0;
  }

  label {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.65rem;
    padding-block: 0.65rem;
    border-bottom: 1px solid var(--border);
  }

  .community-projects-ruleset-rules__copy {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  small {
    display: block;
    color: var(--muted-foreground);
  }
</style>
