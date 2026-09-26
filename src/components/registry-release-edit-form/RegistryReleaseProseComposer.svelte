<script lang="ts">
  import { untrack } from "svelte";

  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import "./RegistryReleaseProseComposer.css";

  let {
    value = "",
    label,
    placeholder = "",
    error = null,
    errorId = undefined,
    readonly = false,
    update,
    blur = () => {},
  }: {
    value?: string;
    label: string;
    placeholder?: string;
    error?: string | null;
    errorId?: string | undefined;
    readonly?: boolean;
    update: (value: string) => void | Promise<void>;
    blur?: () => void;
  } = $props();

  let composerValue = $state(untrack(() => value));
  let syncedValue = $state(untrack(() => value));

  $effect(() => {
    const nextValue = value;
    untrack(() => {
      if (nextValue === syncedValue) return;
      syncedValue = nextValue;
      if (nextValue !== composerValue) composerValue = nextValue;
    });
  });

  $effect(() => {
    const nextValue = composerValue;
    untrack(() => {
      if (nextValue === syncedValue) return;
      syncedValue = nextValue;
      void update(nextValue);
    });
  });

  function keepToolbarFocus(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-ui-part="footer"]')) event.preventDefault();
  }
</script>

<div
  class="registry-release-prose-composer"
  data-invalid={error ? "" : undefined}
  role="group"
  aria-label={label}
  aria-describedby={errorId}
  onpointerdown={keepToolbarFocus}
  onfocusout={blur}
>
  <CommunityChatComposer
    mode="form"
    showSubmitButton={false}
    bind:value={composerValue}
    disabled={readonly}
    ariaLabel={label}
    {placeholder}
    class="registry-release-prose-composer__composer"
  />
  {#if error}
    <div id={errorId} class="cv-forms-field-issues">
      <p>{error}</p>
    </div>
  {/if}
</div>
