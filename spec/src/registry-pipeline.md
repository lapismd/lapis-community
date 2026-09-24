# Local Registry Pipeline

LC-ARCH-021 repository Log replay acceptance is recorded in
`docs/development/repository-log-replay-validation.md`. Source regressions,
cold browser acceptance, installed page behavior, and pre-existing aggregate
failures MUST remain separately reported.

LC-UI-044 continuation validation uses disposable relay browser lanes and the
packaged consumer check. The turn-control, session-selection and application
action owners are recorded in the architecture baseline; source verification
and installed-controller acceptance remain separate in
`docs/development/agent-alignment-validation.md`.

For LC-ARCH-028, editor catalog, thinking, combined-picker, harness-tab, and catalog-story owners are recorded in `scripts/architecture-baseline.json` with the lowered agent-editor dialog and model-field budgets. Harness permission-mode fields lower the `CommunityAgentProfile.svelte` budget in that baseline. For LC-UI-044, extracted plan transcript owners, the Activity feed Chat Layout owner, and composer activity plays are recorded in the same baseline. Hash-synced Community location extracts lower the `CommunityApplication.svelte` budget in that baseline. Entity-link owners (`community-copy-links`, `community-entity-chip`, `syntax-tokens`, `composer-entity-links`) lower the `syntax.ts`, `syntax-hast.ts`, and `composer-extension.ts` budgets in the same baseline. Implicit mention bundling into the reply-summary stack keeps the lowered `CommunityMessage.svelte` budget in the same baseline. The padded thread-sidebar skeleton updates the `CommunitySkeleton` budget in the same baseline. The Turso open-timeout owner lowers the `turso-event-store.ts` budget in the same baseline. Message-column Mira width suppression updates the `CommunityMessageColumn` story budget in the same baseline. Thread-panel projection matching records `thread-panel-projection` in that baseline so an already-open thread can be replaced without growing `CommunityApplication.svelte`. Inbox conversation pending records `inbox-conversation-pending` in the same baseline so a selected Inbox item can hide stale messages without growing `CommunityInbox.svelte`. Composer slash entity owners and the extracted location-hash / autocomplete-sync shrinks update the same baseline. Composer chip dismiss owners update that baseline so widget extraction can drop the composer-widgets budget. Composer slash caption owners record session task titles, commit message-plus-hash, and Op Log change ids in the same baseline. Entity chip overflow uses `--community-chip-max-width` on those entity and removable-token owners. Shared room-icon and channel-chip owners cover `#Name` chips and `#`/`/channels` picker icons in the same baseline. Composer draft key, persisted-composer remount, conversation-composer, topic-composer editor, workspace forum-index, thread-panel persisted-composer, Pulse composer, and Projects review-composer owners cover LC-UI-052 browser-local drafts in the same baseline. The Log Create review rail, changed-files header, Copy Link label, repository log pane, and revision commit-id budgets are recorded in that baseline. Repository Files revision routes record `project-route-files` and the updated `project-route` and `project-commit-route` budgets in that baseline. The Files rail Copy Link records the updated repository-link budgets in that baseline. Review activity navigation records the lowered `CommunityProjects.svelte` budget in that baseline. Open review Details record the lowered `CommunityApplication.svelte` budget in that baseline. History copy links record the updated revision-id, repository-link, route, and Log selection budgets in that baseline.

For LC-UI-037, the owned-agent Runtime summary reuses the existing Projects copy-value component, and its profile, story, and runtime fixture budgets are recorded in `scripts/architecture-baseline.json` without changing relay ingestion.

LC-UI-049 thread-context fixtures exercise existing checkpoint and channel event shapes, native replies, linked commit comments, visible thinking and shared reactions. Discussion edit/delete, reference-token and independently scrolling thread fixtures reuse those signed event shapes. Their component extractions and bounded status story update the architecture baseline without changing relay ingestion or publication protocols.

For LC-UI-049, local project fixtures include agent-signed v2 context with complete prose and tool input/output that keep the invocation name on results, all referenced pages, and explicit commit targets. These fixtures exercise repository Activity, Log, Op Log and commit context alongside the source fixture. Commit-detail disclosure extraction updates the architecture baseline and reuses these fixtures for matching header and independent expansion checks.

