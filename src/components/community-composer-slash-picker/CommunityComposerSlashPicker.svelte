<script lang="ts">
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";

  import type { CommunityComposerAutocompleteItem } from "../community-chat-composer/autocomplete.js";
  import CommunityComposerRoomIcon from "../community-composer-room-icon/CommunityComposerRoomIcon.svelte";
  import CommunityEntityChipIcon from "../community-entity-chip/CommunityEntityChipIcon.svelte";
  import "../community-composer-mention-picker/CommunityComposerMentionPicker.css";
  import { slashItemIcon, slashPickerHeading } from "./slash-picker-rows.js";

  let {
    items,
    selectedIndex = 0,
    placement = "above",
    listRef = $bindable(null),
    onSelect,
  }: {
    items: readonly CommunityComposerAutocompleteItem[];
    selectedIndex?: number;
    placement?: "above" | "below";
    listRef?: HTMLDivElement | null;
    onSelect: (index: number) => void;
  } = $props();

  const heading = $derived(slashPickerHeading(items[0]));
</script>

<div
  class="community-composer-mention-picker"
  data-ui-component="community-composer-slash-picker"
  data-ui-part="composer-autocomplete-layer"
  data-kind="slash"
  data-placement={placement}
>
  <div
    bind:this={listRef}
    class="community-composer-mention-picker__list"
    data-ui-component="scroll-area"
    role="presentation"
    onpointerdown={(event) => event.preventDefault()}
  >
    <CommandView.Root label={heading} loop shouldFilter={false}>
      <CommandView.List>
        <CommandView.Empty>No matching {heading}.</CommandView.Empty>
        <CommandView.Group {heading}>
          {#each items as item, index (item.id)}
            <CommandView.Item
              value={item.id}
              aria-selected={index === selectedIndex}
              data-selected={index === selectedIndex ? "" : undefined}
              onSelect={() => onSelect(index)}
            >
              <CommandView.ItemIcon>
                {#if item.room}
                  <CommunityComposerRoomIcon room={item.room} />
                {:else}
                  <CommunityEntityChipIcon icon={slashItemIcon(item)} />
                {/if}
              </CommandView.ItemIcon>
              <CommandView.ItemLabel>{item.label}</CommandView.ItemLabel>
              {#if item.detail && !item.room}
                <CommandView.ItemDescription
                  >{item.detail}</CommandView.ItemDescription
                >
              {/if}
            </CommandView.Item>
          {/each}
        </CommandView.Group>
      </CommandView.List>
    </CommandView.Root>
  </div>
</div>
