<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import * as Card from "@lapismd/design-core/shadcn/card";

  let {
    name,
    loading = false,
    error = "",
    relayCount = 0,
  }: {
    name: string;
    loading?: boolean;
    error?: string;
    relayCount?: number;
  } = $props();
</script>

<Card.Header class="community-header">
  <div>
    <Card.Title id="community-title">{name} community discussion</Card.Title>
    <Card.Description>
      NIP-29 forum posts, replies, and reactions read directly from the relay.
    </Card.Description>
  </div>
  <Badge variant={loading ? "secondary" : "outline"}>
    {loading
      ? "Syncing"
      : error
        ? "Relay issue"
        : `${relayCount} relay${relayCount === 1 ? "" : "s"}`}
  </Badge>
</Card.Header>

<style>
  :global(.community-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  @media (max-width: 44rem) {
    :global(.community-header) {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
