import { describe, expect, it } from "vitest";

import { parseCommunityEntityLink } from "../../community/community-links.js";
import {
  applicationRoomKind,
  locationForCommunityEntityLink,
  locationFromHash,
  locationToHash,
} from "./application-location-hash.js";
import { noCommunityApplicationPanel } from "./navigation.js";

const eventId = "c".repeat(64);
const owner = "d".repeat(64);

describe("application location hash", () => {
  it("round-trips inbox, channels, forums, and threads", () => {
    expect(
      locationToHash({
        destination: "inbox",
        panel: noCommunityApplicationPanel(),
      }),
    ).toBe("#/inbox");
    expect(locationFromHash("#/inbox")).toEqual({
      destination: "inbox",
      panel: noCommunityApplicationPanel(),
    });
    expect(
      locationToHash(
        { destination: "general", panel: noCommunityApplicationPanel() },
        { roomKind: () => "channel" },
      ),
    ).toBe("#/channels/general");
    expect(locationFromHash("#/channels/plugin-development")).toEqual({
      destination: "plugin-development",
      panel: noCommunityApplicationPanel(),
    });
    expect(
      locationToHash(
        {
          destination: "ideas",
          panel: { kind: "thread", roomId: "ideas", rootMessageId: eventId },
        },
        { roomKind: () => "forum" },
      ),
    ).toBe(`#/forums/ideas/${eventId}`);
    expect(locationFromHash(`#/channels/general/${eventId}`)).toEqual({
      destination: "general",
      panel: {
        kind: "thread",
        roomId: "general",
        rootMessageId: eventId,
      },
    });
  });

  it("accepts repository op-log hashes and maps entity links to locations", () => {
    const oplog = locationFromHash(
      `#/projects/repository/30617:${owner}:notes/oplog/${"a".repeat(40)}`,
    );
    expect(oplog?.projectRoute).toEqual({
      kind: "repository",
      coordinate: `30617:${owner}:notes`,
      surface: "oplog",
      commitSha: "a".repeat(40),
    });
    expect(locationToHash(oplog!)).toBe(
      `#/projects/repository/30617:${owner}:notes/oplog/${"a".repeat(40)}`,
    );
    expect(
      locationForCommunityEntityLink({
        kind: "message",
        roomId: "general",
        eventId,
      }),
    ).toEqual({
      destination: "general",
      panel: { kind: "thread", roomId: "general", rootMessageId: eventId },
    });
    const files = parseCommunityEntityLink(
      `lapis-community://repo?owner=${owner}&d=notes&tab=files&branch=${encodeURIComponent("review/npub1example/ab")}`,
    );
    expect(locationForCommunityEntityLink(files!).projectRoute).toEqual({
      kind: "repository",
      coordinate: `30617:${owner}:notes`,
      surface: "files",
      revision: "review/npub1example/ab",
    });
    expect(locationToHash(locationForCommunityEntityLink(files!))).toBe(
      `#/projects/repository/30617:${owner}:notes/${encodeURIComponent("review/npub1example/ab")}/files`,
    );
  });

  it("treats unknown room destinations as channels and skips DMs", () => {
    expect(applicationRoomKind("plugin-development", [])).toBe("channel");
    expect(applicationRoomKind("ideas", [{ id: "ideas", kind: "forum" }])).toBe(
      "forum",
    );
    expect(
      locationToHash(
        { destination: "dm-ada", panel: noCommunityApplicationPanel() },
        { roomKind: () => "direct" },
      ),
    ).toBeNull();
    expect(
      locationToHash({
        destination: "settings",
        panel: noCommunityApplicationPanel(),
      }),
    ).toBeNull();
  });
});
