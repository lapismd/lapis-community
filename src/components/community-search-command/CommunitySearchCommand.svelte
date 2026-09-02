<script lang="ts">
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import UserIcon from "@lucide/svelte/icons/user";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  let {
    open = $bindable(false),
    query = "",
    rooms = [],
    messages = [],
    members = [],
    onQueryChange = () => {},
    onSelectRoom = () => {},
    onSelectMessage = () => {},
    onSelectMember = () => {},
  }: {
    open?: boolean;
    query?: string;
    rooms?: readonly CommunityRoomModel[];
    messages?: readonly CommunityMessageModel[];
    members?: readonly CommunityMemberModel[];
    onQueryChange?: (query: string) => void;
    onSelectRoom?: (room: CommunityRoomModel) => void;
    onSelectMessage?: (message: CommunityMessageModel) => void;
    onSelectMember?: (member: CommunityMemberModel) => void;
  } = $props();
</script>

<Dialog.Root bind:open
  ><Dialog.Content class="community-search-command"
    ><Dialog.Header
      ><Dialog.Title>Search community</Dialog.Title><Dialog.Description
        >Search rooms, loaded messages, and known members. The relay is queried
        when it supports NIP-50.</Dialog.Description
      ></Dialog.Header
    ><Command.Root value={query}
      ><Command.Input
        value={query}
        placeholder="Search community"
        aria-controls="community-search-command-results"
        oninput={(event) => onQueryChange(event.currentTarget.value)}
      /><Command.List id="community-search-command-results"
        ><Command.Empty>No matching rooms, messages, or people</Command.Empty
        >{#if rooms.length}<Command.Group heading="Rooms"
            >{#each rooms as room (room.id)}<Command.Item
                value={`${room.name} ${room.description ?? ""}`}
                onSelect={() => onSelectRoom(room)}
                ><HashIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />{room.name}</Command.Item
              >{/each}</Command.Group
          >{/if}{#if messages.length}<Command.Group heading="Messages"
            >{#each messages as message (message.id)}<Command.Item
                value={message.content}
                onSelect={() => onSelectMessage(message)}
                ><MessageSquareIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                /><span>{message.content.slice(0, 100)}</span></Command.Item
              >{/each}</Command.Group
          >{/if}{#if members.length}<Command.Group heading="People"
            >{#each members as member (member.id)}<Command.Item
                value={`${member.name} ${member.handle}`}
                onSelect={() => onSelectMember(member)}
                ><UserIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />{member.name}</Command.Item
              >{/each}</Command.Group
          >{/if}</Command.List
      ></Command.Root
    ></Dialog.Content
  ></Dialog.Root
>

<style>
  :global(.community-search-command) {
    width: min(calc(100vw - 2rem), 40rem);
  }
  :global(.community-search-command [data-slot="command-item"] span) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
