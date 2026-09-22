<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ButtonGroup from "@lapismd/design-core/shadcn/button-group";
  import { CodeBlock } from "@lapismd/design-core/shadcn/code-block";
  import type {
    CommunityAgentPermissionDecision,
    CommunityAgentPermissionRequest,
  } from "../../community/agent-contracts.js";
  import {
    PERMISSION_DECISION_LABELS,
    permissionDecisionVariant,
    permissionExpiryLabel,
    permissionInputCode,
  } from "./permission-decision.js";

  let {
    agentName,
    permission,
    disabled = false,
    onDecide,
  }: {
    agentName: string;
    permission: CommunityAgentPermissionRequest;
    disabled?: boolean;
    onDecide?: (decision: CommunityAgentPermissionDecision) => void;
  } = $props();

  const inputCode = $derived(permissionInputCode(permission.input));
</script>

<article
  class="agent-permission-card"
  aria-label={`Permission requested by ${agentName}`}
>
  <div class="agent-permission-card__summary">
    <h3>{permission.tool}</h3>
    <p>The agent requested an explicit action.</p>
  </div>
  {#if inputCode}
    <CodeBlock
      code={inputCode}
      language="json"
      title="Input"
      size="sm"
      width="full"
      isWrapped
      maxHeight="16rem"
    />
  {/if}
  {#if permission.expiresAt}
    <p class="agent-permission-card__expiry">
      Expires <time
        datetime={new Date(permission.expiresAt).toISOString()}
        title={permissionExpiryLabel(permission.expiresAt)}
        >{permissionExpiryLabel(permission.expiresAt)}</time
      >
    </p>
  {/if}
  <div class="agent-permission-card__actions">
    <ButtonGroup.Root aria-label={`Respond to ${permission.tool}`}>
      {#each permission.options as decision, index (decision)}
        {#if index > 0}<ButtonGroup.Separator />{/if}
        <Button
          variant={permissionDecisionVariant(decision)}
          size="sm"
          {disabled}
          onclick={() => onDecide?.(decision)}
          >{PERMISSION_DECISION_LABELS[decision]}</Button
        >
      {/each}
    </ButtonGroup.Root>
  </div>
</article>

<style>
  .agent-permission-card {
    display: grid;
    gap: 0.875rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--background);
  }

  .agent-permission-card__summary {
    display: grid;
    gap: 0.25rem;
  }

  h3 {
    font-size: var(--community-text-body);
    font-weight: 600;
    margin: 0;
  }

  p {
    margin: 0;
    color: var(--muted-foreground);
  }

  .agent-permission-card__actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
