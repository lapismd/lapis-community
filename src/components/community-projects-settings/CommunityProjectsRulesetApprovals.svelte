<script lang="ts">
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Slider } from "@lapismd/design-core/shadcn/slider";

  import { MAX_REQUIRED_APPROVALS } from "../../projects/protection-document.js";
  import type { ProjectForgeProtectionRule } from "../../projects/protection-ruleset.js";

  let {
    draft = $bindable(),
    canMaintain = false,
    idPrefix = "ruleset",
  }: {
    draft: ProjectForgeProtectionRule;
    canMaintain?: boolean;
    idPrefix?: string;
  } = $props();
</script>

<Field.Field>
  <Field.Label for={`${idPrefix}-approvals`}>Required approvals</Field.Label>
  <div class="community-projects-ruleset-approvals">
    <Slider
      id={`${idPrefix}-approvals`}
      type="single"
      min={1}
      max={MAX_REQUIRED_APPROVALS}
      step={1}
      bind:value={draft.required_approvals}
      disabled={!canMaintain}
      aria-label="Required approvals"
    />
    <span>{draft.required_approvals}</span>
  </div>
</Field.Field>

<style>
  .community-projects-ruleset-approvals {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: min(24rem, 100%);
  }
</style>
