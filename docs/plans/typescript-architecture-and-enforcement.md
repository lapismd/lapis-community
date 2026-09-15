# TypeScript architecture and enforcement

**Status:** P0–P2 implemented in workspaces `arch-p0` / `arch-p1` / `arch-p2`.
P3 Application and Projects destination hosts are implemented in workspace
`arch-p3`. P4–P5 remain planned.

**Kind of statements:** **Fact** is observed in this checkout. **Recommendation**
is a chosen policy. **Assumption** is used only where evidence is missing.

## 1. Executive recommendation

This package already has a real architecture: one publishable
`@lapismd/lapis-community` tree under `src/`, with named owners
`auth`, `nostr`, `protocol`, `community`, `components`, `projects`,
`registry`, `fixture`, `materializer`, and `testing` (LC-ARCH-001–004).
The failure mode is not missing folders. It is **unbounded growth inside
a few composition and orchestration modules**, plus a **type-ownership
inversion** between `src/community` and `src/components`.

**Observed problems**

- **85 production source files** already exceed 300 counted lines; **54**
  exceed 500. The worst files mix several reasons to change.
- `src/community/` is a flat 39-source-file directory mixing controller
  runes, NIP-29 sessions, materialization, event stores, agents, and
  history cache.
- `createCommunityController` is one Svelte 5 rune factory of **4,673
  counted lines**. `CommunityApplication.svelte` is **9,118 counted
  lines** (script **4,979** + markup **3,421** + style **818** physical).
  Both changed together in recent history (agents, Inbox, canvases,
  history, unread).
- Domain projection types live under `src/components` and are imported
  (type-only) by `src/community`. That is the wrong owner, even though
  it is not a runtime cycle.
- There is **no ESLint, Biome, Oxlint, or dependency-cruiser**. Structure
  is enforced only by review, `svelte-check`, `tsc`, and custom UI-policy
  scripts. File size and layering can grow without a gate.

**Chosen approach**

1. **Do not** introduce a new framework, nested workspace packages, or a
   generic `domain/application/infrastructure` tree. LC-ARCH-001 forbids
   nested packages. Keep the existing feature names.
2. **Do not** use ESLint `max-lines` as the file-size gate. That rule
   cannot implement no-growth (one violation remains one violation as a
   file grows 600→900 lines). ESLint bulk suppressions have the same
   limitation. **Recommendation:** a repository-owned checker, in the
   same style as `scripts/ui-policy.mjs`, owns counted-line budgets,
   the dependency matrix, and runtime cycles.
3. **Do not** rewrite the rune controller into a class or add a state
   library. Extractions must remain `.svelte.ts` where they use `$state`
   / `$derived`.
4. Land a **no-new-debt ratchet first**, then invert type ownership,
   then extract the highest-value responsibilities from the three
   composition hotspots.

**First implementation slice (P0):** LC-ARCH-028 (Planned → Implemented),
spec-first mapping for `docs/plans/`, `scripts/check-architecture.mjs` +
baseline + fixture tests, `pnpm check:architecture` wired into `pnpm check`
and `pnpm spec:check`, and a short AGENTS.md pointer. That slice blocks
new oversized files and hotspot growth **without** moving production
modules.

## 2. Repository facts and audit scope

### 2.1 Audited revision

| Item                | Value                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Parent commit       | `c5b50ca9b4c91056f96d530245df83caae3a27a6` (`xxumttvr`) `feat(community): add compatible cached history and controlled unread timelines` |
| Working copy        | `mqlpqsml` `17b04eb3` (undescribed)                                                                                                      |
| Date                | 2026-09-14                                                                                                                               |
| Node (this machine) | v24.10.0                                                                                                                                 |
| pnpm                | 10.32.1 (matches `packageManager`)                                                                                                       |

**Working-tree files not part of this plan** (leave them alone):

`src/community/cache-access-order.ts`, `cache-accounting-sql.ts`,
`cache-accounting.test.ts`, `event-store.ts`, `indexeddb-event-store.ts`,
`turso-event-store.ts`, history/agent-archive tests, and related
`spec/src/architecture.md` / `verification.md` edits. Those files
already show the intended extraction pattern (cache accounting pulled
out of store adapters). Line counts in this audit **include** those
uncommitted files.

### 2.2 Toolchain (facts)

| Concern             | Evidence                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package             | Single package `@lapismd/lapis-community` `0.1.0`; `type: module`; `engines.node >= 22`                                                                                                                                                                          |
| Workspace           | `pnpm-workspace.yaml` contains only `overrides` (no nested packages)                                                                                                                                                                                             |
| Lockfile            | `pnpm-lock.yaml`; `.npmrc` `link-workspace-packages=true`                                                                                                                                                                                                        |
| Local hook          | `.pnpmfile.cjs` may substitute `@lapismd/design-core` from a sibling tarball when present. Lockfile in this checkout resolves `file:../design-core/.local/packages/lapismd-design-core-0.1.2.tgz`. Declared range remains `^0.1.2`.                              |
| Language            | TypeScript `~5.8.3` locked **5.8.3**; ESM with `.js` specifiers in TS imports                                                                                                                                                                                    |
| UI                  | Svelte **5.56.9** (peer `^5.0.0`); no `svelte.config.js`                                                                                                                                                                                                         |
| Build               | `@sveltejs/package` 2.5.0, Vite **6.4.2**, `@sveltejs/vite-plugin-svelte` 5.1.1                                                                                                                                                                                  |
| Types               | `svelte-check` **4.3.1** `--fail-on-warnings`; `tsc -p tsconfig.node.json --noEmit`                                                                                                                                                                              |
| Compiler flags      | `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` in `tsconfig.app.json`. **Do not** propose further strictness without a measured error inventory.                                                                           |
| Format              | Prettier **3.3.3** + `prettier-plugin-svelte` ^3.5.2. **Formatter authority.**                                                                                                                                                                                   |
| Tests               | Vitest **4.1.8** (`unit` + `storybook` projects); Playwright 1.61.1                                                                                                                                                                                              |
| Spec                | `@lapismd/spec-validator` 0.1.0; mdBook via `pnpm spec:check`                                                                                                                                                                                                    |
| Structure lint      | **None.** No `eslint.config.*`, Biome, Oxlint, Knip, or dependency-cruiser config. `typescript-eslint` appears only as a **transitive** lockfile name, not a repo dependency.                                                                                    |
| Custom policy       | `scripts/check-ui.mjs` (Svelte compiler + TypeScript AST), `scripts/check-community-chips.mjs`, `scripts/check-deferred-work.mjs`                                                                                                                                |
| Alias               | `tsconfig.app.json` paths: `@lapismd/lapis-community/components` → `src/components/index.ts`                                                                                                                                                                     |
| Public exports      | `.`, `./auth`, `./nostr`, `./protocol`, `./projects`, `./components`, `./community`, `./registry`, `./registry/nip29`, `./testing`, `./client/registry-community.js`                                                                                             |
| Generated / ignored | `dist/`, `storybook-static/`, `spec/book/`, `.svelte-kit/`, `.local/`, `.cache/`                                                                                                                                                                                 |
| CI workflows        | **None in this repository.** `package.json` repository URL is GitHub. **Assumption:** validation is currently local (`pnpm checks`). Required-check settings on the host were **not** verified.                                                                  |
| Agent instructions  | Root `AGENTS.md` only. No `CLAUDE.md`, no `.cursor/rules`, no nested `AGENTS.md`. Canonical requirements live in `spec/src`. Cursor and other agents that load `AGENTS.md` will see root guidance; they will not discover this plan unless `AGENTS.md` links it. |
| Hooks               | No Husky/Lefthook/pre-commit. CI must not depend on hooks.                                                                                                                                                                                                       |