For LC-UI-050, project-linked channel settings derive an unsaved canvas starter
from the resolved project catalog, repository references and channel binding.
Direct project Activity URLs retain their route through cold catalog startup,
returning to Activity routes through the application location state, and
repository Activity gates full agent transcripts behind a collapsed disclosure
without changing the underlying relay projection. Known-agent member models keep
agent avatars rounded-square across project surfaces; git-author avatars
remain the rounded author exception.

`pnpm check:ui` treats `src/components/community-member-avatar/` as the
avatar-geometry owner so extracted avatar CSS can keep agent
rounded-square and people circle without consumer restyles.

Repository scripts that enforce specification policy include the deferred-work
ledger validator required by LC-SPEC-006. It reads specification metadata only
and does not change the relay-derived registry pipeline. Storybook
authentication regressions may share this pipeline's browser runner while
leaving registry hydration, release proofs, and seeded catalog data unchanged.

Planning documents under `docs/plans/` are not canonical requirements.
The TypeScript organisation and enforcement plan is
`docs/plans/typescript-architecture-and-enforcement.md`. Scripts own the
architecture checker; `docs/plans/` maps to `spec/src/architecture.md`.
Persistent agent mentions lower the Application, chat-composer, conversation,
and thread-panel path budgets in `scripts/architecture-baseline.json`.
NIP-27 content-mention decoding and markdown chip extraction add
`content-mentions.ts`, `syntax-hast.ts`, and `preview-mentions.ts` to that
baseline without changing relay ingestion. Composer token-reference budgets
scan draft `nostr:npub` text through the same mention-widget path.
Composer mention-insert budgets record NIP-27 selection tokens.
Agent activity transcripts add `transcript-markdown-members.ts` so the shared
preview receives known members and the selected agent.
Activity-sync permission replacement extracts to `activity-sync-permissions.ts`
so refresh snapshots keep pending approval cards.
Composer autocomplete and formatting-action sync extract to dedicated
modules and lower the `CommunityChatComposer.svelte` path budget in the
same change.
Mention-button lock badges and colliding mention-token resolution
extract to dedicated modules and lower the `composer-extension.ts`
path budget in the same change.
Message reply-summary extraction lowers the `CommunityMessage.svelte`
path budget in `scripts/architecture-baseline.json`.
Per-harness runtime catalog extraction lowers the `agent-contracts.ts`,
`agent-state-parsers.ts`, and Agents `story-fixtures.ts` path budgets in
`scripts/architecture-baseline.json`.
Extracting the editor model field
lowers the shared Edit agent dialog budget and records the empty-catalog
story and fixture sizes.
Empty-catalog refresh, last-known Start/Stop labels, and editor runtime
default rows extract to dedicated modules and lower the Edit agent dialog,
owned-agent profile, Agents directory, and application composition budgets
in `scripts/architecture-baseline.json`.

LC-UI-040 Inbox loading coverage updates the architecture baseline for its
geometry assertions and the smaller component that shares the padded skeleton.
LC-UI-044 records the Activity permission stack, the plan list, the Turns
place link, the Turns list, the runtime-control budget, and the Activity
shell budget in the same baseline.
Inbox responsiveness records the host snapshot and cancellable selection owners,
the reduced Inbox component budget, and its new responsiveness harness/stories
in the same baseline. Adapter read bounds and cached-selection paint coverage
exercise application composition without changing relay ingestion.
LC-UI-047 read-row parity records the shared Inbox visibility owner and its
projection tests and read-state harness/stories in the architecture baseline.
Both the Inbox component and materializer budgets shrink when their duplicate
filter predicates move to that owner.
LC-UI-014 Inbox conversation scrollport coverage updates the architecture
baseline for the Inbox stories that assert pane-fill selector scope, the
same non-scrolling flex fill as channel workspace content, a pane
viewport that computes overflow hidden over Design Core inline overflow,
a conversation that stretches to the full Body.Content width,
channel-matching overflow anchoring, and production conversations that
render history windows in normal flow without TanStack virtualization.
P4 factory parser splits are extracted: agent runtime and memory parsers,
agent-control validation, NIP-29 command templates and content-window loaders,
registry hydration, catalog subscriptions, and portable release proofs, and
community room, message, and inbox projectors live beside their factories.
The checker fails stale path budgets when counted size plus twenty is still
below the recorded budget. Keytr local development storage-relay hosts remain
in the recorded auth path budgets. The checker follows one value re-export hop
except through feature barrels.

