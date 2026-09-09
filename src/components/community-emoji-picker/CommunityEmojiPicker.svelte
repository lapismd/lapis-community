<script lang="ts">
  import data from "@emoji-mart/data";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import SmilePlusIcon from "@lucide/svelte/icons/smile-plus";
  import { Picker } from "emoji-mart";

  import type { CommunityCustomEmoji } from "../../community/index.js";

  let {
    open = $bindable(false),
    label = "Choose emoji",
    selection,
    disabled = false,
    presets = [],
    presetsOnly = false,
    communityEmojis = [],
    onSelect,
  }: {
    open?: boolean;
    label?: string;
    selection?: string;
    disabled?: boolean;
    presets?: readonly string[];
    presetsOnly?: boolean;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onSelect: (emoji: string, custom?: CommunityCustomEmoji) => void;
  } = $props();

  let pickerHost = $state<HTMLDivElement>();

  $effect(() => {
    const host = pickerHost;
    if (!open || !host || presetsOnly) return;
    const picker = new Picker({
      data,
      autoFocus: true,
      dynamicWidth: true,
      emojiButtonColors: ["var(--community-emoji-picker-hover)"],
      emojiButtonRadius: "0.4rem",
      navPosition: "bottom",
      previewPosition: "none",
      skinTonePosition: "search",
      theme: "auto",
      onEmojiSelect: (selection: { native?: string; shortcodes?: string }) => {
        const emoji = selection.native ?? selection.shortcodes;
        if (emoji === undefined) return;
        onSelect(emoji);
        open = false;
      },
    }) as unknown as HTMLElement;
    host.append(picker);
    const normalize = () => normalizePickerAccessibility(picker);
    const normalizeGeneratedMarkup = window.setTimeout(normalize);
    const observer = new MutationObserver(normalize);
    if (picker.shadowRoot) {
      observer.observe(picker.shadowRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-posinset", "aria-setsize", "aria-selected"],
      });
    }
    return () => {
      window.clearTimeout(normalizeGeneratedMarkup);
      observer.disconnect();
      picker.remove();
    };
  });

  function selectCommunityEmoji(emoji: CommunityCustomEmoji): void {
    onSelect(emoji.shortcode, emoji);
    open = false;
  }

  function selectPreset(emoji: string): void {
    onSelect(emoji);
    open = false;
  }

  function normalizePickerAccessibility(picker: HTMLElement): void {
    const root = picker.shadowRoot;
    if (!root) return;
    root.querySelector("header")?.setAttribute("role", "presentation");
    for (const button of root.querySelectorAll<HTMLButtonElement>(
      "button[aria-posinset], button[aria-setsize]",
    )) {
      button.removeAttribute("aria-posinset");
      button.removeAttribute("aria-setsize");
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>(
      "button[aria-selected]",
    )) {
      if (button.getAttribute("aria-selected") === "true")
        button.setAttribute("aria-current", "page");
      button.removeAttribute("aria-selected");
    }
    const scroll = root.querySelector<HTMLElement>(".scroll");
    if (scroll) {
      scroll.tabIndex = 0;
      scroll.setAttribute("aria-label", "Emoji results");
    }
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        type="button"
        variant="ghost"
        size="icon-sm"
        {disabled}
        aria-label={label}
        title={label}
      >
        {#if selection}
          <span aria-hidden="true">{selection}</span>
        {:else}
          <SmilePlusIcon aria-hidden="true" />
        {/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content
    align="end"
    sideOffset={6}
    class={presetsOnly
      ? "community-emoji-picker__content community-emoji-picker__content--presets-only"
      : "community-emoji-picker__content"}
  >
    <Popover.Header class="community-emoji-picker__a11y-header">
      <Popover.Title
        ><h2>{presetsOnly ? "Reaction" : "Emoji"}</h2></Popover.Title
      >
      <Popover.Description>
        {presetsOnly
          ? "Choose a supported reaction."
          : "Choose a suggested reaction, search standard emoji, or use one from this community."}
      </Popover.Description>
    </Popover.Header>
    {#if presets.length}
      <section
        class="community-emoji-picker__presets"
        aria-label="Suggested emoji"
      >
        {#each presets as emoji (emoji)}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`React ${emoji}`}
            title={`React ${emoji}`}
            onclick={() => selectPreset(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
          </Button>
        {/each}
      </section>
    {/if}
    {#if !presetsOnly && communityEmojis.length}
      <section
        class="community-emoji-picker__community"
        aria-label="Community emoji"
      >
        {#each communityEmojis as emoji (`${emoji.ownerPubkey}:${emoji.shortcode}`)}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`:${emoji.shortcode}:`}
            title={`:${emoji.shortcode}:`}
            onclick={() => selectCommunityEmoji(emoji)}
          >
            <img src={emoji.url} alt="" />
          </Button>
        {/each}
      </section>
    {/if}
    {#if !presetsOnly}
      <div class="community-emoji-picker__host" bind:this={pickerHost}></div>
    {/if}
  </Popover.Content>
</Popover.Root>

<style>
  :global(.community-emoji-picker__content[data-ui-part="popover-content"]) {
    width: min(28rem, calc(100vw - 1rem));
    padding: 0;
    overflow: hidden;
  }

  :global(
      .community-emoji-picker__content--presets-only[data-ui-part="popover-content"]
    ) {
    width: max-content;
    max-width: calc(100vw - 1rem);
  }

  .community-emoji-picker__presets,
  .community-emoji-picker__community {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    overflow-x: auto;
  }

  .community-emoji-picker__presets {
    padding-block: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  :global(.community-emoji-picker__a11y-header) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    clip: rect(0, 0, 0, 0);
    overflow: hidden;
    white-space: nowrap;
  }

  .community-emoji-picker__community img {
    width: 1.25rem;
    height: 1.25rem;
    object-fit: contain;
  }

  .community-emoji-picker__host {
    min-height: 24rem;
  }

  .community-emoji-picker__host :global(em-emoji-picker) {
    --community-emoji-picker-hover: color-mix(
      in srgb,
      var(--foreground) 14%,
      transparent
    );
    --border-radius: 0;
    --shadow: none;

    width: 100%;
    min-width: 0;
    border: 0;
    border-radius: 0;
  }
</style>
