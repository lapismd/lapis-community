<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fireEvent, fn, waitFor } from "storybook/test";

  import {
    noMorePosts,
    noop,
    storyPosts,
    storyProfiles,
    storyReactions,
  } from "../story-fixtures.js";
  import DiscussionPostStream from "./DiscussionPostStream.svelte";

  const nestedScrollPosts = Array.from({ length: 20 }, (_, index) => {
    const eventId = (index + 16).toString(16).padStart(64, "0");
    return {
      event: {
        ...storyPosts[0]!.event,
        id: eventId,
        sig: eventId.repeat(2),
        created_at: storyPosts[0]!.event.created_at + index,
        content: `Nested scroll post ${index + 1}`,
      },
      content: `Nested scroll post ${index + 1}`,
      rootEventId: eventId,
    };
  });
  const onNestedCurrentPost = fn();

  const { Story } = defineMeta({
    title: "Community/Discussion/Post stream",
    component: DiscussionPostStream,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Flat chronological replies"
  args={{
    posts: storyPosts,
    contextPosts: storyPosts,
    reactions: storyReactions,
    profiles: storyProfiles,
    startIndex: 0,
    total: storyPosts.length,
    activePostId: storyPosts[0].event.id,
    hasPrevious: false,
    hasNext: false,
    loadingPrevious: false,
    loadingNext: false,
    onCurrentPost: noop,
    onPrepend: noMorePosts,
    onAppend: noMorePosts,
    onNavigate: noop,
    onReply: noop,
    onReact: noop,
  }}
  play={async ({ canvas }) => {
    const activePost = canvas.getAllByRole("article")[0]!;
    const activeStyle = getComputedStyle(activePost);
    await expect(Number.parseFloat(activeStyle.marginTop)).toBeGreaterThan(0);
    await expect(Number.parseFloat(activeStyle.marginRight)).toBeGreaterThan(0);
    await expect(Number.parseFloat(activeStyle.marginBottom)).toBeGreaterThan(
      0,
    );
    await expect(Number.parseFloat(activeStyle.marginLeft)).toBeGreaterThan(0);
  }}
/>

<Story
  name="Nested scroll viewport"
  play={async ({ canvas }) => {
    const viewport = canvas.getByTestId("nested-scroll-viewport");
    onNestedCurrentPost.mockClear();
    viewport.scrollTop = viewport.scrollHeight;
    await fireEvent.scroll(viewport);
    await waitFor(() => expect(onNestedCurrentPost).toHaveBeenCalled());
    const lastCall = onNestedCurrentPost.mock.calls.at(-1);
    await expect(lastCall?.[1]).toBe(19);
  }}
>
  {#snippet template()}
    <div
      data-testid="nested-scroll-viewport"
      style="height: 20rem; overflow-y: auto"
    >
      <DiscussionPostStream
        posts={nestedScrollPosts}
        contextPosts={nestedScrollPosts}
        reactions={[]}
        profiles={storyProfiles}
        startIndex={0}
        total={nestedScrollPosts.length}
        activePostId={nestedScrollPosts[0]!.event.id}
        hasPrevious={false}
        hasNext={false}
        loadingPrevious={false}
        loadingNext={false}
        onCurrentPost={onNestedCurrentPost}
        onPrepend={noMorePosts}
        onAppend={noMorePosts}
        onNavigate={noop}
        onReply={noop}
        onReact={noop}
      />
    </div>
  {/snippet}
</Story>
