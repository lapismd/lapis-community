<script lang="ts">
  let {
    posts = 0,
    reactions = 0,
    participants = 0,
    pluginReactions = 0,
  }: {
    posts?: number;
    reactions?: number;
    participants?: number;
    pluginReactions?: number;
  } = $props();

  const metrics = $derived([
    { label: "posts", value: posts },
    { label: "page reactions", value: reactions },
    { label: "page participants", value: participants },
    { label: "plugin reactions", value: pluginReactions },
  ]);
</script>

<div class="topic-summary" aria-live="polite">
  {#each metrics as metric}
    <div><strong>{metric.value}</strong><span>{metric.label}</span></div>
  {/each}
</div>

<style>
  .topic-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .topic-summary > div {
    display: grid;
    gap: 0.15rem;
    border-block: 1px solid var(--border);
    padding: 1rem;
    text-align: center;
  }

  .topic-summary > div:first-child {
    border-inline-start: 1px solid var(--border);
    border-start-start-radius: var(--radius);
    border-end-start-radius: var(--radius);
  }

  .topic-summary > div:last-child {
    border-inline-end: 1px solid var(--border);
    border-start-end-radius: var(--radius);
    border-end-end-radius: var(--radius);
  }

  .topic-summary > div + div {
    border-left: 1px solid var(--border);
  }

  strong {
    font-size: 1.25rem;
  }

  span {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  @media (max-width: 44rem) {
    .topic-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .topic-summary > div:nth-child(2) {
      border-inline-end: 1px solid var(--border);
      border-start-end-radius: var(--radius);
    }

    .topic-summary > div:nth-child(3) {
      border-inline-start: 1px solid var(--border);
      border-end-start-radius: var(--radius);
      border-top: 0;
    }

    .topic-summary > div:nth-child(4) {
      border-start-end-radius: 0;
      border-top: 0;
    }

    .topic-summary > div:first-child {
      border-end-start-radius: 0;
    }
  }
</style>
