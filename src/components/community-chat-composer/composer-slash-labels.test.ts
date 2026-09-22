import { describe, expect, it } from "vitest";

import {
  buildCommunityRepoLink,
  buildCommunityTaskLink,
  communityRepositoryCoordinate,
  parseCommunityEntityLink,
} from "../../community/community-links.js";
import type { NostrEvent } from "../../protocol/index.js";
import { KIND_JJ_REVISION } from "../../projects/work-item-filters.js";
import { composerSlashAutocompleteItems } from "./composer-slash-catalog.js";
import {
  composerSlashChangeLabel,
  composerSlashCommitLabel,
  composerSlashEntityLabel,
  composerSlashTruncatedSubject,
} from "./composer-slash-labels.js";
import { snapshotComposerSlashSession } from "./composer-slash-session.js";

const owner =
  "71d67180ba17e749ee825fc8819c9c6ee7003617e1c126504f9b658070ab9224";
const taskId =
  "c3b589fa5713ba25bad6dc095e2de00a4ac8f50050fdea00fc6444e603be1dd1";
const sha = "a".repeat(40);
const changeId = "b".repeat(32);
const subject =
  "Prepare the next Community project milestone for the public preview";

function revisionEvent(): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: owner,
    created_at: 10,
    kind: KIND_JJ_REVISION,
    tags: [["a", communityRepositoryCoordinate(owner, "buzz-world")]],
    content: JSON.stringify({
      schema: "jj-sync/revision",
      commit_id: sha,
      parent_commit_ids: [],
      description: subject,
      change_id_hex: changeId,
    }),
    sig: "f".repeat(128),
  };
}

describe("composer slash captions", () => {
  it("snapshots task titles, commit message plus hash, and oplog change ids", () => {
    const session = snapshotComposerSlashSession({
      rooms: [],
      catalog: {
        projects: [],
        repositories: [
          {
            address: { owner, identifier: "buzz-world" },
            name: "Buzz",
          },
        ],
      },
      workItems: {
        tasks: [
          {
            root: { id: taskId },
            repository: {
              coordinate: communityRepositoryCoordinate(owner, "buzz-world"),
            },
            title: "Awesome",
          },
        ],
      },
      commits: [{ sha, subject }],
      activity: [],
      repositoryCoordinate: communityRepositoryCoordinate(owner, "buzz-world"),
      events: [revisionEvent()],
    });
    expect(session.tasks[0]?.title).toBe("Awesome");
    expect(session.commits[0]).toMatchObject({ sha, subject });
    expect(session.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tab: "log",
          label: composerSlashTruncatedSubject(subject),
          detail: sha.slice(0, 8),
          commit: sha,
        }),
        expect.objectContaining({
          tab: "oplog",
          label: composerSlashChangeLabel(changeId),
          commit: sha,
          changeId,
        }),
      ]),
    );
    const tasks = composerSlashAutocompleteItems("tasks/", session);
    expect(tasks[0]?.label).toBe("Awesome");
    const commits = composerSlashAutocompleteItems("commits/", session);
    expect(commits[0]).toMatchObject({
      label: composerSlashTruncatedSubject(subject),
      detail: sha.slice(0, 8),
    });
    const logs = composerSlashAutocompleteItems("logs/", session);
    expect(logs.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        composerSlashTruncatedSubject(subject),
        composerSlashChangeLabel(changeId),
      ]),
    );
    expect(
      composerSlashEntityLabel(
        parseCommunityEntityLink(
          buildCommunityTaskLink({ owner, d: "buzz-world", id: taskId }),
        )!,
        session,
      ),
    ).toBe("Awesome");
    expect(
      composerSlashEntityLabel(
        parseCommunityEntityLink(
          buildCommunityRepoLink({
            owner,
            d: "buzz-world",
            tab: "commits",
            commit: sha,
          }),
        )!,
        session,
      ),
    ).toBe(composerSlashCommitLabel(subject, sha));
    expect(
      composerSlashEntityLabel(
        parseCommunityEntityLink(
          buildCommunityRepoLink({
            owner,
            d: "buzz-world",
            tab: "log",
            commit: sha,
          }),
        )!,
        session,
      ),
    ).toBe(composerSlashCommitLabel(subject, sha));
    expect(
      composerSlashEntityLabel(
        parseCommunityEntityLink(
          buildCommunityRepoLink({
            owner,
            d: "buzz-world",
            tab: "oplog",
            commit: sha,
          }),
        )!,
        session,
      ),
    ).toBe(composerSlashChangeLabel(changeId));
  });
});