**Coverage gaps (facts)**

- `tsconfig.app.json` (svelte-check) **excludes** `src/**/*.test.ts` and
  `**/*.stories.svelte`.
- `tsconfig.node.json` (tsc) includes `src/**/*.ts` and scripts, **excludes**
  `*.svelte` and `*.stories.svelte`.
- Story `.svelte` files and Svelte tests are therefore outside both type
  commands. Interaction coverage is Vitest Storybook, not `svelte-check`.
- `check:ui` scans `src/components` production files only (skips stories,
  tests, `*Harness.svelte`, `*Fixture.svelte`).

### 2.3 Instruction hierarchy (facts)

1. `spec/src/*.md` — canonical MUST requirements + verification matrix.
2. `AGENTS.md` — agent operating rules (UI catalog, spec-first, jj commits).
3. `README.md` / `docs/` — operator docs; `docs/` is spec-first **protected**
   and currently mapped to `spec/src/registry-pipeline.md`.
4. `spec-validator.config.mjs` — spec-first path → chapter map and check lanes.

**Inconsistency:** architecture policy for TypeScript organisation does not
exist as a requirement. UI composition **is** machine-enforced; file size
and feature layering are not. This plan should become LC-ARCH-028 and a
short AGENTS.md pointer, not a second competing architecture story.

### 2.4 Audit method and limitations

**Counted lines:** physical lines minus blank (`trim() === ""`) minus
comment-only lines (`//`, `/* */` including interior, `<!-- -->`, leftover
`*` block-comment lines). Mixed comment+code lines count as code.

**Svelte:** the same function is applied to the whole file. Script, markup,
and style regions were also split by `<script>` / `<style>` tags for
reporting. Markup and style **count** toward the file budget because they
are production UI ownership, not generated output.

**Functions:** brace-matched `function` / `const x = (` in `.ts` files only.
Nested methods inside `createCommunityController` were **not** fully
measured (the factory itself is 4,673 counted lines). Class method lengths
in `CommunityAgentsController` were not exhaustively measured; the class
body is ~1,800 physical lines plus parsers.

**Imports:** relative specifiers resolved against the importing file;
`import type` vs value distinguished by TypeScript-style `type` keyword
and `import("./x")` type queries. Literal `import()` of
`@tursodatabase/database-wasm/bundle` is a real dynamic import. Computed
`import()` was not found in production source.

**Unreviewed in depth:** most component folders under 300 lines; most
stories; Docker/scripts beyond policy checkers; `src/fixture` and
`src/materializer` internals; every `CommunityProjects.svelte` surface
branch; CSS-only files.

**Not run:** `pnpm test`, `pnpm test:storybook`, Docker lanes, `pnpm build`,
`pnpm checks`. Full test runtime was skipped to avoid overlapping the
unrelated cache working tree and long Storybook/Docker jobs.

## 3. Baseline results and hotspot inventory

### 3.1 Inventory (facts)

First-party JS/TS/Svelte (excluding `node_modules`, `dist`,
`storybook-static`, `spec/book`, `.svelte-kit`): **491 files**.

| Kind                           | Files |
| ------------------------------ | ----- |
| Production source              | 285   |
| Tests                          | 93    |
| Stories                        | 81    |
| scripts / `.storybook` / `dev` | 32    |

| Extension | Files | Counted lines |
| --------- | ----- | ------------- |
| `.svelte` | 200   | 70,117        |
| `.ts`     | 267   | 69,643        |
| `.mjs`    | 22    | 2,809         |

Production source over **200 / 300 / 500** counted lines: **122 / 85 / 54**.

`src/` counted-line share: `components` 82,652; `community` 31,911;
`registry` 5,634; `projects` 4,853; `testing` 3,517; `auth` 3,449;
`protocol` 2,574; `fixture` 1,879; `nostr` 1,173; `materializer` 422.

Dumping-ground filenames: `src/protocol/types.ts` (168 counted, cohesive
Nostr/registry schema types — **keep**); `src/auth/types.ts` (19 counted,
signer contracts — **keep**). No `utils.ts` / `helpers.ts` / `services.ts`.
`src/components/story-fixtures.ts` is a small shared story helper, not a
global dump.

### 3.2 Commands actually run

| Command                                  | cwd       | Exit | Result                                                 |
| ---------------------------------------- | --------- | ---- | ------------------------------------------------------ |
| `node scripts/check-ui.mjs`              | repo root | 0    | `UI policy passed: 15 catalog patterns`                |
| `node scripts/check-community-chips.mjs` | repo root | 0    | `Community chip policy passed.`                        |
| `node scripts/check-deferred-work.mjs`   | repo root | 0    | `40 tracked items`                                     |
| `pnpm check:types`                       | repo root | 0    | `tsc -p tsconfig.node.json --noEmit`                   |
| `pnpm check:svelte`                      | repo root | 0    | `0 errors and 0 warnings` (app tsconfig only)          |
| `pnpm check:format`                      | repo root | 0    | Prettier check                                         |
| `pnpm spec:validate`                     | repo root | 0    | 4 validators, 10 chapters, 118 requirements            |
| `pnpm spec:check`                        | repo root | 0    | validate + UI + chips + deferred + mdbook + spec-first |

`pnpm spec:check` wrote generated `spec/book/` (gitignored).

### 3.3 Ranked hotspots

Measurement: counted / physical lines as in §2.4. Risk is change-coupling
plus mixed responsibilities, not size alone.

