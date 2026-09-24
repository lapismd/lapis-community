<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import type { CommunityAgentRuntimeState } from "../../community/agent-contracts.js";
  import {
    runtimeHarnesses,
    runtimeModelOptions,
    runtimeOptionLabel,
    runtimeThinkingOptions,
  } from "../../community/agent-runtime-catalog.js";
  import { approvalPolicyLabel } from "../../community/agent-execution-policy.js";

  let {
    runtime,
    runtimeAgent,
    runtimeModel,
    runtimeThinking,
    disabled = false,
    onEdit,
  }: {
    runtime: CommunityAgentRuntimeState;
    runtimeAgent: string;
    runtimeModel: string;
    runtimeThinking: string;
    disabled?: boolean;
    onEdit: () => void;
  } = $props();

  const harness = $derived(
    runtimeHarnesses(runtime).find(({ id }) => id === runtimeAgent)?.label ??
      runtimeAgent,
  );
  const model = $derived(
    runtimeOptionLabel(
      runtimeModelOptions(runtime.catalog),
      runtimeModel,
      "Harness default",
    ),
  );
  const thinkingOptions = $derived(runtimeThinkingOptions(runtime.catalog));
  const thinking = $derived(
    runtimeOptionLabel(thinkingOptions, runtimeThinking, runtimeThinking),
  );
  const permission = $derived(
    approvalPolicyLabel(runtime.effective.approvalPolicy),
  );
</script>

<div
  class="agent-profile__runtime-fields"
  data-ui-part="runtime-defaults"
  aria-label="Runtime defaults"
>
  <Button
    type="button"
    variant="ghost"
    class="agent-profile__runtime-field"
    {disabled}
    aria-label="Edit agent harness"
    onclick={onEdit}
  >
    <span>
      <span>Agent harness</span>
      <strong>{harness}</strong>
    </span>
    <PencilIcon aria-hidden="true" />
  </Button>
  <Button
    type="button"
    variant="ghost"
    class="agent-profile__runtime-field"
    {disabled}
    aria-label="Edit model"
    onclick={onEdit}
  >
    <span>
      <span>Model</span>
      <strong>{model}</strong>
    </span>
    <PencilIcon aria-hidden="true" />
  </Button>
  {#if thinkingOptions.length > 0}
    <Button
      type="button"
      variant="ghost"
      class="agent-profile__runtime-field"
      {disabled}
      aria-label="Edit thinking"
      onclick={onEdit}
    >
      <span>
        <span>Thinking</span>
        <strong>{thinking}</strong>
      </span>
      <PencilIcon aria-hidden="true" />
    </Button>
  {/if}
  <Button
    type="button"
    variant="ghost"
    class="agent-profile__runtime-field"
    {disabled}
    aria-label="Edit permissions"
    onclick={onEdit}
  >
    <span>
      <span>Permissions</span>
      <strong>{permission}</strong>
    </span>
    <PencilIcon aria-hidden="true" />
  </Button>
</div>
