<script lang="ts">
  import * as Field from "@lapismd/design-core/shadcn/field";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import type { AgentApprovalPolicy } from "../../community/agent-execution-policy.js";

  let {
    id,
    pending = false,
    approvalPolicy = "allow-all",
    onValueChange,
  }: {
    id: string;
    pending?: boolean;
    approvalPolicy?: AgentApprovalPolicy;
    onValueChange: (value: AgentApprovalPolicy) => void;
  } = $props();

  const choices = [
    { value: "allow-all", name: "Allow all" },
    { value: "ask", name: "Ask" },
  ] as const;
</script>

<Field.Field>
  <Field.Label for={id}>Permissions</Field.Label>
  <Select.Root
    type="single"
    value={approvalPolicy}
    onValueChange={(value) => {
      if (value === "ask" || value === "allow-all") onValueChange(value);
    }}
    disabled={pending}
  >
    <Select.Trigger {id}
      >{choices.find(({ value }) => value === approvalPolicy)?.name ??
        approvalPolicy}</Select.Trigger
    >
    <Select.Content side="top">
      <Select.Group>
        {#each choices as option (option.value)}
          <Select.Item value={option.value}>{option.name}</Select.Item>
        {/each}
      </Select.Group>
    </Select.Content>
  </Select.Root>
  <Field.Description
    >Applies to the next new or continued turn. Task questions still require
    your answer.</Field.Description
  >
</Field.Field>
