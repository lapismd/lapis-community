import { describe, expect, it } from "vitest";

import { buildCommunityTaskLink } from "../../community/community-links.js";
import { detectCommunityComposerAutocomplete } from "./autocomplete.js";
import { communityComposerAutocompleteInsert } from "./composer-mention-insert.js";
import {
  composerSlashAutocompleteItems,
  mergeComposerSlashCatalog,
  type ComposerSlashCatalog,
} from "./composer-slash-catalog.js";
import {
  composerSlashCategoryRewrite,
  detectComposerSlash,
  parseComposerSlashQuery,
} from "./composer-slash.js";

const owner =
  "71d67180ba17e749ee825fc8819c9c6ee7003617e1c126504f9b658070ab9224";
const taskId =
  "c3b589fa5713ba25bad6dc095e2de00a4ac8f50050fdea00fc6444e603be1dd1";

const catalog: ComposerSlashCatalog = {
  rooms: [{ id: "general", name: "general", kind: "channel" }],
  projects: [],
  repositories: [],
  tasks: [{ owner, d: "buzz-world", id: taskId, title: "Awesome" }],
  commits: [],
  logs: [],
};

describe("composer slash completion", () => {
  it("detects / and /tasks/awesome after whitespace", () => {
    expect(detectComposerSlash("", 1, "/")).toEqual({
      kind: "slash",
      query: "",
      from: 0,
      to: 1,
    });
    expect(parseComposerSlashQuery("")).toEqual({
      stage: "category",
      filter: "",
    });
    expect(parseComposerSlashQuery("ta")).toEqual({
      stage: "category",
      filter: "ta",
    });
    expect(parseComposerSlashQuery("tasks")).toEqual({
      stage: "entry",
      kind: "tasks",
      filter: "",
    });
    expect(parseComposerSlashQuery("tasks/awesome")).toEqual({
      stage: "entry",
      kind: "tasks",
      filter: "awesome",
    });
    expect(
      detectCommunityComposerAutocomplete("See /tasks/aw", 13, []),
    ).toMatchObject({
      kind: "slash",
      query: "tasks/aw",
    });
  });

  it("rewrites a category and inserts a task URI", () => {
    expect(composerSlashCategoryRewrite("tasks")).toBe("/tasks/");
    const categories = composerSlashAutocompleteItems("ta", catalog);
    expect(categories.map((item) => item.label)).toEqual(["Tasks"]);
    expect(communityComposerAutocompleteInsert(categories[0]!)).toBe("/tasks/");
    const tasks = composerSlashAutocompleteItems("tasks/awesome", catalog);
    expect(tasks).toHaveLength(1);
    expect(communityComposerAutocompleteInsert(tasks[0]!)).toBe(
      `${buildCommunityTaskLink({ owner, d: "buzz-world", id: taskId })} `,
    );
  });

  it("lists channel rows with rooms and without Forum or Channel detail", () => {
    const channels = composerSlashAutocompleteItems("channels/", {
      ...catalog,
      rooms: [
        { id: "general", name: "general", kind: "channel" },
        { id: "ideas", name: "plugin-ideas", kind: "forum" },
      ],
    });
    expect(
      channels.map((item) => ({
        label: item.label,
        detail: item.detail,
        kind: item.room?.kind,
      })),
    ).toEqual([
      { label: "general", detail: undefined, kind: "channel" },
      { label: "plugin-ideas", detail: undefined, kind: "forum" },
    ]);
  });

  it("keeps project-channel icons from composer rooms on slash rows", () => {
    const merged = mergeComposerSlashCatalog(
      [
        {
          id: "general",
          name: "general",
          kind: "channel",
          isProjectChannel: true,
        },
      ],
      catalog,
    );
    const channels = composerSlashAutocompleteItems("channels/", merged);
    expect(channels[0]?.room?.isProjectChannel).toBe(true);
  });
});
