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
    communityEmojis = [],
    onSelect = () => {},
  }: {
    open?: boolean;
    label?: string;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onSelect?: (emoji: string, custom?: CommunityCustomEmoji) => void;
  } = $props();

  let pickerHost = $state<HTMLDivElement>();

  $effect(() => {
    const host = pickerHost;
    if (!open || !host) return;
    const picker = new Picker({
      data,
      autoFocus: true,
      dynamicWidth: true,
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
        aria-label={label}
        title={label}
      >
        <SmilePlusIcon aria-hidden="true" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content
    align="end"
    sideOffset={6}
    class="community-emoji-picker__content"
  >
    <Popover.Header>
      <Popover.Title><h2>Emoji</h2></Popover.Title>
      <Popover.Description>
        Search standard emoji or choose one from this community.
      </Popover.Description>
    </Popover.Header>
    {#if communityEmojis.length}
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
    <div class="community-emoji-picker__host" bind:this={pickerHost}></div>
  </Popover.Content>
</Popover.Root>

<style>
  :global(
      .community-emoji-picker__content[data-ui-component="popover-content"]
    ) {
    width: min(22rem, calc(100vw - 1rem));
    padding: 0;
    overflow: hidden;
  }

  :global(.community-emoji-picker__content [data-ui-part="header"]) {
    padding: 0.75rem 0.75rem 0;
  }

  .community-emoji-picker__community {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
  }

  :global(.community-emoji-picker__content h2) {
    margin: 0;
    font-size: 0.95rem;
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
    width: 100%;
    min-width: 0;
    border: 0;
    border-radius: 0;
  }
</style>
