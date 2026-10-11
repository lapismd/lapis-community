import {
  defineConfig,
  singleIdVerification,
  tableRequirements,
} from "@lapismd/spec-validator";

export default defineConfig(tableRequirements(), {
  name: "lapis-community",
  idPattern: /^LC-(?:ARCH|NOSTR|OPS|SPEC|UI)-\d{3}$/,
  ruleIds: {
    summary: "LC-SPEC-001",
    governance: "LC-SPEC-003",
    verification: "LC-SPEC-003",
    book: "LC-SPEC-001",
    bookIgnore: "LC-SPEC-001",
    packageManifest: "LC-ARCH-004",
    specFirst: "LC-SPEC-002",
    internal: "LC-SPEC-003",
  },
  validators: {
    summary: true,
    governance: {
      acceptance: false,
      normative: true,
      proseLimits: false,
      references: true,
      changeMap: false,
    },
    verification: singleIdVerification({
      headers: {
        ids: ["ID"],
        status: ["Status"],
        evidence: ["Evidence"],
        required: [],
      },
      statuses: ["Implemented", "Planned", "Visual pending"],
    }),
    book: true,
    specFirst: {
      mode: "mapped",
      canonicalPattern:
        "^spec/src/(?:architecture|nostr-protocol|components|registry-pipeline|spec-governance|agents|deferred-work)\\.md$",
      ignore: [
        "(^|/)node_modules/",
        "(^|/)(?:dist|storybook-static)/",
        "^spec/book/",
        "^spec/src/(?:SUMMARY|index|verification)\\.md$",
        "\\.(?:test|stories)\\.[cm]?[jt]sx?$",
        "\\.stories\\.svelte$",
      ],
      rules: [
        {
          pattern: "^\\.github/workflows/publish-spec-pages\\.yml$",
          chapters: ["spec/src/spec-governance.md"],
        },
        {
          pattern: "^docs/plans/",
          chapters: ["spec/src/architecture.md"],
        },
        {
          pattern: "^scripts/(?:check-architecture|architecture)",
          chapters: ["spec/src/architecture.md"],
        },
        {
          pattern:
            "^src/(?:index\\.ts$|auth/|community/|nostr/|projects/|protocol/|testing/)",
          chapters: ["spec/src/nostr-protocol.md", "spec/src/architecture.md"],
        },
        {
          pattern: "^dev/",
          chapters: ["spec/src/architecture.md", "spec/src/spec-governance.md"],
        },
        {
          pattern: "^src/(?:components|registry)/",
          chapters: ["spec/src/components.md"],
        },
        {
          pattern: "^(?:src/(?:fixture|materializer)/|deploy/|scripts/|docs/)",
          chapters: ["spec/src/registry-pipeline.md"],
        },
        {
          pattern:
            "^(?:package\\.json$|pnpm-(?:lock\\.yaml$|workspace\\.yaml$)|vite(?:\\.community)?\\.config\\.ts$|tsconfig|\\.storybook/|AGENTS\\.md$|README\\.md$|spec-validator\\.config\\.mjs$)",
          chapters: ["spec/src/spec-governance.md", "spec/src/architecture.md"],
        },
      ],
      protected: [
        "^\\.github/workflows/publish-spec-pages\\.yml$",
        "^(?:package\\.json$|pnpm-(?:lock\\.yaml$|workspace\\.yaml$)|src/|dev/|deploy/|scripts/|docs/|\\.storybook/|vite(?:\\.community)?\\.config\\.ts$|tsconfig|AGENTS\\.md$|README\\.md$|spec-validator\\.config\\.mjs$)",
      ],
    },
  },
  check: {
    lanes: [
      { name: "UI reuse", command: "node", args: ["scripts/check-ui.mjs"] },
      {
        name: "community chips",
        command: "node",
        args: ["scripts/check-community-chips.mjs"],
      },
      {
        name: "deferred work",
        command: "node",
        args: ["scripts/check-deferred-work.mjs"],
      },
      {
        name: "architecture",
        command: "node",
        args: ["scripts/check-architecture.mjs"],
      },
    ],
  },
});