Extracted Community controller modules update the architecture baseline in the
same change as the factory they leave. Extracted project work-item filters,
collection-list filters, exclusive Tasks/Reviews rail toggles indented as children,
page-scoped multi-select Activity event-type filters, history-aware project Back,
repository activity, repository Log adapter, and
`CommunityProjectsRevisionGraph` modules update that baseline in the same
change. Repository Log change-ID labels update that baseline in the same
change. Repository Log forked-lane reconnects, cubic joins, empty-description
placeholders, History-style copyable revision IDs, compact FileListing chrome, and
ColumnCanvas FileDiff columns, unique-change collapse, and canvas-root header
geometry update that baseline in the same change. Repository Log current-view
pinning from kind `3904` `metadata.ended_at_ms` updates that baseline in the
same change. Repository Log empty dest-Git objects update that baseline in
the same change. Repository Log rail selection, Op Log, and Evolog adapters
update that baseline in the same change. Repository Log Create review form
composer updates that baseline in the same change. Repository Log Create review
target selection extracts the dialog owner and lowers the log-rail budget in
the same change. Repository Log Evolog pressed selected
treatment, close-column deselect, and Op Log dest-Git files from recorded
evolution commits update that baseline in the same change. Repository Log
column ScrollArea paging, Op Log message copy chips, and split graph `#a`
page filters update that baseline in the same change. Repository Log Diff
header file stats and icon-only unified/split/wrap toggles update that
baseline in the same change. Repository Log and Evolog author Gravatar avatars,
avatar email tooltips, `CommunityRelativeTime`, and removal of the Snapshot chip
and author-name text update that baseline in the same change. Dest-Git Commits
rows reuse that git-author Gravatar avatar instead of a member hover card and
update that baseline in the same change. Projects Activity dest-Git hash copy
buttons, kind `3901` operation-ID and replica-ID copy buttons, muted square
`jj-sync` chips, and single-`@` member handle labels
update that baseline in the same change. `jj-sync` chips keep the History
copy-button fill on muted activity-row hover and update that baseline in the
same change. Literal `:` project fragment coordinates update that baseline in
the same change. Selected-project hub extracts and the lowered Application
and CommunityProjects budgets update that baseline in the same change.
Repository agent-context page filters, manifest assembly, selection adapters,
and the extracted context column update the architecture baseline in the same
change without entering registry materialization.
Repository Files latest-commit
Gravatar avatars and History-style SHA copy buttons update that baseline in
the same change. Repository Overview README fullWidth alignment updates that
baseline in the same change. Channel `maintainer` / `CanMaintain` authority,
`OWNERS.md` parsers, extra `protected-ref` compile, the Settings protection
editor, extracted repository settings and Overview hosts, create/review/merge
gating modules, path-owner reviewer extras, the bound channel People link, and
CanMaintain task assignment update that baseline in the same change.
The repository Options rail extraction and lowered `CommunityApplication`
budget update that baseline in the same change. Named rulesets,
in-place People member command, and restored Overview rail chrome update
that baseline in the same change.

For LC-OPS-001 and LC-OPS-004, hosted-project acceptance layers the sibling
relay's digest-pinned WalGit and RustFS composition onto both the persistent
local development stack and disposable controller stack. Runtime credentials
MUST be generated outside Compose, kept in ignored runtime directories, and
never exposed to browser code. Disposable credentials are removed with their
containers and volumes on exit; persistent local credentials are removed by
the explicit reset command.

WalGit MUST receive its documented S3-specific credential and endpoint
variables rather than generic AWS aliases. The RustFS bucket initializer MUST
use the digest-pinned RustFS client against that same path-style endpoint so
the acceptance stack verifies the storage contract actually used by WalGit.