| Rank | Path                                                                        | Counted / phys | Important symbols                                                                                           | Mixed responsibilities                                                                                                             | Callers / deps                                  | Tests                                                                           | Risk                                                       | Action                                                                                           |
| ---- | --------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1    | `src/components/community-application/CommunityApplication.svelte`          | 9118 / 9464    | destination routing (`navigation.ts` types), shell composition, participation, registry/projects chrome     | Location codec, AppShell wiring, Inbox/Pulse/Agents/Settings/room markup, identity participation, toasts, project catalog clearing | Root `CommunityApplicationRoot.svelte`; stories | `navigation.test.ts`; application stories                                       | **Highest.** Changes with controller and agents repeatedly | Extract destination shells and non-render helpers; keep one composition root                     |
| 2    | `src/community/community-controller.svelte.ts`                              | 5205 / 5318    | `createCommunityController` L122–L4876; `actions` object ~L1670–L3636; `normalizeCommunityOperationFailure` | Session maps, history, pulse, projection queue, publish/execute, presence, canvas, identity, unread                                | `community/index.ts`; test runtime              | `community-controller.svelte.test.ts` (1511c), `controller-transitions.test.ts` | **Highest.** Rune identity and ordering                    | Extract history/pulse/operation helpers as `.svelte.ts`; do not add behaviour without extraction |
| 3    | `src/components/community-projects/CommunityProjects.svelte`                | 6427 / 6616    | Project/PR/repo/task/activity UI                                                                            | Many surfaces in one component; already extracted `CommunityProjectStatusToasts.svelte` and `repository-browser.ts`                | `CommunityApplication.svelte`                   | stories + `repository-browser.test.ts`                                          | High                                                       | Extract surfaces (activity, files, PR review, dialogs) as named components in the same folder    |
| 4    | `src/community/agent-controller.ts`                                         | 2343 / 2402    | `CommunityAgentsController`; `parseRuntimeState` L1996–L2135; `parseMemoryState`                            | Directory, activity archive, catch-up, processing, permissions, runtime/memory parsing                                             | Controller `actions.agents`                     | `agent-controller.test.ts` (1390c)                                              | High                                                       | Split parsers and archive/sync from UI-facing actions                                            |
| 5    | `src/community/nip29-community-source.ts`                                   | 2285 / 2347    | `createNip29CommunitySource`; `commandTemplates` L2019–L2157                                                | Relay session, history windows, Pulse, canvas, DMs, agents, presence                                                               | Test runtime, Vite host                         | `nip29-community-source.test.ts`, `nip29-history.test.ts`                       | High                                                       | Keep one source factory; extract command templates / window loaders                              |
| 6    | `src/components/registry-community/registry-community-controller.svelte.ts` | 2685 / 2776    | `createRegistryCommunityController` L109–L2772 (2580c)                                                      | Registry discussion controller parallel to community controller                                                                    | `RegistryCommunity`                             | colocated `.svelte.test.ts`                                                     | High                                                       | Same extraction pattern as community controller; do not merge the two controllers                |
| 7    | `src/registry/nip29-data-source.ts`                                         | 1913 / 1981    | `createNip29RegistryCatalogDataSource` L110–L1520 (1373c)                                                   | Subscribe, query, hydrate, proof, snapshot store                                                                                   | `./registry/nip29` public subpath               | `nip29-data-source.test.ts`                                                     | High                                                       | Extract hydration vs subscription vs proof assembly                                              |
| 8    | `src/community/materialize.ts`                                              | 1581 / 1635    | `communityRooms`, `roomModel`, `eventMessage`, `directMessageModels`                                        | Room, member, message, inbox, thread projections                                                                                   | Controller, event-runtime                       | `materialize.test.ts`                                                           | Medium-high                                                | Split room/message/inbox projectors; **move types out of components** first                      |
| 9    | `src/community/agent-session.ts`                                            | 1568 / 1627    | `createCommunityAgentSession`; `validateAgentControl` L1333–L1504                                           | HTTP bridge, discovery, controls                                                                                                   | Source / controller                             | `agent-session.test.ts`                                                         | Medium-high                                                | Keep session; extract validation                                                                 |
| 10   | `src/community/contracts.ts`                                                | 871 / 979      | `CommunityController`, `CommunityEventStore`, `CommunityControllerActions`                                  | Broad public contract, not a junk `types.ts`                                                                                       | Entire community + components                   | type-level                                                                      | Medium                                                     | Split by contract family after inversion; cohesive exception until then                          |
| 11   | `src/protocol/nip29.ts`                                                     | 1328 / 1393    | parsers + `projectNip29Registry`                                                                            | NIP-29 rooms **and** registry head/release rules in one module                                                                     | protocol barrel                                 | `nip29.test.ts`                                                                 | Medium                                                     | Optional split registry-head vs room events; not P0                                              |
| 12   | `src/components/community-chat-composer/CommunityChatComposer.svelte`       | 1722 / 1841    | composer                                                                                                    | Script 739c + markup 529c + style 523p; already has `model.ts`, autocomplete                                                       | Many surfaces                                   | unit + stories                                                                  | Medium                                                     | Preserve folder; extract only if adding modes                                                    |
| 13   | `src/community/indexeddb-event-store.ts`                                    | 812 / 842      | IndexedDB adapter                                                                                           | Store + pruning; working tree already extracting accounting                                                                        | browser store                                   | history/cache tests                                                             | Medium                                                     | Finish in-flight accounting extraction; then stop                                                |
| 14   | `src/auth/relay-session.ts`                                                 | 798 / 859      | session + custody decrypt                                                                                   | Auth adapter (LC-ARCH-023/024)                                                                                                     | Application root                                | `relay-session.test.ts`                                                         | Medium                                                     | Keep; extract crypto helpers only when touching custody                                          |
| 15   | `src/community/event-runtime.ts`                                            | 616 / 642      | `InlineCommunityEventRuntime`                                                                               | Runtime core (LC-ARCH-012); reasonably cohesive                                                                                    | controller                                      | `event-runtime.test.ts`                                                         | Medium                                                     | **Preserve** unless a new runtime concern appears                                                |

**Crowded directory (fact):** `src/community/` 68 files (39 source + 29
test). Not a mega `services/` folder; it is one feature with too many
siblings. Split by **subsystem** when extracting, not by technical layer
for its own sake.

**Cross-feature imports (facts)**

- `components → community`: 74 relative imports (expected for UI).
- `community → protocol`: 31; `community → nostr`: 10; `community → auth`: 8 (expected downward).
- `community → components`: 9, **type-only** (`contracts.ts`, `materialize.ts`, `materialize-pulse.ts`, `community-controller.svelte.ts`).
- `auth → components`: 1 type-only (`keytr.ts` → login method model).
- Components import community **internals** not in `community/index.ts`:
  `agent-activity-context.ts`, `controller-identity-context.ts`,
  `message-moderation.ts`.
- `isRegistryControlEvent` is imported from
  `src/protocol/registry-control.ts`, which is **not** re-exported from
  `src/protocol/index.ts`.
- Stories/examples import `@lapismd/lapis-community/components` (package
  name). That matches AGENTS.md consumer-docs rules. Production
  components use relative imports.

**Runtime cycles:** none demonstrated. Type-level community ↔ components
cycle exists via barrels. **Assumption:** elided `import type` does not
create a runtime cycle.

**Broad public API (fact):** `src/community/index.ts` star-exports stores,
materializers, sources, and the controller. LC-ARCH-011 requires exposing
the event-store contract and adapters. Star-exporting every new internal
is not required. Components should not grow new deep imports.

### 3.4 Healthy areas to preserve

- Named folders under `src/components/<component>/` with colocated
  stories (AGENTS.md). Do not flatten or introduce `components/ui/` dumps.
- `src/nostr/` (transport, query, HTTP auth, NIP-29 state) — small and
  aligned with LC-ARCH-003.
- `src/auth/` module split (`signer`, `webauthn`, `relay-session`,
  `keytr` adapter types).
- `src/projects/` already split `model` / `builders` / `reducer` /
  `data-source` / `workspace` / `patch`.
- `src/protocol/types.ts` as the Nostr/registry schema owner (not a junk
  drawer).
- `CommunityApplicationRoot.svelte` already owns login/auth composition
  (~520 counted lines).
- `history-scheduler.ts`, `projection-state.ts`, `conversations.ts`,
  `channel-canvas.ts` — small cohesive modules.
- Working-tree `cache-access-order.ts` / `cache-accounting-sql.ts`
  pattern: extract the responsibility being changed.
- Custom UI/chip/deferred checkers using real parsers.
- No nested pnpm packages (LC-ARCH-001).

## 4. Target structure and ownership

### 4.1 Feature tree (existing vs proposed)

Keep package roots. Create community subfolders **only as extractions
land**, not as empty layers.

