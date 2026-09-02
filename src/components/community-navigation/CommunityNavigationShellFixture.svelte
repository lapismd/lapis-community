<script lang="ts">
  import { AppShellTwoExpandedSidebarsReference } from "@lapismd/design-core/storybook/app-shell-reference";
  import { AppShellController } from "@lapismd/design-core/shell";
  import CommunityNavigation from "./CommunityNavigation.svelte";
  import { communityNavigationFixture } from "./story-fixtures.js";
  import type {
    CommunityNavigationItemModel,
    CommunityNavigationSectionActionModel,
    CommunityNavigationSectionModel,
  } from "./model.js";

  let {
    initialActiveItemId = "inbox",
    onSelect = () => {},
    onSearch = () => {},
    onSectionAction = () => {},
  }: {
    initialActiveItemId?: string;
    onSelect?: (item: CommunityNavigationItemModel) => void;
    onSearch?: (query: string) => void;
    onSectionAction?: (
      section: CommunityNavigationSectionModel,
      action: CommunityNavigationSectionActionModel,
    ) => void;
  } = $props();

  const controller = new AppShellController({ rightClosed: true });
  let activeItemId = $state("");

  $effect(() => {
    activeItemId = initialActiveItemId;
  });

  function select(item: CommunityNavigationItemModel): void {
    activeItemId = item.id;
    onSelect(item);
  }
</script>

<AppShellTwoExpandedSidebarsReference {controller} showRightToggle={false}>
  {#snippet leftSidebar(referenceController)}
    <CommunityNavigation
      model={communityNavigationFixture}
      {activeItemId}
      compact={referenceController.left.collapsed}
      onSelect={select}
      {onSearch}
      {onSectionAction}
      onRequestExpand={() => referenceController.left.expand()}
    />
  {/snippet}
</AppShellTwoExpandedSidebarsReference>
