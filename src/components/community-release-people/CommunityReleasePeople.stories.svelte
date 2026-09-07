<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import type { NostrEvent } from "../../protocol/index.js";
  import type { RegistryReleaseReviewEntry } from "../../registry/index.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityReleasePeople from "./CommunityReleasePeople.svelte";

  const people: CommunityMemberModel[] = [
    {
      id: "curator",
      name: "Steve Juma",
      handle: "steve@ju.ma",
      initials: "SJ",
      role: "Registry curator",
      roles: ["registry-curator"],
      presence: "online",
    },
    {
      id: "publisher",
      name: "Lapis Publisher",
      handle: "lapis-publisher",
      initials: "LP",
      role: "Publisher",
      roles: ["publisher"],
      presence: "offline",
    },
  ];

  function event(id: string, pubkey: string): NostrEvent {
    return {
      id,
      pubkey,
      created_at: 1_700_000_000,
      kind: 9,
      tags: [],
      content: id,
      sig: `${id}-signature`,
    };
  }

  const entries: RegistryReleaseReviewEntry[] = [
    {
      releaseEvent: event("release-one", "publisher"),
      inspection: {
        eventId: "release-one",
        state: "approved",
        diagnostics: [],
      },
      curatorDecisionEvents: [event("decision-one", "curator")],
    },
    {
      releaseEvent: event("release-two", "publisher"),
      inspection: {
        eventId: "release-two",
        state: "pending",
        diagnostics: [],
      },
      curatorDecisionEvents: [],
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Registry/Release People",
    component: CommunityReleasePeople,
    tags: ["visual-pending"],
    args: {
      members: people,
      entries,
      completeness: "complete",
      onOpenProfile: fn(),
    },
    parameters: {
      layout: "padded",
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityReleasePeople members={roomMembers} entries={reviewEntries} completeness="complete" onOpenProfile={openProfile} />`,
        },
      },
    },
  });
</script>

<Story
  name="Complete roster"
  play={async ({ canvas, args }) => {
    await expect(canvas.getByText("Steve Juma")).toBeVisible();
    await expect(canvas.getByText("Lapis Publisher")).toBeVisible();
    await expect(
      canvas.getByLabelText("Lapis Publisher authored 2 releases"),
    ).toBeVisible();
    await expect(
      canvas.getByLabelText("Steve Juma signed 1 curator decisions"),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open Steve Juma's profile" }),
    );
    await expect(args.onOpenProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "curator" }),
    );
  }}
/>

<Story name="Partial roster" args={{ completeness: "partial" }} />

<Story
  name="Activity unavailable"
  args={{ entries: [], activityUnavailable: true }}
  play={async ({ canvas }) => {
    await expect(canvas.getAllByText("—", { selector: "span" })).toHaveLength(
      4,
    );
  }}
/>

<Story
  name="Empty roster"
  args={{ members: [], completeness: "unavailable" }}
/>

<Story
  name="Dark mobile"
  globals={{
    colorMode: "dark",
    viewport: { value: "mobile1", isRotated: false },
  }}
/>
