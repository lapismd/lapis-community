<script lang="ts">
  import DiscussionTimeline from "./DiscussionTimeline.svelte";

  let currentIndex = $state(18);
  let currentTimestamp = $state(1_700_000_018);
  let seeks = $state(0);
  let pending = $state(false);

  async function jump(index: number): Promise<void> {
    seeks += 1;
    pending = true;
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    currentIndex = index;
    currentTimestamp = 1_700_000_000 + index;
    pending = false;
  }
</script>

<div
  class="timeline-interaction-harness"
  data-testid="timeline-interaction-harness"
  data-seeks={seeks}
  data-pending={pending}
>
  <DiscussionTimeline
    total={260}
    {currentIndex}
    {currentTimestamp}
    firstTimestamp={1_700_000_000}
    lastTimestamp={1_700_000_259}
    returnIndex={176}
    onJump={jump}
    onReturn={() => jump(176)}
  />
</div>

<style>
  .timeline-interaction-harness {
    width: 9rem;
    height: 34rem;
    margin: 2rem;
  }
</style>
