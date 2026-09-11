<script lang="ts">
  import { CommunityMessage } from "@lapismd/lapis-community/components";
  const author = {
    id: "a".repeat(64),
    name: "Avery",
    handle: "avery",
    initials: "AV",
  };
  let result = $state("");
</script>

<div class="community-ui">
  <CommunityMessage
    {author}
    members={[author]}
    message={{
      id: "example-message",
      authorId: author.id,
      content:
        "A **shared message**. [Read the guide](https://example.com/guide).",
      timestamp: "Just now",
      reactions: [{ emoji: "👍", count: 2 }],
    }}
    onToggleReaction={(_, emoji) => {
      result = emoji;
    }}
    onOpenProfile={(member) => {
      result = `${member.name} profile opened`;
    }}
    onMessageMember={() => {
      result = "Message Avery";
    }}
    onWaveMember={() => {
      result = "Waved to Avery";
    }}
  /><output>{result}</output>
</div>
