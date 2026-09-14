<script lang="ts">
  import { CommunityMemberCommand } from "@lapismd/lapis-community/components";
  const members = [
    { id: "ada", name: "Ada Chen", handle: "ada", initials: "AC" },
    { id: "noor", name: "Noor Rahman", handle: "noor", initials: "NR" },
  ];
  let selectedIds = $state<string[]>([]);
</script>

<CommunityMemberCommand
  presentation="inline"
  mode="select"
  {members}
  {selectedIds}
  searchLabel="Search community users"
  selectionLabel="Approved people"
  maxSelected={128}
  onSearch={() => {}}
  onSelect={(member) => {
    selectedIds = selectedIds.includes(member.id)
      ? selectedIds.filter((id) => id !== member.id)
      : [...selectedIds, member.id];
  }}
  onRemove={(member) =>
    (selectedIds = selectedIds.filter((id) => id !== member.id))}
/>
