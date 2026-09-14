<script lang="ts">
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { onDestroy } from "svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
  import LinkIcon from "@lucide/svelte/icons/link-2";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import { communityMemberAvatarFallbackTone } from "../community-member-avatar/model.js";
  import type { CommunityCustomEmoji } from "../../community/index.js";

  let {
    value = $bindable(""),
    open = $bindable(false),
    label = "Choose avatar",
    disabled = false,
    communityEmojis = [],
    shape = "rounded",
    size = "large",
    fallbackName = "",
  }: {
    value?: string;
    open?: boolean;
    label?: string;
    disabled?: boolean;
    communityEmojis?: readonly CommunityCustomEmoji[];
    shape?: "circle" | "rounded";
    size?: "medium" | "large";
    fallbackName?: string;
  } = $props();
  const emojis = [
    "😀",
    "😎",
    "🤓",
    "🥳",
    "🤖",
    "👻",
    "🐝",
    "🦊",
    "🐙",
    "🌈",
    "🔥",
    "✨",
    "🚀",
    "💎",
    "🎨",
    "💡",
  ];
  const colors = [
    "#f5d90a",
    "#ff8a4c",
    "#e5484d",
    "#ab4aba",
    "#6e56cf",
    "#0091ff",
    "#30a46c",
    "#687076",
  ];
  let mode = $state("image");
  let color = $state(colors[4]!);
  let selectedEmoji = $state("");
  let filename = $state("");
  let error = $state("");
  let reader: FileReader | undefined;
  const fallbackInitials = $derived(initials(fallbackName));
  const fallbackTone = $derived(
    communityMemberAvatarFallbackTone(fallbackName),
  );
  onDestroy(() => reader?.abort());

  function initials(value: string): string {
    const parts = value
      .trim()
      .split(/[\s_-]+/u)
      .filter(Boolean);
    return (
      parts.length > 1
        ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`
        : (parts[0]?.slice(0, 2) ?? "")
    ).toUpperCase();
  }

  function emojiAvatar(emoji: string) {
    selectedEmoji = emoji;
    const safe = emoji
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const radius = shape === "circle" ? 128 : 64;
    value = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="${radius}" fill="${color}"/><text x="128" y="166" font-size="128" text-anchor="middle">${safe}</text></svg>`)}`;
    error = "";
  }
  function readImage(file: File | undefined) {
    if (!file) return;
    error = "";
    if (
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
        file.type,
      )
    ) {
      error = "Choose a PNG, JPEG, GIF, or WebP image.";
      return;
    }
    if (file.size > 1024 * 1024) {
      error = "Choose an image smaller than 1 MB.";
      return;
    }
    reader?.abort();
    const next = new FileReader();
    reader = next;
    next.onload = () => {
      if (reader === next && typeof next.result === "string") {
        value = next.result;
        filename = file.name;
        selectedEmoji = "";
      }
    };
    next.onerror = () => {
      error = "The image could not be read. Try again.";
    };
    next.readAsDataURL(file);
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="community-avatar-picker__trigger"
        data-size={size}
        data-shape={shape}
        aria-label={label}
        {disabled}
      >
        {#if value}<img
            src={value}
            alt="Selected avatar"
          />{:else if fallbackInitials}<span
            class="community-avatar-picker__fallback"
            data-fallback-tone={fallbackTone}
            aria-hidden="true">{fallbackInitials}</span
          >{:else}<PlusIcon aria-hidden="true" />{/if}
      </button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content
    side="bottom"
    align="start"
    sideOffset={12}
    class="community-avatar-picker__content"
    aria-label="Avatar image picker"
  >
    <Tabs.Root bind:value={mode}>
      <Tabs.List aria-label="Avatar type"
        ><Tabs.Trigger value="image">Image</Tabs.Trigger><Tabs.Trigger
          value="emoji">Emoji</Tabs.Trigger
        ></Tabs.List
      >
      <Tabs.Content value="image">
        <label
          class="community-avatar-picker__drop"
          ondragover={(event) => event.preventDefault()}
          ondrop={(event) => {
            event.preventDefault();
            readImage(event.dataTransfer?.files[0]);
          }}
        >
          <UploadCloudIcon aria-hidden="true" /><span
            >{filename || "Drop or browse"}</span
          >
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            aria-label="Upload avatar image"
            onchange={(event) => readImage(event.currentTarget.files?.[0])}
          />
        </label>
        <div class="community-avatar-picker__url">
          <LinkIcon aria-hidden="true" /><Input
            type="url"
            bind:value
            aria-label="Avatar image URL"
            placeholder="Paste a URL"
          />
        </div>
      </Tabs.Content>
      <Tabs.Content value="emoji">
        <div
          class="community-avatar-picker__colors"
          role="group"
          aria-label="Avatar background"
        >
          {#each colors as item}<button
              type="button"
              style={`--avatar-color: ${item}`}
              aria-label={`Use ${item} background`}
              aria-pressed={color === item}
              onclick={() => {
                color = item;
                if (selectedEmoji) emojiAvatar(selectedEmoji);
              }}
            ></button>{/each}
        </div>
        <div
          class="community-avatar-picker__emojis"
          role="group"
          aria-label="Emoji presets"
        >
          {#each emojis as emoji}<button
              type="button"
              aria-label={`Use ${emoji} as avatar`}
              onclick={() => emojiAvatar(emoji)}>{emoji}</button
            >{/each}
        </div>
        <div class="community-avatar-picker__browse">
          <CommunityEmojiPicker
            label="Browse all emoji"
            {communityEmojis}
            onSelect={(emoji, custom) => {
              if (custom) {
                value = custom.url;
                selectedEmoji = "";
              } else emojiAvatar(emoji);
            }}
          /><span>Browse all emoji</span>
        </div>
      </Tabs.Content>
    </Tabs.Root>
    {#if error}<p role="alert">{error}</p>{/if}
  </Popover.Content>
</Popover.Root>

<style>
  .community-avatar-picker__trigger {
    display: grid;
    place-items: center;
    width: 12rem;
    height: 12rem;
    flex: none;
    padding: 0;
    overflow: hidden;
    border: 2px dashed var(--border);
    border-radius: 25%;
    background: var(--background);
    color: var(--foreground);
    cursor: pointer;
  }
  .community-avatar-picker__trigger[data-size="medium"] {
    width: 6rem;
    height: 6rem;
  }
  .community-avatar-picker__trigger[data-shape="circle"] {
    border-radius: 50%;
  }
  .community-avatar-picker__trigger:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .community-avatar-picker__trigger:not(:disabled):hover,
  .community-avatar-picker__trigger:focus-visible {
    background: var(--accent);
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .community-avatar-picker__trigger :global(svg) {
    width: 3rem;
    height: 3rem;
  }
  .community-avatar-picker__trigger img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .community-avatar-picker__fallback {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    border-radius: inherit;
    font-size: var(--community-text-section);
    font-weight: 700;
  }
  .community-avatar-picker__fallback[data-fallback-tone="blue"] {
    color: #ffffff;
    background: #2563eb;
  }
  .community-avatar-picker__fallback[data-fallback-tone="emerald"] {
    color: #ffffff;
    background: #047857;
  }
  .community-avatar-picker__fallback[data-fallback-tone="amber"] {
    color: #451a03;
    background: #fbbf24;
  }
  .community-avatar-picker__fallback[data-fallback-tone="rose"] {
    color: #ffffff;
    background: #e11d48;
  }
  .community-avatar-picker__fallback[data-fallback-tone="cyan"] {
    color: #083344;
    background: #22d3ee;
  }
  .community-avatar-picker__fallback[data-fallback-tone="violet"] {
    color: #ffffff;
    background: #7c3aed;
  }
  .community-avatar-picker__fallback[data-fallback-tone="orange"] {
    color: #ffffff;
    background: #c2410c;
  }
  :global(.community-avatar-picker__content) {
    width: min(23rem, calc(100vw - 2rem));
    padding: 1rem;
    max-height: min(
      var(--bits-popover-content-available-height, 100dvh),
      calc(100dvh - 2rem)
    );
    overflow-y: auto;
  }
  :global(.community-avatar-picker__content [data-slot="tabs-list"]) {
    width: 100%;
  }
  .community-avatar-picker__drop {
    position: relative;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.5rem;
    min-height: 7rem;
    margin-block: 0.75rem;
    border-radius: var(--radius);
    background: var(--muted);
    cursor: pointer;
  }
  .community-avatar-picker__drop input {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
  }
  .community-avatar-picker__drop:focus-within {
    outline: 2px solid var(--ring);
  }
  .community-avatar-picker__url {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .community-avatar-picker__url :global(svg) {
    width: 1rem;
    height: 1rem;
    flex: none;
  }
  .community-avatar-picker__colors,
  .community-avatar-picker__emojis {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 0.375rem;
    margin-block: 0.75rem;
  }
  .community-avatar-picker__colors button,
  .community-avatar-picker__emojis button {
    border: 0;
    border-radius: var(--radius);
    aspect-ratio: 1;
    padding: 0;
    cursor: pointer;
  }
  .community-avatar-picker__colors button {
    background: var(--avatar-color);
  }
  .community-avatar-picker__emojis button {
    background: var(--muted);
    font-size: var(--community-text-section);
  }
  .community-avatar-picker__colors button:focus-visible,
  .community-avatar-picker__colors button[aria-pressed="true"],
  .community-avatar-picker__emojis button:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .community-avatar-picker__emojis button:hover {
    background: var(--accent);
  }
  .community-avatar-picker__browse {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  [role="alert"] {
    color: var(--destructive);
  }
</style>