```text
src/
  index.ts                          # existing public root
  auth/                             # KEEP (LC-ARCH-003, 023–025)
  nostr/                            # KEEP
  protocol/                         # KEEP; re-export registry-control
  fixture/ materializer/ testing/   # KEEP
  projects/                         # KEEP public ./projects
  registry/                         # KEEP; split nip29-data-source later
  community/
    index.ts                        # existing; narrow over time
    contracts.ts                    # KEEP until contract-family split
    conversations.ts                # KEEP
    channel-canvas.ts               # KEEP
    # proposed, created when extracting (not empty stubs):
    controller/
      community-controller.svelte.ts
      controller-identity-context.ts
      operations.ts                 # from runOperation / publishTemplate
      history.ts                    # loadInteractiveRoom + scheduler wiring
      pulse.ts                      # pulse timers / refresh
    source/
      nip29-community-source.ts
      registry-community-source.ts
    materialize/
      materialize.ts
      materialize-settings.ts
      materialize-pulse.ts
    agents/                         # agent-* modules already prefixed
    cache/                          # event-store, indexeddb, turso, browser, accounting
    history/                        # history-pages, history-scheduler, projection-state
  components/
    community-application/          # KEEP; thin the Svelte file
      CommunityApplicationRoot.svelte
      CommunityApplication.svelte   # composition only
      navigation.ts                 # KEEP
      # proposed destination shells (named concepts, not Part1):
      CommunityApplicationSettings.svelte
      CommunityApplicationAgentsHost.svelte
      CommunityApplicationPulseHost.svelte
      CommunityApplicationInboxHost.svelte
    community-projects/             # KEEP folder; add surface components
    community-workspace/model.ts    # MOVE types to community (see 4.3)
    <other named folders>           # KEEP
```

Do **not** add `src/domain`, `src/utils`, or `src/types`.

### 4.2 Public APIs

| Entry                                             | Owner                                               | May import                                                                    |
| ------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `./community`                                     | Controller, contracts, sources, stores listed today | protocol, nostr, auth; **not** components (after inversion)                   |
| `./components`                                    | Svelte components + workspace models until move     | community **public** modules; design-core; protocol types only if unavoidable |
| `./protocol`                                      | Event interpretation                                | nothing in community/components/projects/registry/auth/nostr                  |
| `./nostr`                                         | Transport                                           | protocol, auth as today                                                       |
| `./auth`                                          | Signers, relay auth                                 | protocol; **not** components after login-method types move                    |
| `./projects`                                      | NIP-34 source/model                                 | protocol, nostr, auth                                                         |
| `./registry`                                      | Catalog sources                                     | protocol, nostr, auth                                                         |
| `./testing`                                       | Test runtime                                        | anything in src (test-only export)                                            |
| Vite `dev/community`, `.storybook`, `register.ts` | Composition roots                                   | public entries + explicit adapters                                            |

**Barrel policy:** `community/index.ts` remains a deliberate public API.
Internal community files must import siblings directly (`./history-pages.js`),
never `./index.js`. Stories may import `@lapismd/lapis-community/components`.
Production `src/components/**` (except stories, examples, harnesses) must
not import that package alias.

Promote to the community barrel when UI needs it:
`agent-activity-context`, `controller-identity-context`,
`message-moderation`. Until then, treat those three as **allowed UI
imports** of named internals, not a license to import `turso-event-store`.

### 4.3 Type ownership inversion

**Fact:** `CommunityRoomModel`, `CommunityMemberModel`,
`CommunityWorkspaceModel`, `CommunityInboxFilter`, etc. live in
`src/components/community-workspace/model.ts` and
`community-inbox/model.ts`, and are imported by materializer/controller
contracts.

**Recommendation:** those projection types are **community** contracts
(LC-ARCH-008). Move them to `src/community/workspace-model.ts` (name
indicating owner). Re-export from `src/components/index.ts` and the
workspace `model.ts` for one breaking-change-free cycle, then remove the
duplicate. Components keep view-only types (chip sizes, login copy).

`CommunityLoginMethodModel` used by `auth/keytr.ts` should live in
`src/auth` or `community-login/model.ts` imported only by UI + Vite host,
not by the published Keytr helper if that helper is package-public.
**Recommendation:** keep Keytr types in `src/auth`; have login UI import
auth, not the reverse.

### 4.4 Allowed / forbidden dependency matrix

Rows import columns. **R** = runtime allowed, **T** = type-only allowed,
**X** = forbidden, **C** = composition-root exception, **Test** = tests
only.

| From \ To                                                      | protocol | nostr | auth | community | projects | registry | components               | testing | scripts/dev |
| -------------------------------------------------------------- | -------- | ----- | ---- | --------- | -------- | -------- | ------------------------ | ------- | ----------- |
| protocol                                                       | R        | X     | X    | X         | X        | X        | X                        | X       | X           |
| nostr                                                          | R        | R     | R    | X         | X        | X        | X                        | X       | X           |
| auth                                                           | R        | R     | R    | X         | X        | X        | X (after move)           | X       | X           |
| community                                                      | R        | R     | R    | R         | X        | X        | X (T until P1 inversion) | X       | X           |
| projects                                                       | R        | R     | R    | X         | R        | X        | X                        | X       | X           |
| registry                                                       | R        | R     | R    | X         | X        | R        | X                        | X       | X           |
| components                                                     | T        | T     | R    | R public  | R public | R public | R                        | X       | X           |
| testing                                                        | R        | R     | R    | R         | R        | R        | R                        | R       | X           |
| CommunityApplication\*, Vite, Storybook harness, `register.ts` | C        | C     | C    | C         | C        | C        | C                        | C       | C           |

**Type-only policy:** `import type` and type-query `import("…")` follow
the T cells. After inversion, community→components is **X** even for
types.

**Tests:** `*.test.ts`, `*.stories.svelte`, `*Harness.svelte`,
`*Fixture.svelte`, `src/testing/**` may import internals of the feature
under test. They must not be imported by production.

**Dynamic import:** literal `import("@tursodatabase/database-wasm/bundle")`
in `turso-event-store.ts` is allowed (LC-ARCH-011 lazy driver). Computed
`import(variable)` is review-only; checker reports and **fails** if the
specifier is not a string literal (fail closed for new computed imports).

### 4.5 Hotspot extraction map

#### A. `createCommunityController` (`community-controller.svelte.ts`)

| Current                                                 | Proposed module                | Owns                          | Public contract                     | Deps                                          | Callers         | Tests                               | Why                                    | Cycle avoidance                              |
| ------------------------------------------------------- | ------------------------------ | ----------------------------- | ----------------------------------- | --------------------------------------------- | --------------- | ----------------------------------- | -------------------------------------- | -------------------------------------------- |
| `loadInteractiveRoom`, history maps, `historyScheduler` | `controller/history.svelte.ts` | Paged history intents/windows | functions taking controller context | `history-pages`, `history-scheduler`, runtime | factory         | existing controller + history tests | History changes independently of Pulse | Context passed in; no import back of factory |
| Pulse timers, `refreshPulse`, `publishPulse`            | `controller/pulse.svelte.ts`   | Pulse session                 | pulse actions                       | `materialize-pulse`                           | `actions.pulse` | pulse tests in controller file      | Pulse is optional (LC-NOSTR-019)       | Same                                         |
| `runOperation`, `publishTemplate`, `execute`            | `controller/operations.ts`     | Command execution + failure   | `runOperation`                      | protocol templates, session                   | actions         | controller tests                    | I/O orchestration ≠ projection         | No runes required if given callbacks         |
| `actions` object remaining                              | stays in factory               | navigation + room CRUD wiring | `CommunityControllerActions`        | extracted helpers                             | UI              | existing                            | Factory remains composition root       | —                                            |

**Constraint (fact):** the factory uses `$state` / `$derived.by`. Helpers
that close over those stores must stay `.svelte.ts`. Do not introduce
legacy stores.

