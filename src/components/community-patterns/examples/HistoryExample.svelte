<script lang="ts">
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import { CommunityHistoryEdge } from "@lapismd/lapis-community/components";
  import type { CommunityHistoryState } from "@lapismd/lapis-community/community";
  let viewport = $state<HTMLElement | null>(null);
  let requests = $state(0);
  let history = $state<CommunityHistoryState>({
    key: "inbox",
    loading: false,
    hasOlder: true,
    hasNewer: false,
    complete: false,
  });
</script>

<output aria-label="Page requests">{requests}</output>
<div style="height: 240px; display: flex;">
  <ScrollArea bind:viewportRef={viewport} style="flex: 1; min-height: 0;">
    <div style="height: 1600px;">Previously loaded conversation summaries</div>
    <CommunityHistoryEdge
      {history}
      {viewport}
      onLoad={async () => {
        requests++;
        history = { ...history, loading: true };
        try {
          await new Promise((resolve) => setTimeout(resolve, 30));
          if (requests === 2) throw new Error("Relay unavailable");
        } finally {
          history = { ...history, loading: false };
        }
      }}
    />
  </ScrollArea>
</div>