## Requirements

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-OPS-001 | The local Docker Compose stack MUST build this package once, seed deterministic `lapis-plugins` Registry/discussion events using `web` and `desktop` platforms, include curator-signed publisher authorization events and sequence-zero freshness heads for every seeded plugin, grant the pinned curator the relay `registry-curator` role, include group-scoped reactions and a threaded channel-reply example, upload release resources to relay Blossom using standard-base64 authorization, and sign their exact content-hash URLs into fixture releases. It MUST also run digest-pinned private WalGit and RustFS services behind the relay, seed an ordinary `30621` project graph with a hosted `30617`, a distinct clone-less project task anchor, an additional related Community channel, and repository- plus project-scoped `1621` tasks. The hosted repository fixture MUST include a valid jj-sync operation and kinds `3902`–`3905`, plus an ordered kind `3908` agent-context page referenced by kind `3907`, so selecting its seeded Log or Op Log row exposes collaborator-visible agent context in the production app. The stack MUST expose only the relay origin to the browser. Browser and native-host Registry consumers MUST read resources from the configured relay and MUST NOT depend on the fixture status server, a sidecar credential, or a local Git checkout. The stack MUST materialize a verified head-aware projection with the complete Community client asset graph, build the sibling registry site, and serve that result with the relay available to the browser. Docker-backed Storybook files that mutate the shared seeded relay MUST run serially. The long-thread browser smoke MUST leave newest-window discussion isolation through normal first-post navigation before verifying restored plugin detail media. |
| LC-OPS-002 | Fixture and materializer executables MUST be built from `src/fixture` and `src/materializer`; Docker MUST NOT depend on removed workspace-package paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| LC-OPS-003 | Production publication, trusted-key changes, relay deployment, DNS changes, and package publication MUST remain manual approval gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| LC-OPS-004 | Controller conformance MUST use one disposable Compose stack with the sibling `nostr-relay` build and PostgreSQL, an isolated project name, allocated loopback port, ephemeral volumes, secret-file relay identity, health check, shared signed seeding, and teardown on test or Storybook exit. Its browser authentication lane MUST use same-site sibling test origins, a virtual PRF authenticator, an isolated Keytr record relay, and distinct deterministic OAuth identities to prove Keytr creation, relay-session login, GitHub linking, signing, key disposal, and same-pubkey recovery. Its Docker Storybook lane MUST exercise the full workspace, full application, and complete registry lifecycle stories. The full registry-to-site Compose stack MUST remain a separate final smoke lane.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The local fixture is test infrastructure, not an alternate source of truth. It
publishes the same signed events that production publishers, curators, and
community members would submit and then exercises the normal relay-to-site
pipeline. The fixture's HTTP status endpoint coordinates local setup and smoke
evidence; it is not a Registry resource origin. Registry manifests and
referenced content are served by the relay-owned Blossom endpoint and addressed
by SHA-256. Project fixtures likewise use normal signed NIP-34 events; hosted
repository provisioning and browser reads stay behind the relay's existing
NIP-98/NIP-29 gateway.

The disposable application-authentication lane layers a fake OAuth service and
the sibling relay's localhost-only provider overrides onto the same Compose
boundary. Its Google, GitHub, relay-session, and Nostr events are deterministic;
master keys and provider secrets are generated into the ignored runtime
directory and removed with containers and volumes when the lane exits.
It allocates an exact `community.localhost` browser origin and drives a Chromium
virtual authenticator through passkey registration and managed-key release, so
WebAuthn origin and RP-ID behavior are verified without live credentials or a
desktop host.

The dedicated Community Vite lane is checkout-owned. Its supervisor watches
the local stack's generated public fixture environment, restarts Vite when
those compile-time values change, and refuses to replace a listener whose
working directory belongs to another checkout.

Vite and Storybook share one narrowly scoped pre-transform for the generated
Turso browser bundle. It preserves the bundle's runtime behavior while keeping
Vite's dependency scanner from recursively parsing the embedded WebAssembly
data URL and worker constructor; all other dependencies use the ordinary Vite
pipeline.