**Sequencing:** characterisation is already in
`community-controller.svelte.test.ts`. Extract history first (recently
active). Behaviour-preserving. Re-export nothing new from the package
until needed.

#### B. `CommunityApplication.svelte`

Markup already switches destinations near L6684–L7503 (`settings`,
`agents`, `pulse`, `inbox`, `new-direct-message`, default workspace).
Script still owns participation, location, and chrome for all of them.

| Extract                               | Owns                                               | Keep in Application                          |
| ------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `CommunityApplicationSettings.svelte` | settings destination body                          | location + shell slots                       |
| Agents host                           | agents destination already using `CommunityAgents` | panel/profile orchestration currently inline |
| Pulse/Inbox hosts                     | wrap existing `CommunityPulse` / `CommunityInbox`  | unread/location glue                         |
| `application-participation.ts`        | join/retry/send wrappers                           | —                                            |

Do not name extracts `Part1`. Do not move Design Core AppShell topology
out of this composition root (LC-ARCH-006).

#### C. `CommunityProjects.svelte`

Follow the existing `CommunityProjectStatusToasts` / `repository-browser`
pattern. Next surfaces: activity feed, pull-request review, repository
browser pane, create dialogs. Keep `CommunityProjects.svelte` as the
projects composition root.

#### D. Agents / NIP-29 source / registry source

Extract **parsers** (`parseRuntimeState`, `parseMemoryState`,
`validateAgentControl`, `commandTemplates`) before splitting classes.
Those are pure and well-bounded.

### 4.6 Compatibility re-exports

Use re-exports only for moved types (`community-workspace/model.ts` →
community). Remove when no internal importer remains and after one
release if exported from `./components`. No re-export of extracted
controller helpers from `./community` unless they are already public.

## 5. Enforcement design

### 5.1 Tooling choice

| Policy                                               | Tool                                                                                             | Why                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counted-line budgets + no-growth                     | **Custom** `scripts/check-architecture.mjs`                                                      | ESLint `max-lines` + bulk suppressions cannot ratchet metric value                                                                                                                                                                       |
| Import matrix, runtime cycles, test isolation        | **Same custom checker** using `svelte/compiler` + `typescript` (already used by `ui-policy.mjs`) | Known to parse this repo; handles `.js` specifiers and `.svelte`                                                                                                                                                                         |
| Format                                               | Prettier (existing)                                                                              | Do not add ESLint formatting rules                                                                                                                                                                                                       |
| Types                                                | svelte-check + tsc (existing)                                                                    | Already `strict` + `noUncheckedIndexedAccess`                                                                                                                                                                                            |
| UI composition                                       | existing `check-ui` / chips                                                                      | Do not duplicate                                                                                                                                                                                                                         |
| Complexity, max-depth, max-params, floating promises | **Deferred ESLint 9** (P4)                                                                       | Valuable for promises; not required to stop size/layering debt. If added: `eslint-config-prettier` + `eslint-plugin-svelte` `prettier` config; **do not** enable `max-lines`; **do not** use `--max-warnings 0` while any rule is `warn` |

**Rejected for P0:** dependency-cruiser — overlapping graph role; Svelte 5
template-import fix exists only from **17.3.8**. Revisit only if the
custom graph becomes unmaintainable. **Rejected for P0:** ESLint as size
gate. **Rejected:** multiple boundary plugins.

**If ESLint is added later (P4), verified constraints from current docs:**

- ESLint ≥ 9.0 or 8.57.1; Node ≥ 18.18 (repo already Node ≥ 22).
- `eslint-plugin-svelte` supports `**/*.svelte`, `**/*.svelte.ts`.
- There is **no** `svelte.config.js`; plugin docs expect one or a Vite
  load. Would need a minimal `svelte.config.js` or `loadConfig` from Vite.
  That cost is another reason to defer ESLint.
- `parserOptions.projectService: true` is the documented typescript-eslint
  typed-linting mode; this repo has three tsconfigs (`app`, `node`,
  `pack`) and excludes tests from app — typed lint would need explicit
  project service allow/exclude.
- `max-lines` options `skipBlankLines` + `skipComments` approximate
  counted lines for **plain JS/TS**. For `.svelte`, core rules see the
  plugin’s script tree, **not** reliably the whole component. Do not use
  it as the file budget.
- `no-restricted-imports` is **static imports only** (ESLint docs).
  Dynamic `import()` and re-exports need the custom graph.
- Bulk suppressions apply only to rules set to `"error"` and key
  file+rule, not metric value. Unused suppressions fail ESLint (exit 2)
  unless pruned. Fine for boolean rules; useless for no-growth size.

### 5.2 Enforcement matrix

| Policy                                        | Class               | Mechanism                                                           | Files                                | Initial                                                                       | Target         | Exceptions                                                              | CI                        | Proof                                 |
| --------------------------------------------- | ------------------- | ------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------- | ------------------------- | ------------------------------------- |
| New production file ≤ 300 counted             | machine             | checker `newProductionCountedLines`                                 | `src/**` minus tests/stories/harness | error                                                                         | error          | explicit baseline `kind=exception`                                      | `pnpm check:architecture` | fixture oversized `.ts`               |
| New test ≤ 500, story ≤ 400                   | machine             | same                                                                | `*.test.*`, `*.stories.*`            | error                                                                         | error          | same                                                                    | same                      | fixture                               |
| Existing file counted lines must not increase | machine             | per-path budget                                                     | all tracked                          | error                                                                         | error          | budget update in same change with justification for cohesive exceptions | same                      | grow hotspot 1 line                   |
| New function ≤ 50 counted (P2)                | machine             | TS AST                                                              | `.ts` / svelte script                | off in P0; warn P2; error P3                                                  | error          | baseline per `path::symbol`                                             | same                      | fixture                               |
| Cyclomatic > 12 / depth > 4 / params > 5      | machine-assisted P4 | ESLint or checker                                                   | `.ts` first                          | warn or off                                                                   | error + budget | legacy baseline                                                         | `pnpm lint` if added      | fixture                               |
| Dependency matrix                             | machine             | import graph                                                        | `src/**`                             | error for X cells; T community→components **warn** until inversion then error | error          | composition-root globs                                                  | same                      | relative + alias forbidden import     |
| Runtime cycles                                | machine             | DFS/Tarjan on runtime edges                                         | `src/**`                             | error                                                                         | error          | none                                                                    | same                      | cycle fixture spanning unchanged file |
| Production ↛ tests/stories                    | machine             | importer kind                                                       | `src/**`                             | error                                                                         | error          | none                                                                    | same                      | fixture                               |
| Self-barrel import                            | machine             | `community/**` importing `community/index.js`                       | community                            | error                                                                         | error          | none                                                                    | same                      | fixture                               |
| Semantic cohesion                             | review-only         | change summary in PR/commit body when touching hotspots or new dirs | —                                    | review                                                                        | review         | —                                                                       | not CI                    | —                                     |
| Svelte rune semantics                         | review-only         | AGENTS.md                                                           | `.svelte.ts`                         | review                                                                        | review         | —                                                                       | —                         | —                                     |
| UI catalog                                    | machine             | existing check-ui                                                   | components                           | error                                                                         | error          | catalog exceptions                                                      | spec:check                | existing ui-policy tests              |

**Owner of overlapping concerns:** size and imports → architecture
checker. Format → Prettier. Types → svelte-check/tsc. UI patterns →
check-ui. Do not also enable ESLint `max-lines`.

