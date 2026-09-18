import { describe, expect, it } from "vitest";

import {
  repositoryLogAuthorFields,
  repositoryLogGravatarUrl,
} from "./repository-log-author.js";

describe("repository log author", () => {
  it("hashes a trimmed lowercase email to a Gravatar identicon", () => {
    const url = repositoryLogGravatarUrl("  Maya@Example.TEST ");
    expect(url).toMatch(
      /^https:\/\/www\.gravatar\.com\/avatar\/[0-9a-f]{32}\?d=identicon&s=80$/u,
    );
    expect(url).toBe(repositoryLogGravatarUrl("maya@example.test"));
    expect(repositoryLogGravatarUrl("")).toBeUndefined();
    expect(repositoryLogGravatarUrl("not-an-email")).toBeUndefined();
  });

  it("projects name, email, timestamp, and Gravatar without changing the email", () => {
    const fields = repositoryLogAuthorFields(
      {
        author: {
          name: "Maya Chen",
          email: "  maya@example.test ",
          timestamp_ms: 1_700_000_000_000,
        },
      },
      1,
    );
    expect(fields).toEqual({
      author: "Maya Chen",
      createdAt: 1_700_000_000,
      authorEmail: "maya@example.test",
      authorAvatarUrl: repositoryLogGravatarUrl("maya@example.test"),
    });
  });

  it("falls back to the committer when the author is unnamed", () => {
    expect(
      repositoryLogAuthorFields(
        {
          author: { email: "" },
          committer: {
            name: "Casey",
            email: "casey@example.test",
            timestamp_ms: 2_000,
          },
        },
        9,
      ),
    ).toEqual({
      author: "Casey",
      createdAt: 2,
      authorEmail: "casey@example.test",
      authorAvatarUrl: repositoryLogGravatarUrl("casey@example.test"),
    });
  });
});