The materializer uses the relay's `BLOSSOM_URL` for manifests and every
content-addressed Registry resource. The projection still contains only
hash-verified mirrored resources. The final smoke starts a fresh Storybook
process against the seeded relay,
rejects static index or detail requests, and exercises Blob-backed AI media in a
real browser. It separately retains the materializer and built Astro route
assertions without modifying the sibling renderer.

The repository's deterministic script lane scans Community Svelte and CSS
sources for direct Badge use outside `CommunityChip`, native chip-like markup,
forged Badge hooks, and consumer-level chip appearance overrides before the
remaining specification and pipeline checks run. Unit fixtures cover the
accepted shared component boundary and rejected look-alikes or local restyles.

The media smoke operates the public image-theme radio group and verifies each
selected variant still uses a verified Blob URL. The smoke selectors follow
the control’s accessibility semantics.

The UI policy tooling validates the Community catalog and parsed production compositions before delivery. Its positive and negative fixtures verify aliases, alternate component syntax, forbidden overrides, exact exceptions, missing exports, and invalid example/state metadata. This local validation does not publish registry artifacts or signed events.

Packaged-consumer checks use the same current accessible control names as the
canonical component stories, including inline member names and the managed-agent
dialog title. Presence badge changes retain the identity geometry and avatar
contracts across the existing viewport and theme matrix.

## Unified local Community environment

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-OPS-005 | The persistent `lapis-local-dev` lifecycle MUST be owned by the sibling `community-local` CLI and use one persistent relay for registry, Projects, GitHub, application auth and opt-in encrypted Keytr storage. This package MUST NOT ship lifecycle aliases. Normal hydration MUST consume the versioned, secret-free 13-plugin bundle without reading a plugins checkout, resolve public resource URLs before signing, preserve centrally stored identities and timestamps, and add missing group roles without removing existing roles or memberships. Rehydration MUST treat a later replaceable or addressable head at the same author, kind, and `d` coordinate as satisfying the seeded event instead of requiring the original event ID after local profile or project edits. Credential initialization MUST stay in `community-local`. The Vite host MUST read only an explicit public configuration allowlist, never the credential environment, and MUST preserve explicit isolated-test overrides. Its development-only pasted-private-key session MAY persist in `localStorage` and MUST offer a forget-key toast. |

`fixture:freeze` is the explicit maintainer operation that refreshes
`deploy/fixture-v1.json.gz` from the plugins checkout. The bundle includes
manifests and hashed media; deterministic discussions and the project graph
remain versioned in the fixture executable. These are development fixtures,
not installable plugin releases. Rehydration restores the signed baseline and accepts a later replaceable or
addressable head at the same coordinate when local profile or project edits
superseded a seeded event ID; ordinary restarts retain additional accounts and
activity. The relay-owned
reset command preserves verified, signed encrypted Keytr recovery records.

The disposable `community-relay.sh` and `local-stack.sh` test harnesses remain
isolated from the persistent environment. Keytr's PRF browser contract uses
the actual disposable Docker relay's opt-in kind 31777 policy.

The central head clock and revision MAY advance after 27 days to retain the
protocol's 30-day freshness bound. The complete compare-and-swap history MUST be retained for reset replay. This only appends renewed curator heads;
release, discussion and project IDs and timestamps MUST remain unchanged.

The shared browser cache uses atomic statement batches when replaying registry
and community records. Its pinned browser driver must resume yielded writes
without requiring unrelated I/O, so registry synchronization releases the
database connection for encrypted agent history reads.
The local agent-archive browser lane commits an activity page and cursor in one
transaction, reopens the database, and verifies that clear-history suppression
keeps the cursor while removing encrypted activity rows.
Browser cache validation MUST preserve the registry's relay-derived source of
truth: persisted history coverage and byte counters are disposable cache data.
Evicting a cached event invalidates its dependent page coverage without changing
unrelated cached pages or publishing replacement registry events.

The native OPFS acceptance lane MUST reload a saved 50-message history page and
verify that budget eviction preserves a separate page and its byte accounting.