### 5.3 Counted-line algorithm (normative for the checker)

```text
countedLines(text):
  inBlock = false
  n = 0
  for line in splitlines(text):
    s = trim(line)
    if inBlock:
      if "*/" in s: inBlock = false
      continue
    if s == "": continue
    if s starts with "/*":
      if "*/" not in s: inBlock = true
      continue
    if s starts with "//" or "<!--" or (s starts with "*" and not code):
      continue
    n += 1
  return n
physicalLines(text) = number of splitlines (file without trailing newline
  still counts its last line)
```

Svelte reports `{ path, counted, physical, scriptCounted, markupCounted,
stylePhysical }` but **enforces `counted` (whole file)**.

**Not counted as exemptions:** long template literals, JSX (none),
generated `dist`. **Exceptions by glob:** none for all tests or all
`.svelte` files. Narrow globs:

- `src/protocol/schemas.ts` if declarative and over budget (measure at
  implementation; not currently a top hotspot).
- `src/components/ui-catalog.json` is JSON, out of scope.
- `scripts/architecture-fixtures/**` scanned only by the harness.

### 5.4 Suppression governance

- No inline `eslint-disable` in P0 (no ESLint).
- Architecture exceptions live in `scripts/architecture-baseline.json`
  with `kind: "legacy" | "exception"`, `justification`, optional
  `requirement`, `removeWhen`.
- Unused baseline paths (file deleted) **fail** until removed in the same
  change.
- Widening a budget requires the same change as the code growth, plus
  justification. CI must not regenerate baselines (`--write` forbidden
  unless `CI` unset and explicit flag).
- Detect `/* eslint-disable */` file-wide only if ESLint is added; then
  enable `reportUnusedDisableDirectives: error`.

## 6. Legacy-debt ratchet and exception policy

**Selected strategy:** path-keyed **metric budgets**, not violation
counts, not Git blame, not ESLint bulk suppressions.

### 6.1 Schema

`scripts/architecture-baseline.json`:

```json
{
  "version": 1,
  "sourceCommit": "c5b50ca9b4c91056f96d530245df83caae3a27a6",
  "limits": {
    "newProductionCountedLines": 300,
    "newTestCountedLines": 500,
    "newStoryCountedLines": 400,
    "newScriptCountedLines": 300
  },
  "files": {
    "src/community/community-controller.svelte.ts": {
      "countedLines": 5205,
      "physicalLines": 5318,
      "kind": "legacy",
      "justification": "Svelte 5 controller factory; extract history/pulse/operations before adding behaviour"
    }
  }
}
```

Bootstrap: `node scripts/check-architecture.mjs --write-baseline` **once**
locally, committed. Never in CI.

**Note:** bootstrap must record the commit actually measured. This plan
audited parent `c5b50ca9b4c91056f96d530245df83caae3a27a6` plus uncommitted
cache-accounting files; regenerate the baseline from the tree at
implementation time rather than copying these counts blindly.

### 6.2 Comparison algorithm

```text
inputs = all first-party files matching globs
baseline = read JSON or FAIL "architecture baseline missing"
for each baseline path missing on disk:
  FAIL "deleted or renamed; update baseline in this change: PATH"
for each input file:
  metric = countedLines(file)
  if path not in baseline.files:
    limit = limits[kind]
    if metric > limit: FAIL "new file over budget PATH metric/limit"
  else:
    budget = files[path].countedLines
    if metric > budget:
      FAIL "counted-line growth PATH budget -> metric"
    # shrinking is OK; do not auto-lower budget in CI
if CI and argv contains --write-baseline: FAIL
if no input files: FAIL "architecture check found no source files"
```

Blank/comment-only edits: `countedLines` unchanged → pass.

**Renames:** fail on missing baseline path + new path treated as new file
(must be ≤ new limit). Developer moves the baseline key in the same
change. Do not guess renames from Git similarity.

**Splits:** new extract must meet new-file limit. Parent budget must
drop to the new counted size in the same change (otherwise the parent
could be grown later up to the old budget). **Recommendation:** checker
**warns** (P0) and **errors** (P3) when `metric + 20 < budget` (stale
budget slack). Slack of 20 avoids noise from comment reflow. P0 warn
does not fail CI; print `stale-budget PATH`.

**Replacement of one violation with another:** path identity avoids
line-number fingerprints. Limitation: deleting file A and adding file B
over budget is caught (B is new). Deleting a forbidden import in A and
adding one in B is caught per-file. Moving a forbidden import to an
allowed composition root is allowed if the root is excepted.

**Git merge-base:** not used for metrics. Absolute budgets work in
shallow clones and with uncommitted files. Fail if baseline JSON is
absent. Do not skip on missing origin/main.

### 6.3 Cases

| Case                   | Behaviour                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| New file               | ≤ kind limit or baseline exception                                                       |
| Existing compliant     | must stay ≤ limit (already in baseline at ≤ limit) and must not take a forbidden import  |
| Existing non-compliant | counted lines ≤ budget; forbidden deps must not be **added** (see import baseline below) |
| Refactor               | reduce budget to match; new files clean                                                  |
| Rename/move            | update baseline keys same change                                                         |

**Import ratchet:** store `forbiddenImportCount` per file (0 for clean
files). Fail if count increases. P0 community→components type imports
are recorded so inversion can drive them to zero. Adding a new
community→components type import fails even during the warn window if
the count rises.

### 6.4 Governance

- Baseline updates are reviewable diffs. No CI auto-expand.
- Improving file A does not allow growing file B (per-path budgets).
- Owner: repository maintainer (single-package repo; no CODEOWNERS file
  observed). Do not invent a team.

## 7. Proposed configuration changes

All of this section is **unexecuted**.

### 7.1 `package.json` scripts (merge)

```json
{
  "scripts": {
    "check:architecture": "node scripts/check-architecture.mjs",
    "check": "pnpm check:ui && pnpm check:architecture && pnpm spec:validate && pnpm check:svelte && pnpm check:types"
  }
}
```

Do not put `--write-baseline` on the check script. Keep `pnpm checks` as
the full canonical sequence; it already calls `pnpm check`.

### 7.2 `spec-validator.config.mjs` (merge)

1. Add a check lane `{ name: "architecture", command: "node", args: ["scripts/check-architecture.mjs"] }`.
2. Change spec-first `docs/` mapping so plans are owned by architecture:

```js
{
  pattern: "^docs/plans/",
  chapters: ["spec/src/architecture.md"],
},
{
  pattern: "^(?:src/(?:fixture|materializer)/|deploy/|scripts/|docs/)",
  chapters: ["spec/src/registry-pipeline.md"],
},
```

Order matters: `docs/plans/` must be matched **before** the general
`docs/` rule.

### 7.3 Spec requirement (proposed LC-ARCH-028)

Add to `spec/src/architecture.md` requirements table (next free id after
LC-ARCH-027):

> LC-ARCH-028: Repository validation MUST enforce counted-line budgets and
> the community/components/protocol dependency matrix with
> `scripts/check-architecture.mjs`. New production source MUST NOT exceed
> 300 counted lines. Existing files MUST NOT increase counted lines
> without updating the path budget in `scripts/architecture-baseline.json`
> in the same change. `src/community` production modules MUST NOT import
> `src/components` (type-only imports remain permitted only until the
> workspace-model inversion lands). Production modules MUST NOT import
> tests, stories, or `src/testing`. Composition roots MAY import feature
> public APIs.

