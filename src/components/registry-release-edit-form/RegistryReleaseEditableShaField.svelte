<script lang="ts">
  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import RegistryReleaseEditableShaControl from "./RegistryReleaseEditableShaControl.svelte";

  type Props = RegisteredFormRendererProps<
    "registry-editable-sha",
    RegistryReleaseEditDraft
  > & {
    blur?: () => void;
  };

  let { value, field, readonly = false, update, blur = () => {} }: Props =
    $props();
</script>

<RegistryReleaseEditableShaControl
  {value}
  label={field.label}
  {readonly}
  {update}
  {blur}
/>