Local privacy reclassification MUST invalidate only affected cache records and their coverage. An indexed cache failure MUST leave that scope unavailable to cached reads and search until removal succeeds, without publishing any replacement event.

Shared browser cache ownership MUST remain serialized through initialization and shutdown; concurrent view transitions MUST NOT leak an owner reference or open a competing database while its predecessor is closing.

Configured private-room authorization MUST restrict offline cached search and indexed history even before signed room metadata is available locally. Changing that configuration MUST remove formerly public plaintext and its reference descendants while preserving unrelated public coverage.

Published npm build helpers keep declaration types independent of their build
Vite peer graph. Consumer validation compiles the public helper in each host's
own Vite configuration before packaging that host.

For LC-UI-049, architecture budgets MUST reflect the extracted activity controls
and shared profile action layout; UI contract examples cover the same public
components used in production, including narrow activity panels.

LC-UI-049 reference-menu composition and navigation regression coverage update
the architecture baseline with their owning modules; relay payloads are unchanged.
The repository Log shortcut extends only these menu and reference modules,
with its focused ordering and destination stories reflected in their budgets.
Shareable Log selection extracts file loading and restoration from the Log
component; architecture budgets MUST track those owners without growing the
application composition root.

Public agent conversations join verified source message events with checkpoint records. Commit feedback reuses repository note events and exact diff anchors; projections share event identity across thread, commit and activity views. No owner telemetry enters public projections.

The local project discussion fixture also publishes an owner review comment on
the agent checkpoint and a reaction on its canonical assistant message. Both
use standard event encodings without invoking the configured runtime agent.

Local project fixtures publish version 3 curated canonical agent context,
including visible thinking, plans, completed tool results, permissions, and one
usage snapshot. They do not require omissions or capture coverage as visible
rows. Their ordinary messages and review comments retain signed request/thread
references so functional stories exercise the production association readers.

For LC-UI-036, repository validation uses the configured formatter on source
and architecture fixtures, strict Svelte and TypeScript checks, and the
existing browser diagnostic guard. Formatting-only fixture updates preserve
their failing architecture cases. Functional, browser, relay, consumer, and
build results are recorded separately; visual baselines remain unchanged.
The aggregate check MUST run the complete Storybook suite in eight sequential
Vitest shards with a fresh browser process per shard, preserving interaction,
accessibility, and runtime diagnostics. It MUST stop and fail on a nonzero
exit, signal, or process-start failure. `test:storybook` retains the direct
Vitest command for focused tests; `test:storybook:all` owns complete coverage.

LC-UI-044 records the typed activity state and permission settlement owners, their regressions, and the reduced controller and scope-contract budgets in the architecture baseline.

LC-UI-044 records approval-policy parsing, exact acknowledgement checks and the updated editor/Activity stories, with reduced controller/editor budgets.

Application permission notifications extract relay EOSE classification, frame
projection, and application toast ownership. The architecture baseline lowers
the touched controller, session, application and harness budgets; their tests
and validation record do not alter registry ingestion.

Agent alignment acceptance records distinguish temporary packed source dependencies
from installed services. Freshness checks cover archived progress, exact thread
isolation and signed snapshot recovery before installed-build acceptance.

For LC-UI-044, verification MUST exercise the shared transcript's durable
comment anchors, live draft persistence, original-conversation projection and
completed-turn Continue; visual review remains pending.

For LC-UI-044, native checkpoint and same-second reply regressions MUST exercise
signed materialization and production thread comment controls. The cold local
acceptance workflow MUST rebuild native checkpoint tools, retain passive comments
through controller restart, and verify next-invocation feedback delivery once.

For LC-UI-044 and LC-ARCH-028, transcript-reply acceptance MUST exercise the
packed Design Core per-call composition contract and shared message actions,
including keyboard/touch access, ordinary draft restoration, failed-send retry,
live persistence, signed-target links, scoped reactions and deduplicated feedback.
The message, reply-context and thread-composer architecture budgets ratchet down after extraction.
Validation records MUST separate focused, browser, consumer and aggregate lanes;
changed stories remain visual-pending and package publication is a later step.
