<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";

  import type { ProjectForgeRef } from "../../projects/index.js";

  let {
    branch,
    branches = [],
    onSelectBranch,
  }: {
    branch: string;
    branches?: readonly ProjectForgeRef[] | undefined;
    onSelectBranch: (value: string | undefined) => void;
  } = $props();
</script>

<Select.Root type="single" value={branch} onValueChange={onSelectBranch}>
  <Select.Trigger
    class="community-projects__file-branch-trigger"
    aria-label="Repository branch"
    role="combobox"
  >
    <GitBranchIcon aria-hidden="true" />
    <span>{branch || "Select branch"}</span>
  </Select.Trigger>
  <Select.Content>
    <Select.Group>
      {#each branches as option (option.name)}
        <Select.Item value={option.name} label={option.name}>
          {option.name}
        </Select.Item>
      {:else}
        {#if branch}
          <Select.Item value={branch} label={branch}>
            {branch}
          </Select.Item>
        {/if}
      {/each}
    </Select.Group>
  </Select.Content>
</Select.Root>
