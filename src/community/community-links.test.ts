import { describe, expect, it } from "vitest";

import {
  communityEntityLinkMatches,
  communityEntityLinkPresentation,
  entityLinkFromApplicationHash,
  normalizeCommunityEntityHref,
} from "./community-link-normalize.js";
import {
  buildCommunityChannelLink,
  buildCommunityMessageLink,
  buildCommunityProjectLink,
  buildCommunityRepoLink,
  communityEntityLinkHref,
  communityProjectCoordinate,
  communityRepositoryCoordinate,
  parseCommunityEntityLink,
} from "./community-links.js";

const owner =
  "71d67180ba17e749ee825fc8819c9c6ee7003617e1c126504f9b658070ab9224";
const eventId =
  "c3b589fa5713ba25bad6dc095e2de00a4ac8f50050fdea00fc6444e603be1dd1";
const commit = "a".repeat(40);

const golden = {
  channel: "lapis-community://channel/plugin-development",
  message: `lapis-community://message?channel=plugin-development&id=${eventId}`,
  thread: `lapis-community://message?channel=plugin-development&id=${eventId}&thread=${"b".repeat(64)}`,
  project: `lapis-community://project?owner=${owner}&d=buzz-world`,
  repo: `lapis-community://repo?owner=${owner}&d=buzz-world`,
  log: `lapis-community://repo?owner=${owner}&d=buzz-world&tab=log&commit=${commit}`,
  oplog: `lapis-community://repo?owner=${owner}&d=buzz-world&tab=oplog`,
  commit: `lapis-community://repo?owner=${owner}&d=buzz-world&tab=commits&commit=${eventId}`,
};

describe("community entity links", () => {
  it("builds and parses Buzz-shaped scheme URIs", () => {
    expect(buildCommunityChannelLink("plugin-development")).toBe(
      golden.channel,
    );
    expect(
      buildCommunityMessageLink({
        roomId: "plugin-development",
        eventId,
      }),
    ).toBe(golden.message);
    expect(
      buildCommunityMessageLink({
        roomId: "plugin-development",
        eventId,
        threadRootId: "b".repeat(64),
      }),
    ).toBe(golden.thread);
    expect(buildCommunityProjectLink({ owner, d: "buzz-world" })).toBe(
      golden.project,
    );
    expect(buildCommunityRepoLink({ owner, d: "buzz-world" })).toBe(
      golden.repo,
    );
    expect(
      buildCommunityRepoLink({
        owner,
        d: "buzz-world",
        tab: "log",
        commit,
      }),
    ).toBe(golden.log);
    expect(parseCommunityEntityLink(golden.message)).toEqual({
      kind: "message",
      roomId: "plugin-development",
      eventId,
    });
    expect(
      communityEntityLinkHref(parseCommunityEntityLink(golden.thread)!),
    ).toBe(golden.thread);
  });

  it("normalizes hashes and absolute Community URLs into the scheme", () => {
    expect(normalizeCommunityEntityHref("#/channels/plugin-development")).toBe(
      golden.channel,
    );
    expect(
      normalizeCommunityEntityHref(`#/channels/plugin-development/${eventId}`),
    ).toBe(golden.message);
    expect(
      normalizeCommunityEntityHref(`#/forums/plugin-development/${eventId}`),
    ).toBe(golden.message);
    expect(
      normalizeCommunityEntityHref(
        `https://local-community.lapis.md/#/channels/plugin-development/${eventId}`,
      ),
    ).toBe(golden.message);
    expect(
      normalizeCommunityEntityHref(
        `#/projects/repository/${communityRepositoryCoordinate(owner, "buzz-world")}/log/${commit}`,
      ),
    ).toBe(golden.log);
    expect(
      normalizeCommunityEntityHref(
        `#/projects/repository/${communityRepositoryCoordinate(owner, "buzz-world")}/oplog`,
      ),
    ).toBe(golden.oplog);
    expect(
      entityLinkFromApplicationHash(
        `#/projects/project/${communityProjectCoordinate(owner, "buzz-world")}`,
      ),
    ).toEqual({ kind: "project", owner, d: "buzz-world" });
  });

  it("derives chip presentation from kind and tab", () => {
    expect(
      communityEntityLinkPresentation({
        kind: "message",
        roomId: "general",
        eventId,
      }),
    ).toMatchObject({ linkKind: "message", icon: "message-circle" });
    expect(
      communityEntityLinkPresentation({
        kind: "repo",
        owner,
        d: "buzz-world",
        tab: "log",
      }),
    ).toMatchObject({ linkKind: "log", icon: "git-commit-horizontal" });
    expect(
      communityEntityLinkPresentation({
        kind: "repo",
        owner,
        d: "buzz-world",
        tab: "oplog",
      }),
    ).toMatchObject({ linkKind: "oplog", icon: "history" });
    expect(
      communityEntityLinkPresentation({
        kind: "repo",
        owner,
        d: "buzz-world",
        tab: "commits",
        commit: eventId,
      }),
    ).toMatchObject({ linkKind: "commit", icon: "git-commit-horizontal" });
    expect(
      communityEntityLinkPresentation({
        kind: "repo",
        owner,
        d: "buzz-world",
        tab: "commits",
      }),
    ).toMatchObject({ linkKind: "repository", icon: "folder-git-2" });
  });

  it("finds bare scheme, hash, and absolute links in prose", () => {
    const content = `See ${golden.message} and https://local-community.lapis.md/#/channels/general plus #/projects/project/${communityProjectCoordinate(owner, "notes")}.`;
    expect(
      communityEntityLinkMatches(content).map((item) => item.href),
    ).toEqual([
      golden.message,
      "lapis-community://channel/general",
      `lapis-community://project?owner=${owner}&d=notes`,
    ]);
  });
});
