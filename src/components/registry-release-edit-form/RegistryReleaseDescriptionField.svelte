<script lang="ts">
  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import RegistryReleaseProseComposer from "./RegistryReleaseProseComposer.svelte";

  type Props = RegisteredFormRendererProps<
    "registry-description-composer",
    RegistryReleaseEditDraft
  > & {
    blur?: () => void;
  };

  let {
    value,
    field,
    issues = [],
    readonly = false,
    update,
    blur = () => {},
  }: Props = $props();

  const error = $derived(issues[0]?.message ?? null);
  const errorId = $derived(error ? `${field.id}-issues` : undefined);
</script>

<RegistryReleaseProseComposer
  value={value ?? ""}
  label={field.ariaLabel ?? field.label}
  placeholder={field.placeholder ?? ""}
  {error}
  {errorId}
  {readonly}
  {update}
  {blur}
/>
