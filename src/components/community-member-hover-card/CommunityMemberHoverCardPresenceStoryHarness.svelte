<script lang="ts">
  import type {
    CommunityMemberModel,
    CommunityPresence,
  } from "../community-workspace/model.js";
  import CommunityMemberHoverCard from "./CommunityMemberHoverCard.svelte";
  import { provideCommunityMemberPresence } from "./presence-context.js";

  let {
    member,
    presence = "online",
    trigger = "avatar",
    triggerLabel = member.name,
  }: {
    member: CommunityMemberModel;
    presence?: CommunityPresence;
    trigger?: "avatar" | "mention";
    triggerLabel?: string;
  } = $props();

  provideCommunityMemberPresence((candidate) =>
    candidate.id === member.id ? presence : undefined,
  );
</script>

<CommunityMemberHoverCard {member} {trigger} {triggerLabel} openDelay={0} />
