<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import type { CommunityChannelCanvasModel } from "@lapismd/lapis-community/components";
  import { CommunityChannelCanvas } from "@lapismd/lapis-community/components";
  let canvas = $state<CommunityChannelCanvasModel>({
    roomId: "project",
    groupId: "project",
    content: "# Original canvas",
    eventId: "first",
    author: "author",
    updatedAt: 100,
    loading: false,
    canEdit: true,
  });
  let saved = $state("");
</script>

<Button
  variant="outline"
  onclick={() => {
    canvas = {
      ...canvas,
      eventId: "second",
      content: "# Remote revision",
      updatedAt: 101,
    };
  }}>Receive remote revision</Button
>
<CommunityChannelCanvas
  {canvas}
  onReload={async () => {}}
  onSave={async (content, expected) => {
    if (expected !== canvas.eventId) throw new Error("Canvas changed");
    saved = content;
    canvas = { ...canvas, content, eventId: "saved", updatedAt: 102 };
  }}
/>
<output aria-label="Saved canvas">{saved}</output>
