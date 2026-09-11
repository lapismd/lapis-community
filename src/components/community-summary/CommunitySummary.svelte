<script lang="ts">
  import HeartIcon from "@lucide/svelte/icons/heart";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import PuzzleIcon from "@lucide/svelte/icons/puzzle";
  import UsersIcon from "@lucide/svelte/icons/users";

  let {
    posts = 0,
    postsApproximate = false,
    postsUnavailable = false,
    reactions = 0,
    participants = 0,
    pluginReactions = 0,
  }: {
    posts?: number;
    postsApproximate?: boolean;
    postsUnavailable?: boolean;
    reactions?: number;
    participants?: number;
    pluginReactions?: number;
  } = $props();

  const metrics = $derived([
    {
      icon: MessageSquareIcon,
      label: "posts",
      value: postsApproximate
        ? `~${posts}`
        : postsUnavailable
          ? `${posts}+`
          : posts,
      accessibleValue: postsApproximate
        ? `Approximately ${posts} posts`
        : postsUnavailable
          ? `At least ${posts} loaded posts; total count unavailable`
          : `${posts} posts`,
    },
    { icon: HeartIcon, label: "page reactions", value: reactions },
    { icon: UsersIcon, label: "page participants", value: participants },
    { icon: PuzzleIcon, label: "plugin reactions", value: pluginReactions },
  ]);
</script>

<div class="topic-summary-container">
  <div class="topic-summary" aria-live="polite">
    {#each metrics as metric}
      {@const Icon = metric.icon}
      <div
        class="topic-summary__metric"
        aria-label={metric.accessibleValue ?? `${metric.value} ${metric.label}`}
      >
        <span
          class="topic-summary__icon"
          data-ui-part="summary-icon"
          aria-hidden="true"
        >
          <Icon />
        </span>
        <span class="topic-summary__content">
          <strong>{metric.value}</strong><span>{metric.label}</span>
        </span>
      </div>
    {/each}
  </div>
</div>

<style>
  .topic-summary-container {
    container: topic-summary / inline-size;
  }

  .topic-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .topic-summary__metric {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 7rem);
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border-block: 1px solid var(--border);
    padding: 1rem;
    text-align: left;
  }

  .topic-summary__icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    flex: 0 0 2.75rem;
    place-items: center;
    border-radius: var(--radius);
    background: var(--secondary);
    color: var(--secondary-foreground);
  }

  .topic-summary__icon :global(svg) {
    width: 1.4rem;
    height: 1.4rem;
    stroke-width: 1.75;
  }

  .topic-summary__content {
    display: grid;
    min-width: 0;
    width: 7rem;
    gap: 0.15rem;
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
    font-size: var(--community-text-dialog);
  }

  span {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .topic-summary__icon,
  .topic-summary__content {
    font-size: inherit;
  }

  .topic-summary__content strong {
    color: var(--foreground);
  }

  @container topic-summary (max-width: 44rem) {
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