Verification row: `Planned` until P0 lands, then `Implemented` with
checker tests + `pnpm check:architecture` evidence. **One row, same jj
change** as the checker (LC-SPEC-002 / LC-SPEC-003).

### 7.4 `scripts/check-architecture.mjs` behaviour

Unexecuted pseudocode (Node ESM, no new dependencies):

```js
// parse argv: --write-baseline (local only), --root (fixtures)
// CI = process.env.CI === "true" → reject --write-baseline
// walk src, scripts, dev, .storybook with extensions
//   .ts .js .mjs .cjs .svelte (.svelte.ts is .ts)
// skip node_modules dist storybook-static spec/book .svelte-kit
// classify production | test | story | script | compositionRoot
// compositionRoot globs:
//   src/components/community-application/CommunityApplicationRoot.svelte
//   src/components/community-application/CommunityApplication.svelte
//   src/components/register.ts
//   src/index.ts
//   dev/** .storybook/** src/testing/** **/*Harness.svelte **/*Fixture.svelte
// parse imports with typescript.createSourceFile for .ts/.js
//   and svelte/compiler parse() for .svelte (reuse ui-policy.mjs walk)
// resolve .js → .ts/.svelte, @lapismd/lapis-community/X → src/X
// classify type-only vs runtime
// apply matrix; count forbidden runtime + type imports
// detect runtime cycles
// compare counted lines to baseline
// exit 1 on any FAIL; print stale-budget to stdout
```

### 7.5 CI (proposed, host unverified)

No workflow file exists. `package.json` points at GitHub. Proposed
`.github/workflows/check.yml` (unexecuted):

```yaml
name: check
on:
  pull_request:
  push:
    branches: [main, master]
jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.32.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check:format
      - run: pnpm spec:check
      - run: pnpm check
      - run: pnpm test
```

Do not use `continue-on-error`. Do not path-filter away `scripts/` or
the baseline. Storybook/Docker/`pnpm checks` remain the full local/CI
nightly or manual gate if the host cannot afford them on every PR
— **Assumption:** start with `pnpm check` + unit tests; document any
skipped `pnpm checks` lanes explicitly.

Cache: pnpm store only. Do not cache ESLint (none). Do not cache
architecture results.

If the real host is Forgejo instead of GitHub, mirror the same commands
in `.forgejo/workflows/`; **do not assume** which host is required.

### 7.6 ESLint (P4 only, unexecuted)

Do not add in P0. If added:

- `eslint` 9.x, `typescript-eslint` 8.x, `eslint-plugin-svelte` 3.x,
  `eslint-config-prettier`, `globals` — pin from npm at implementation;
  do not use `@latest` in CI.
- `eslint.config.js` flat config; `svelte.configs.prettier` +
  `eslint-config-prettier`.
- Enable later: `@typescript-eslint/no-floating-promises`,
  `no-misused-promises` (typed, `projectService: true`),
  `complexity` / `max-depth` / `max-params` / `max-lines-per-function`
  as **error** with bulk suppressions **or** (preferred) custom function
  budgets. Still **do not** enable `max-lines`.
- Script: `"lint": "eslint src scripts dev --max-warnings 0"` only when
  every enabled rule is `error` and legacy issues are suppressed or
  budgeted. Never combine leftover `warn` rules with `--max-warnings 0`.

## 8. Proposed agent guidance

### 8.1 Root `AGENTS.md` addition (unexecuted)

Insert after “Ownership and protocol boundaries”, keep the rest:

```markdown
## Source organisation

Inspect the owning `src/<feature>/` tree and `docs/plans/typescript-architecture-and-enforcement.md`
before adding files. Do not grow files over 300 counted lines (see the
plan’s measurement) or add substantial behaviour to
`community-controller.svelte.ts`, `CommunityApplication.svelte`,
`CommunityProjects.svelte`, `agent-controller.ts`, or
`nip29-community-source.ts` without extracting the responsibility you
are changing. Do not import `src/components` from `src/community`.
Internal modules import siblings directly, not their own barrel.
Run `pnpm check:architecture` with the relevant tests.

### Completion checklist

- [ ] New/changed modules have one primary responsibility and a
      feature-specific name (not `utils` / `helpers` / `common`).
- [ ] Placement matches auth / nostr / protocol / community / components /
      projects / registry owners.
- [ ] Imports follow the dependency matrix; no new community→components
      types; no production→test imports.
- [ ] Counted lines: new files ≤ 300 (tests ≤ 500); existing hotspots did
      not grow, or the baseline budget dropped after extraction.
- [ ] Tests follow the extracted boundary; characterisation tests added
      before moving poorly covered behaviour.
- [ ] `pnpm check:architecture` and the existing `pnpm check` lane
      relevant to the surface passed.
```

Do not duplicate UI catalog rules. Do not nest a second AGENTS.md until
a checker exists that agents are known to load (Cursor loads root
`AGENTS.md`; nested discovery is **not** assumed).

### 8.2 Review-only change summary

Required when: adding a directory, adding shared types, growing a
baseline budget, or touching a hotspot listed in §3.3.

```text
Owned: <module> — <responsibility>
Shared: <why a real shared contract, or "none">
Hotspot: <path grew/shrank by N counted lines; extraction: yes/no>
```

Trivial typo/comment-only changes: no summary.

## 9. Phased implementation backlog

Behaviour-preserving unless noted. Do not start a repository-wide move.

### P0 — Baseline and checker (first slice)

|                      |                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority             | P0                                                                                                                                                                                                                                                            |
| Purpose              | Stop size and layering regressions                                                                                                                                                                                                                            |
| Evidence             | 85 production files >300c; no size gate; community→components types                                                                                                                                                                                           |
| Files                | `scripts/check-architecture.mjs`, `scripts/architecture-baseline.json`, `scripts/architecture.test.mjs`, `scripts/architecture-fixtures/**`, `package.json`, `spec-validator.config.mjs`, `spec/src/architecture.md`, `spec/src/verification.md`, `AGENTS.md` |
| Ownership after      | scripts own the checker; spec owns LC-ARCH-028                                                                                                                                                                                                                |
| Deps                 | none                                                                                                                                                                                                                                                          |
| Sequence             | Executed: spec-first remap, LC-ARCH-028, checker + fixtures, `--write-baseline`, `pnpm check` / `spec:check` wiring, AGENTS.md                                                                                                                                |
| Behaviour-preserving | yes                                                                                                                                                                                                                                                           |
| Tests                | fixture table in §10                                                                                                                                                                                                                                          |
| Validate             | `pnpm check:architecture`, `pnpm spec:check`, `pnpm check`                                                                                                                                                                                                    |
| Acceptance           | new 301-line file fails; growing controller by one code line fails; comment-only pass; missing baseline fails; `CI=true --write-baseline` fails                                                                                                               |
| Risk                 | false positives on comment classification; stale working-tree line counts                                                                                                                                                                                     |
| Effort               | M                                                                                                                                                                                                                                                             |
| Rollback             | delete script, lane, requirement                                                                                                                                                                                                                              |
| Baseline             | created                                                                                                                                                                                                                                                       |

### P1 — Invert type ownership

