<script lang="ts">
  import {
    CommunityMemberHoverCard,
    CommunityMemberAvatarGroup,
    CommunityMarkdownContent,
    CommunityChatComposer,
  } from "@lapismd/lapis-community/components";
  import type { CommunityMemberModel } from "@lapismd/lapis-community/components";
  const members: CommunityMemberModel[] = [
    {
      id: "a".repeat(64),
      name: "Avery",
      handle: "avery",
      initials: "AV",
      presence: "online" as const,
    },
    {
      id: "b".repeat(64),
      name: "Blake",
      handle: "blake",
      initials: "BL",
      presence: "away" as const,
    },
    {
      id: "c".repeat(64),
      name: "Casey",
      handle: "casey",
      initials: "CA",
      presence: "offline" as const,
    },
    {
      id: "9".repeat(64),
      name: "Nyra",
      handle: "nyra",
      initials: "NY",
      kind: "agent" as const,
    },
  ];
  let result = $state("Choose an identity or action");
  const actions = {
    onOpenProfile: (member: CommunityMemberModel) => {
      result = `${member.name} profile opened`;
    },
    onMessage: (member: CommunityMemberModel) => {
      result = `Message ${member.name}`;
    },
    onWave: (member: CommunityMemberModel) => {
      result = `Waved to ${member.name}`;
    },
  };
</script>

<div class="community-ui identity-pattern">
  <section aria-label="Avatar identity">
    <h2>Avatar</h2>
    <CommunityMemberHoverCard member={members[0]!} {...actions} />
  </section>
  <section aria-label="Avatar group identity">
    <h2>Avatar group</h2>
    <CommunityMemberAvatarGroup {members} {...actions} />
  </section>
  <section aria-label="Inline identity">
    <h2>Inline mention</h2>
    <CommunityMemberHoverCard
      member={members[0]!}
      trigger="mention"
      {...actions}
    />
  </section>
  <section aria-label="Markdown identity">
    <h2>Markdown mention</h2>
    <CommunityMarkdownContent
      content="Ask @Avery to review this update."
      {members}
      mentionPubkeys={[members[0]!.id]}
      onOpenMember={actions.onOpenProfile}
      onMessageMember={actions.onMessage}
      onWaveMember={actions.onWave}
    />
  </section>
  <section aria-label="Rounded agent identity">
    <h2>Rounded agent avatar</h2>
    <CommunityMemberHoverCard member={members[3]!} {...actions} />
  </section>
  <section aria-label="Composer identity">
    <h2>Composer mention</h2>
    <CommunityChatComposer
      mode="form"
      value="Ask @Avery to review this update."
      {members}
      onOpenMember={actions.onOpenProfile}
      onMessageMember={actions.onMessage}
      onWaveMember={actions.onWave}
    />
  </section>
  <p role="status">{result}</p>
</div>

<style>
  .identity-pattern {
    display: grid;
    gap: 1.5rem;
    padding: 1.5rem;
  }
  section {
    display: grid;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: var(--community-text-section);
  }
</style>
