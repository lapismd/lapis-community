<script lang="ts">
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import BotIcon from "@lucide/svelte/icons/bot";
  import PinIcon from "@lucide/svelte/icons/pin";
  import SmileIcon from "@lucide/svelte/icons/smile";

  import CommunityComposerRoomIcon from "../community-composer-room-icon/CommunityComposerRoomIcon.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityComposerAutocompleteItem } from "../community-chat-composer/autocomplete.js";
  import type { CommunityComposerAutocompleteQuery } from "../community-chat-composer/autocomplete.js";
  import "./CommunityComposerMentionPicker.css";

  let {
    query,
    items,
    selectedIndex = 0,
    placement = "above",
    showAutoMention = false,
    autoMentionEnabled = false,
    lockedAgentPubkeys = [],
    listRef = $bindable(null),
    onSelect,
    onAutoMentionChange,
    onToggleAlwaysAddress,
  }: {
    query: CommunityComposerAutocompleteQuery;
    items: readonly CommunityComposerAutocompleteItem[];
    selectedIndex?: number;
    placement?: "above" | "below";
    showAutoMention?: boolean;
    autoMentionEnabled?: boolean;
    lockedAgentPubkeys?: readonly string[];
    listRef?: HTMLDivElement | null;
    onSelect: (index: number) => void;
    onAutoMentionChange?: (enabled: boolean) => void;
    onToggleAlwaysAddress?: (pubkey: string) => void;
  } = $props();

  const pickerId = $props.id();
  const switchId = `${pickerId}-auto-mention`;
  const locked = $derived(new Set(lockedAgentPubkeys));
  const label = $derived(
    query.kind === "member"
      ? "People"
      : query.kind === "room"
        ? "Channels"
        : "Emoji",
  );
  const pinItems = $derived(
    onToggleAlwaysAddress === undefined
      ? []
      : items.filter((item) => item.member?.kind === "agent" && item.member),
  );
</script>

<div
  class="community-composer-mention-picker"
  data-ui-component="community-composer-mention-picker"
  data-ui-part="composer-autocomplete-layer"
  data-kind={query.kind}
  data-placement={placement}
>
  {#if showAutoMention && onAutoMentionChange}
    <div
      class="community-composer-mention-picker__setting"
      data-ui-part="auto-mention-setting"
    >
      <label
        class="community-composer-mention-picker__setting-copy"
        for={switchId}
      >
        <span>Automatically mention agents</span>
        <small>Address selected agents in thread replies</small>
      </label>
      <Switch
        id={switchId}
        checked={autoMentionEnabled}
        aria-label="Automatically mention agents"
        onCheckedChange={(checked) => onAutoMentionChange(checked === true)}
      />
    </div>
  {/if}
  <ScrollArea
    bind:ref={listRef}
    class="community-composer-mention-picker__list"
    orientation="vertical"
    onpointerdown={(event) => event.preventDefault()}
  >
    <div
      class="community-composer-mention-picker__body"
      data-pins={pinItems.length > 0 ? "true" : "false"}
    >
      <div
        class="community-composer-mention-picker__options"
        role="listbox"
        tabindex="-1"
        aria-label={`${label} suggestions`}
      >
        {#each items as item, index (item.id)}
          {@const agent = item.member?.kind === "agent"}
          <button
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            tabindex="-1"
            class={[
              "community-composer-mention-picker__option",
              index === selectedIndex &&
                "community-composer-mention-picker__option--selected",
            ]}
            onclick={() => onSelect(index)}
          >
            <span class="community-composer-mention-picker__icon">
              {#if item.member}
                <CommunityMemberAvatar
                  member={item.member}
                  size="small"
                  decorative
                />
              {:else if item.room}
                <CommunityComposerRoomIcon room={item.room} />
              {:else if item.customEmoji}
                <img
                  src={item.customEmoji.url}
                  alt={`:${item.customEmoji.shortcode}:`}
                />
              {:else if item.native}
                <span aria-hidden="true">{item.native}</span>
              {:else}
                <SmileIcon aria-hidden="true" />
              {/if}
            </span>
            <span class="community-composer-mention-picker__copy">
              <strong
                >{item.kind === "member"
                  ? `@${item.label}`
                  : item.kind === "room"
                    ? `#${item.label}`
                    : `:${item.label}:`}</strong
              >
              {#if item.detail && item.kind !== "room"}
                <small>
                  {#if agent}<BotIcon aria-hidden="true" />{/if}
                  {item.detail}
                </small>
              {/if}
            </span>
          </button>
        {/each}
      </div>
      {#if pinItems.length > 0 && onToggleAlwaysAddress}
        <div
          class="community-composer-mention-picker__pins"
          role="group"
          aria-label="Automatically mention agents in this thread"
        >
          {#each items as item (item.id)}
            {#if item.member?.kind === "agent" && item.member}
              {@const pinned = locked.has(item.member.id)}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={pinned
                  ? `Don't automatically mention ${item.member.name} in this thread`
                  : `Automatically mention ${item.member.name}`}
                title={pinned
                  ? "Don't automatically mention in this thread"
                  : "Automatically mention"}
                aria-pressed={pinned}
                data-ui-part="always-address"
                onclick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleAlwaysAddress(item.member!.id);
                }}
              >
                <PinIcon
                  aria-hidden="true"
                  fill={pinned ? "currentColor" : "none"}
                />
              </Button>
            {:else}
              <span
                class="community-composer-mention-picker__pin-spacer"
                aria-hidden="true"
              ></span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </ScrollArea>
</div>
