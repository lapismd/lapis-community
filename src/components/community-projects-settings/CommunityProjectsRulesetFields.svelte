<script lang="ts">
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Switch } from "@lapismd/design-core/shadcn/switch";

  import type {
    ProjectForgeProtectionRule,
    RulesetEnforcement,
  } from "../../projects/protection-ruleset.js";

  let {
    draft = $bindable(),
    canMaintain = false,
    idPrefix = "ruleset",
    onEnforcementChange,
  }: {
    draft: ProjectForgeProtectionRule;
    canMaintain?: boolean;
    idPrefix?: string;
    onEnforcementChange?: ((enforcement: RulesetEnforcement) => void) | undefined;
  } = $props();
</script>

<Field.Field>
  <Field.Label>Ruleset name</Field.Label>
  <Input bind:value={draft.name} aria-label="Ruleset name" />
</Field.Field>
<Field.Field>
  <Field.Label for={`${idPrefix}-enforcement`}>Enforcement status</Field.Label>
  <div class="community-projects-ruleset-fields">
    <Switch
      id={`${idPrefix}-enforcement`}
      checked={draft.enforcement === "active"}
      disabled={!canMaintain}
      onCheckedChange={(checked) => {
        const enforcement = checked === true ? "active" : "disabled";
        draft = { ...draft, enforcement };
        onEnforcementChange?.(enforcement);
      }}
      aria-label="Enforcement status"
    />
    <span>{draft.enforcement === "active" ? "Active" : "Disabled"}</span>
  </div>
</Field.Field>

<style>
  .community-projects-ruleset-fields {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
  }
</style>
