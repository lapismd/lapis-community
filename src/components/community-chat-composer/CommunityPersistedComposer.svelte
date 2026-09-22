<script lang="ts">
  import type { ComponentProps } from "svelte";

  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import { resetBoundDraftOnKeyChange } from "./composer-draft-reset.svelte.js";

  type ComposerProps = ComponentProps<typeof CommunityChatComposer>;

  let {
    draftKey,
    draftStore,
    value = $bindable(""),
    formattingOpen = $bindable(false),
    ref = $bindable(null),
    ...rest
  }: ComposerProps & { draftKey: string } = $props();

  resetBoundDraftOnKeyChange({
    key: () => draftKey,
    persist: () => draftStore !== undefined,
    setValue(next) {
      value = next;
    },
  });
</script>

{#key draftKey}
  <CommunityChatComposer
    {draftKey}
    {...draftStore === undefined ? {} : { draftStore }}
    bind:value
    bind:formattingOpen
    bind:ref
    {...rest}
  />
{/key}
