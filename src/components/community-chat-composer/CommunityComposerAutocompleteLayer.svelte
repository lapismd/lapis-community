<script lang="ts">
  import CommunityComposerMentionPicker from "../community-composer-mention-picker/CommunityComposerMentionPicker.svelte";
  import CommunityComposerSlashPicker from "../community-composer-slash-picker/CommunityComposerSlashPicker.svelte";
  import type {
    CommunityComposerAutocompleteItem,
    CommunityComposerAutocompleteQuery,
  } from "./autocomplete.js";

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
</script>

{#if query.kind === "slash"}
  <CommunityComposerSlashPicker
    {items}
    {selectedIndex}
    {placement}
    bind:listRef
    {onSelect}
  />
{:else}
  <CommunityComposerMentionPicker
    {query}
    {items}
    {selectedIndex}
    {placement}
    {showAutoMention}
    {autoMentionEnabled}
    {lockedAgentPubkeys}
    bind:listRef
    {onSelect}
    {...onAutoMentionChange ? { onAutoMentionChange } : {}}
    {...onToggleAlwaysAddress ? { onToggleAlwaysAddress } : {}}
  />
{/if}
