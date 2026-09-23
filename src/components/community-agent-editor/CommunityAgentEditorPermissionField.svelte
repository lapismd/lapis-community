<script lang="ts">
  import * as Field from "@lapismd/design-core/shadcn/field";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import type { CommunityAgentRuntimeOption } from "../../community/agent-runtime-contracts.js";

  let {
    id,
    pending = false,
    permissionMode = "",
    options,
    onValueChange,
  }: {
    id: string;
    pending?: boolean;
    permissionMode?: string;
    options: readonly CommunityAgentRuntimeOption[];
    onValueChange: (value: string) => void;
  } = $props();

  const choices = $derived([{ value: "", name: "Ask" }, ...options]);
</script>

<Field.Field>
  <Field.Label for={id}>Permission mode</Field.Label>
  <Select.Root
    type="single"
    value={permissionMode}
    onValueChange={onValueChange}
    disabled={pending}
  >
    <Select.Trigger {id}
      >{choices.find(({ value }) => value === permissionMode)?.name ??
        permissionMode}</Select.Trigger
    >
    <Select.Content side="top">
      {#each choices as option (option.value)}
        <Select.Item value={option.value}>{option.name}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</Field.Field>