|                      |                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose              | community no longer imports components                                                                                                                  |
| Evidence             | type imports in `contracts.ts`, `materialize.ts`, `materialize-pulse.ts`, `community-controller.svelte.ts`, `keytr.ts`                                  |
| Files                | new `src/community/workspace-model.ts` (or split); re-export from `community-workspace/model.ts` and `components/index.ts`; login method types for auth |
| Sequence             | Executed: community-owned workspace/inbox/composer models, auth-owned login-method types, public re-exports, checker community→components is X          |
| Tests                | existing materialize/controller tests; `pnpm check:svelte`                                                                                              |
| Behaviour-preserving | yes (types only)                                                                                                                                        |
| Risk                 | public `./components` type paths; keep re-exports                                                                                                       |
| Effort               | M                                                                                                                                                       |
| Rollback             | restore re-exports                                                                                                                                      |

### P2 — Controller history/pulse/operations extraction

|            |                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Purpose    | make the rune factory extensible without 5k-line edits                                                                      |
| Evidence   | `createCommunityController` 4673c; recent history/unread commits                                                            |
| Files      | `src/community/controller/` operations, history, and Pulse modules; shrink `community-controller.svelte.ts`; lower baseline |
| Sequence   | Executed: operations factory, history paging/restore, Pulse timers and signed actions; factory remains the composition root |
| Tests      | `community-controller.svelte.test.ts`, `controller-transitions.test.ts`, history tests **before** each extract              |
| Constraint | keep runes; no store library                                                                                                |
| Effort     | L                                                                                                                           |
| Risk       | subscription/disposal and generation checks                                                                                 |

### P3 — Application and Projects destination shells

|          |                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Purpose  | stop Application/Projects absorbing every destination                                                               |
| Evidence | 9118c / 6427c files; destination `{:else if}` chain                                                                 |
| Files    | new named hosts under existing folders; stories stay on public components                                           |
| Tests    | affected Storybook interaction stories; cold Storybook if startup wiring changes                                    |
| Effort   | L                                                                                                                   |
| Visual   | keep `visual-pending`; no baseline updates without approval                                                         |
| Status   | Implemented in `arch-p3`: Application settings, agents, Pulse, Inbox, and DM hosts extracted; Projects activity, pull-request review, repository pane, and create-dialog surfaces compose from `CommunityProjects`. |

### P4 — Agent/source/registry factory splits + optional ESLint promises

|          |                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Purpose  | split remaining >1500c factories; close floating-promise gap                                                            |
| Evidence | agent-controller, nip29 source, registry data-source, materialize                                                       |
| ESLint   | only if svelte-check still misses floating promises (not measured here — **assumption:** typed ESLint would catch more) |
| Effort   | L                                                                                                                       |

### P5 — Tighten

Lower new-file limit only if P1–P3 reduced hotspot budgets. Enable
stale-budget error. Remove community→components warn. Drop obsolete
baseline entries. Do **not** relax type or UI-policy checks.

### Out of scope

- Nested packages, DI containers, rewriting Svelte 5 runes to a store lib
- Enabling extra `tsc` flags
- Repository-wide Prettier/name churn
- Visual baseline approval
- Splitting every file above 300 at once
- `src/protocol/nip29.ts` registry/room split (optional later)
- Assuming GitHub required checks are configured

## 10. Guardrail verification

Harness: `scripts/architecture.test.mjs` runs the checker with
`--root scripts/architecture-fixtures/<case>` so fixtures never enter
`svelte-check` or `check:ui`. Assert **stdout/stderr match the rule id**,
not merely nonzero exit.

| Scenario                                             | Fixture                                                               | Expected                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| New production file >300 counted                     | `new-oversize/src/community/new-mod.ts`                               | fail `new-file-budget`                                                              |
| Existing oversized file grows, still one “violation” | copy of tiny baseline 10→11 counted                                   | fail `counted-line-growth`                                                          |
| Valid extraction                                     | parent shrinks, child ≤300, budgets updated                           | pass                                                                                |
| Forbidden import relative                            | `community/x.ts` imports `../components/index.js`                     | fail `forbidden-import`                                                             |
| Forbidden import alias                               | `from "@lapismd/lapis-community/components"` in production community  | fail `forbidden-import`                                                             |
| Hidden via re-export                                 | `community/x.ts` imports `./via.js` which value-re-exports components | fail `forbidden-import` (follow one re-export hop; document if only type re-export) |
| Literal dynamic import of components                 | `await import("../components/index.js")`                              | fail `forbidden-import`                                                             |
| Computed `import(x)`                                 | `await import(path)`                                                  | fail `non-literal-import`                                                           |
| Runtime cycle A↔B including unchanged B             | fixture                                                               | fail `runtime-cycle`                                                                |
| Composition root imports community+auth              | ApplicationRoot-shaped file                                           | pass                                                                                |
| `import type` community→components during P0         |                                                                       | warn; fail if count > baseline                                                      |
| Test imports internals                               | `foo.test.ts`                                                         | pass                                                                                |
| Production imports test                              | `community/x.ts` imports `./y.test.js`                                | fail                                                                                |
| Cohesive exception                                   | baseline `kind=exception` over limit                                  | pass only that path                                                                 |
| New `.svelte` over budget                            | component with large markup                                           | fail (whole-file counted)                                                           |
| Rename without baseline update                       | old path in baseline missing                                          | fail `missing-baseline-path`                                                        |
| New extension `.mts`                                 |                                                                       | still walked (include in glob)                                                      |
| Broken config / missing baseline                     | delete JSON                                                           | fail, nonzero                                                                       |
| No source files                                      | empty root                                                            | fail `no-inputs`                                                                    |
| Comment-only edit                                    | add `//` lines to hotspot                                             | pass (counted unchanged)                                                            |
| `CI=true --write-baseline`                           |                                                                       | fail                                                                                |

Re-export hop: follow **value** `export * from` and
`export { x } from` one level. If a tool limitation remains, document it
in the checker header and add a review-only note — do not claim coverage
you did not implement.

## 11. Risks, trade-offs, unresolved questions, references

**Risks**

- Rune/`$state` identity if controller extracts are careless.
- Public `./components` type re-exports after moving models.
- Checker comment classification vs Prettier wrapping (mitigate with
  physical+counted reporting; do not count wrapped string internals as
  comments).
- Local Design Core tarball via `.pnpmfile.cjs` can make CI and a laptop
  diverge; architecture checker must not depend on Design Core.
- Landing `docs/plans/` today maps to `registry-pipeline.md` until P0
  remaps it.

**Trade-offs**

- Custom checker vs ESLint: chosen because no-growth is a metric ratchet.
- Whole-file Svelte budgets vs script-only: whole-file chosen so markup
  cannot hide growth. Script/markup split is reported for review.
- Not splitting `src/community` in one move: avoids import churn and
  empty folders.

**Unresolved**

- Whether GitHub Actions or Forgejo is the required CI host (no workflow
  in repo).
- Whether Storybook `.svelte` should join svelte-check (coverage gap;
  separate from this plan).
- Exact `forbiddenImportCount` for community→components after a clean
  inventory at implementation time (9 files observed; confirm with the
  parser, not grep).
- Function-level budgets (P2) symbol identity for duplicate nested names.

**Documentation references**

- ESLint `max-lines`, `max-lines-per-function`, CLI exit codes, bulk
  suppressions, `no-restricted-imports` (static only)
- typescript-eslint typed linting / `projectService`
- eslint-plugin-svelte user guide (`.svelte`, `.svelte.ts`)
- dependency-cruiser Svelte 5 template-import fix ≥ 17.3.8 (not selected
  for P0)
- LC-ARCH-001–027, LC-SPEC-002–004, this repository’s `AGENTS.md`

---

Implementation of the checker, spec requirement, agent text, and CI has
**not** been performed. This file is the plan.
