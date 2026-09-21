# Architecture

For LC-ARCH-028, the combined agent-editor model picker extracts catalog thinking, parse, row, and harness-tab helpers so `CommunityAgentEditorDialog.svelte` and `agent-runtime-catalog.ts` shrink instead of growing. Harness icons, the Command View picker, and catalog/refresh plays live in extracted editor owners. For LC-UI-044, plan snapshot parsing and the Activity list live in extracted transcript owners so the activity model and transcript shell do not grow. Composer working reuses Design Core Reasoning, failed transcript records omit send-status metadata, and composer activity plays live in an extracted story owner. The Activity feed owner composes Design Core Chat Layout and LayoutScrollButton so pinning, scroll-to-latest, and New messages stay out of the activity shell. Identity and toolbar chrome live in an extracted header owner so that shell budget drops.

LC-UI-049 public transcript interaction adapters and thread context projections stay in the component/project owners. Tool-name and command-envelope fixture coverage updates the path budgets in `scripts/architecture-baseline.json`. The thread projection reads the existing application-owned agent model through its shared context, keeping request-scoped owner Activity out of the thread panel and application composition hotspots. Shared application message actions preserve existing channel permission and publishing boundaries while keeping the application composition budget from growing.

For LC-UI-049, repository context parsing, transient preview retention, activity grouping and commit routing live in separate project modules. Commit metadata and expandable context compose through their owning components. Agent context and Files changed share the commit-section disclosure component; its extraction lowers the Projects composition budget. Live context remains session memory, expires after five minutes and is discarded on teardown. Architecture budgets ratchet down after route and metadata extraction; bounded composition and fixture additions carry per-file justifications. Public allowlist owners map first-class plan, permission, and usage records and hide leftover lifecycle, extension, file, and command rows so the context-transcript budget drops after extraction. Public tool rows keep the invocation name and surface command or kind from the envelope.

The additive agent session boundary owns authenticated discovery, transient
subscriptions, contact-list mutations, and a serialized owner-management queue.
That queue creates, edits, lists, and deletes owner-signed persona heads and
links them to owner-signed agent instances without mutating the agent-signed
public profile. The controller forwards those operations through its existing
authenticated action boundary and refreshes the verified directory only after
relay acceptance. Persona presentation therefore updates while an agent is
offline, while unknown persona and legacy instance configuration remains on its
original event. Standalone persona creation and editing use the same serialized
queue without synthesizing or rewriting an agent instance. Local activity
archive restoration runs independently so a slow storage backend cannot block
the live relay directory. Its protocol rules are defined in [Agents and saved
activity](agents.md). Custom Community sources may omit this boundary without
changing existing behavior. The direct `@noble/curves`
runtime dependency supplies BIP-340 verification for NIP-OA owner attestations.
Live working state tracks independent turns and their timestamp/sequence order,
so late starts cannot resurrect completed turns and saved events never mark an
agent as running. The application consumes the optional agent model through
its existing navigation and exclusive sidebar composition.
The managed-agent runtime stays outside Community as an independently deployed
controller. Community derives pending approvals and active conversation scopes
from verified encrypted telemetry, while its session boundary only signs and
publishes encrypted controls. The controller remains authoritative for its ACP
harness and option catalog; Community may display that catalog and save owner
defaults for future sessions. Per-harness catalog parsing and editor selection
live in dedicated runtime-catalog modules so the agent contract and observer
parser budgets can drop after extraction. The editor model field owns the
empty and loading catalog menu so the shared dialog budget can drop after
that extraction. Empty-catalog refresh, selected-harness catalog refresh, last-known Start/Stop labels, and
editor runtime default rows live in dedicated modules so the shared dialog,
directory, and application budgets do not grow. Workspace paths, process lifecycle,
and NIP-46 credentials remain operator-owned controller configuration. Channel
memory review uses the same ephemeral request boundary and never enters
Community's
activity archive.
When the selected relay advertises `lapis_managed_agents`, this same boundary
keeps only a disposable NIP-46 client key and resumable draft in memory, signs
the owner records, delegates the one allowed profile signature to the relay
bunker, and returns the resulting one-time controller bundle directly to the
active view. It does not route the bundle through controller state, activity
storage, analytics, or a browser persistence adapter.
Activity catch-up keeps its per-context cursor behind the same memory, Turso,
IndexedDB, and worker storage seam. A replacement live subscription includes
the target agent before Community publishes a synchronization control.
The version-2 activity contract clears older encrypted activity rows and
checkpoints once, while preserving the identity projection and ordinary event
cache. Live and replayed transcript records then enter one stable-id reducer.
Agent channel presentation composes public Dialog, Command View, and menu
primitives; channel selection stays local until the existing add-member action
is confirmed. Membership authority and the controller's action contracts remain
unchanged.
The session binds its default or injected HTTP fetch to the browser global so
native WebKit requests retain their required receiver. Capability discovery
probes the authenticated bridge for Buzz's numeric NIP-11 advertisement.
Community resolves Bits UI 2.19.2 within Design Core’s existing range: its
scroll-area resize handler no longer schedules work after a sidebar is
destroyed. The agent application stories cover these rapid panel transitions.

For LC-SPEC-002, Community dialog close controls retain the shared Design Core
button identity while the owning component supplies the compact Lucide X size,
rounded target, and hover/focus-visible feedback required by its visual
context. The production-component story verifies those local presentation
contracts.

For LC-ARCH-021, Docker-backed project acceptance composes the sibling relay's
private WalGit and RustFS services behind the public relay gateway. Community
receives only the ordinary relay and HTTP origins and never receives a sidecar
token or assumes a local Git checkout. Channel `maintainer` is a built-in
NIP-29 role beside `writer`. Community projects the same `CanMaintain`
decision the relay enforces: group creator, kind `39001` administrators, or a
current member with `maintainer`. That capability gates repository create,
trusted review, merge, task assignment, and task status. Hosted WalGit
repositories advertise merge plus relay-owned named rulesets,
including per-rule targets, bypass actors, independent restrict
create/update/delete flags, required-approval counts, and additive
`protected-ref` announcement tags;
GitHub-authoritative repositories keep clone/push/protection on GitHub.
`OWNERS.md` on the protected tip can add path reviewers but cannot loosen
those defaults.
Settings open the bound channel People member command in place and document
that `OWNERS.md` lives at the repository root on the protected branch.
After a confirmed native merge, Community publishes the merging
maintainer's signed `1631`. `writer` remains chat and posting policy only.
The `30617` address owner is not a hidden superuser. Buzz Desktop may still
display author- or owner-trusted reviews; Lapis Community does not. The dedicated Vite application composes
the NIP-34 project source from the same relay factory and active Community
identity as channels and Registry, so the ordinary local stack exercises the
production-shaped browser path rather than a Storybook-only adapter.
The integrated Community, Registry, and Projects destinations resolve one
canonical development relay endpoint; only isolated Storybook scenarios may
select an independent Registry relay.
Repository announcements remain signed-event authority, while Community reads
the relay's per-coordinate provider-neutral capability document to select any
content backend that explicitly advertises browsing. This allows WalGit and
GitHub-backed repositories to share the same relay gateway without inferring
behavior from clone URLs or exposing provider credentials to the browser.
Repository agent context remains a separate deterministic project projection:
`src/projects` validates and assembles signed checkpoint manifests and pages,
while the repository-log component only selects normalized records for its
current revision or operation. The presentation layer never treats agent
context as registry state or as an authority for repository history.
Authenticated repository GET results MUST use a short-lived, identity-scoped
in-memory cache that survives presentation-session replacement, remains
bounded, bypasses progress streams, and is cleared after forge mutations.
When the active Community relay supplies project transport, project loading
MUST wait for relay and identity restoration to settle, close while the relay
is unavailable, and resume once after reconnection. Catalog restoration and
live refresh MUST NOT make the loaded catalog a reactive trigger for reopening
the project session; an empty authoritative catalog MUST settle without a
request loop. The session lifecycle MUST follow the individual source, relay,
identity, and channel values rather than the identity of a caller-created
options wrapper. Cancellation during asynchronous setup and any setup failure
MUST close the candidate session or relay before returning.
That application runs under a checkout-owned supervisor: source updates remain
Vite HMR events, while generated fixture-environment updates restart Vite so
its compile-time public trust configuration cannot become stale. Ownership is
recorded per checkout and port, and replacement fails closed for a listener
owned by another checkout.

For LC-ARCH-011, the dedicated Vite host uses the same prebuilt Turso bundle
transform as the package and Storybook client/worker pipelines. The transform
preserves the embedded WASM bytes while normalizing URL and worker expressions
before Vite scans them. A rendered shell or successful
HTML request alone does not establish storage readiness: cold acceptance must
load the database module and complete an OPFS open, query, and close.

Registry’s built-in community composition may temporarily isolate the bounded
discussion stream from plugin-detail presentation while earlier windows remain
available. That private presentation context does not alter consumer-provided
discussion snippets or add a public component or data-source interface.

For LC-ARCH-008, a normalized public message MAY retain its already verified
source event for explicit export actions. Presentation MUST treat that event as
read-only evidence and MUST continue to render only normalized safe content.

For LC-ARCH-010, `CommunityApplication` MUST privately share the controller's
active identity and existing deferred authentication runner with nested
Registry discussions. This bridge MUST remain internal to the application
composition and MUST NOT add signer access to the public controller contract.

For LC-UI-022, an identity-only controller reconnect MUST reuse the active
verified public runtime projection and synchronization plan instead of
replaying the disposable cache. It MUST reopen author-bound relay access and
refresh identity-private state without making public browsing unavailable.

For LC-NOSTR-019, Pulse is an optional live window on `CommunitySession` and an
additive controller model/action group. Relay responses are verified and
materialized outside the persistent community event runtime; only events
published by the local signer may pass through the existing cache path. Custom
sources and controllers that omit the Pulse capability remain compatible.
`createCommunityController` composes dedicated history, Pulse, and operation
modules that receive controller context and MUST NOT import the factory.

For LC-UI-030, the public testing runtime supplies signed Pulse profile,
contact-list, note, reaction, and deletion events so application and component
stories exercise the production controller projection rather than a visual
duplicate.

For LC-UI-032, the shared memory and Docker relay contract exercises writer
grant and revocation, writer-only publication, reusable invite creation, and
invite-backed joining through the same NIP-29 controls used by the production
application.

For LC-ARCH-007, the shared Community materializer MUST derive room message
totals and last activity from the same verified, visible group-message event
set used by production, memory, Storybook, and Docker projections. These
aggregates remain read-model metadata and MUST NOT become a second content
authority.

For LC-UI-033, `CommunityApplication` owns plugin-release scope, history, menu
content, counts, and review projections while Design Core owns the structural
multi-panel convention. The built-in details/thread/profile panel and the
independently registered overview are declarative right-sidebar siblings whose
priority, replacement presentation, resizing, and transient suspension are
projected by the shared App Shell controller. Reviews and People use the public
Design Core surface layer instead of Community-owned DOM measurements or
overlay mutation. Existing sources and locations that omit the optional review
surface retain the ordinary workspace, and `CommunityAppShell` remains only the
application frame through which consumers compose public App Shell parts.

For LC-NOSTR-020, relay-defined role and invite support remains an additive
session/controller capability. The controller owns authentication, configured
relay authority validation, pending membership, and publication rollback;
consumers that omit the optional group-loading and management actions remain
compatible. The materializer always projects built-in Writer and Maintainer
role definitions. Writer remains write-restricted posting policy; Maintainer
is repository create, review, and merge capability on that channel.

Dependency refreshes advance the minimum compatible Design Core release in the
portable package manifest and committed lockfile together, without changing the
public import boundary.

Repository-owned source validation keeps that public boundary visible in UI
code: all semantic and interactive chip presentations resolve to the exported
`CommunityChip`, whose typed size, tone, shape, icon, link, and action variants compose
the public Design Core Badge and Button primitives. Muted square tokens use the
same currentcolor-mix fill as History copy buttons. The checker is
development-only and prevents consumer components from creating or locally
restyling parallel chip implementations.

For LC-ARCH-028, `scripts/check-architecture.mjs` enforces counted-line budgets
and the feature dependency matrix against `scripts/architecture-baseline.json`.
Organisation plans under `docs/plans/` are not canonical requirements; they map
to this chapter so checker and baseline changes stay spec-first. Fixture trees
under `scripts/architecture-fixtures/` are harness-only and MUST remain outside
`svelte-check`, UI policy, and `tsc` includes. Agent runtime and memory parsers,
agent-control validation, NIP-29 command templates and content-window loaders,
and community room, message, and inbox projectors live beside their factories as
dedicated modules. Message reply-summary extraction records the new
`CommunityMessageReplySummary` leaf and lowers the `CommunityMessage.svelte`
path budget. A path budget that exceeds the current counted size by more
than twenty counted lines MUST fail as stale. Keytr local development
storage-relay hosts remain in the recorded auth path budgets.
Deterministic local project fixtures split jj-sync payload construction from
relay publication so both modules remain within the same production-file budget.
Persistent agent mentions extract audience, picker, send-tag, and thread
composer modules, lowering the `CommunityApplication.svelte`,
`CommunityChatComposer.svelte`, `CommunityConversation.svelte`, and
`CommunityThreadPanel.svelte` path budgets in the same change.
Composer autocomplete and formatting-action sync extract to dedicated
modules, lowering the `CommunityChatComposer.svelte` path budget so
repeated mention queries cannot grow that hotspot.
Mention-button lock badges and colliding mention-token resolution
extract to dedicated modules, lowering the `composer-extension.ts`
path budget so the composer hotspot does not grow.
CommunityProjects Overview README fullWidth alignment updates the
`CommunityProjects.svelte` and `CommunityProjects.stories.svelte` path
budgets in the same change. Extracting local-fixture addressable-head
retention from `src/fixture/seed.ts` lowers that hotspot budget and
records the new `seed-retention` module. Extracting the repository Options
rail and `options` surface lowers the `CommunityApplication.svelte` path
budget and records `project-rail` plus `CommunityProjectsRepositoryRail`.
Named rulesets extract `protection-ruleset`, `CommunityProjectsRulesetList`,
`CommunityProjectsRulesetPanel`, `CommunityProjectsRulesetTables`,
`CommunityProjectsRulesetRules`, and `CommunityProjectsRulesetEditor`;
member-command room resolution stays beside Application.
Selected-project hub extracts (`projectVisibleActivity`,
`loadProjectCommitActivity`, repository grouping, the Repositories rail, and
commit/people lists) lower the Application and CommunityProjects budgets and
record the new project modules in the same change.

## Requirements

For LC-ARCH-014, the presence session serializes manual preference changes
after any in-flight background refresh. The pending manual operation prevents
another refresh or preference change from overtaking it. Disposal cancels the
queued operation before publication; a background refresh must not make a
valid profile-menu selection fail merely because it is busy.

| ID          | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-ARCH-001 | The repository MUST publish one package named `@lapismd/lapis-community`; runtime code MUST live beneath `src` and MUST NOT be divided into nested workspace packages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| LC-ARCH-002 | Signed Nostr events retrieved from configured relays MUST remain the registry source of truth. The package MUST NOT introduce an authoritative registry database or submission API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| LC-ARCH-003 | `src/auth`, `src/nostr`, and `src/protocol` MUST own signer authentication, relay and Nostr-authenticated HTTP transport/querying, and deterministic event interpretation respectively. Relay authentication adapters MUST remain stable per signer, while the WebSocket transport MUST keep author-bound authenticated connections separate so identity replacement cannot reuse another author's NIP-42 session or interrupt existing read subscriptions. Fixture and materializer code MUST remain explicit supporting boundaries under `src`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| LC-ARCH-004 | The package MUST expose stable root, `auth`, `nostr`, `protocol`, `components`, `community`, and test-only `testing` entry points without leaking checkout-relative or workspace dependency paths into its publishable manifest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| LC-ARCH-005 | Community presentation code and Storybook MUST consume Design Core through its published semantic-version range and public package exports. The package MAY depend directly on Mira and its public CodeMirror peer APIs to own a Community-specific Markdown composer, completion behavior, and safe chat renderer outside Design Core. Direct icon dependencies MAY supply glyphs; framework-neutral emoji data/rendering and toast dependencies MAY provide package-owned NIP-30 and feedback behavior inside public Design Core chrome. Local source aliases, file dependencies, copied Design Core implementations, and Design Core forks are prohibited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LC-ARCH-006 | The public `CommunityAppShell` MUST be the single application-frame composition for Inbox, channel, thread, and shell-backed component previews. Those surfaces MUST populate public Design Core App Shell regions supplied by that frame instead of recreating header, viewport, sidebar, joined-panel, constraint, replacement, or structural-layer geometry in Community code or Storybook fixtures. Consumers MAY declaratively compose arbitrary independently controlled same-side Design Core sidebars and one structural surface layer as direct shell children; Community retains application routing and content ownership. The complete examples MUST remain consolidated in the final App Shell catalog entry and include a non-release multi-panel composition. `CommunityApplication` destination hosts for settings, agents, Pulse, and Inbox MUST populate Design Core AppShell body regions inside that frame and MUST NOT replace AppShell or recreate shell geometry. `CommunityProjects` named surfaces for activity, pull-request review, the repository pane, and create dialogs MUST compose from the projects composition root inside that AppShell body and MUST NOT replace AppShell or recreate shell geometry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LC-ARCH-007 | Community sources, including the bounded registry adapter, MUST depend on a `CommunityRelayFactory` rather than constructing a concrete relay transport. The in-memory and WebSocket relay implementations MUST satisfy one observable contract so production, isolated Storybook scenarios, disposable Docker integration tests, explicitly selected live-relay previews, and the dedicated Vite debugging application exercise the same materializer and controller. The reusable signed application scenario MUST include multi-author forum replies sufficient to exercise recent-participant and activity projection in the composed App Shell. Sources MAY discover public NIP-29 rooms from authoritative relay metadata, including compatible Buzz room-type tags, but configured rooms MUST retain stable identity and discovery MUST NOT admit hidden groups or bypass the shared materializer. Relay queries MUST preserve caller-supplied wire limits; multi-relay reads MUST deduplicate, deterministically order, and globally bound merged results. The relay boundary MUST expose optional multi-filter NIP-45 counts with exact/approximate state and optional HLL metadata while retaining the numeric single-filter API. Multi-relay counts MUST prefer the greatest exact result and use the greatest estimate only when no exact result is available. An unsupported NIP-45 COUNT MUST fail explicitly and MUST NOT fall back to an unbounded event query. Live previews and the Vite debug application MUST NOT seed fixture events; writes MUST use an explicitly selected browser-extension, remote, ephemeral, or imported-key signer. The Vite debug application MUST render the production application shell without out-of-band development controls, and signer credentials MUST be collected through the host-provided login flow. It MUST keep the shell bounded to the browser viewport so application-owned content remains scrollable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LC-ARCH-008 | The public reactive `CommunityController` MUST consume a transport-independent `CommunityDataSource`, expose normalized state and stable actions, preserve result kinds and stable room identities for search navigation, expose direct-message participant identifiers, profile metadata, unique reply participants, and latest reply activity in normalized models, and separate channel-root timelines from their complete thread projections. Forum replies MUST remain flat within the main content surface, and the controller MUST resolve an undirected submission made inside an active forum topic to that topic root before publishing. Relative activity labels MUST derive from an explicit projection time so deterministic stories and tests do not depend on wall-clock time. It MUST start live observation before its initial snapshot, buffer subscription replay until that snapshot is committed, batch subsequent live delivery, suppress duplicate IDs before reactive assignment, and cancel stale work when disposed or switched. Paged sources MUST bootstrap authoritative room state without public history, expose cached navigation and Registry before background loading completes, prioritize selected rooms, load bounded history on explicit navigation or pagination from committed page coverage, and expose optional overall and per-room sync state. Unpaged sources MUST retain complete snapshots. Materialization MUST remain read-only for events held in reactive or immutable collections and MUST reuse boundary verification rather than rehashing accepted events. Room, message, and inbox projectors MUST remain dedicated modules composed by the workspace factory. It MUST expose connection failures, support explicit reconnect, and own validated relay-URL changes through an injected local configuration store before rebuilding the active relay session.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| LC-ARCH-009 | Identity signing and optional NIP-44 encryption MUST remain injected capabilities, while local and NIP-78 persistence MUST implement one `CommunityStateStore` boundary so anonymous reads and test runtimes do not depend on browser signers or remote storage. Registry discussion drafts, read overrides, follow and bookmark choices, and docked-composer height MAY remain versioned browser-local presentation preferences; those records MUST be scoped by normalized relay, support group, viewer, and root topic and MUST NOT publish personal state to the relay.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| LC-ARCH-010 | `CommunityController` MUST accept either a static identity or a `CommunityIdentityConnector`, allow an interactive identity connector to be selected after construction, expose normalized authentication, member-directory, reply-target, navigation-preference, room-membership, lifecycle, action-specific publish/reaction availability, and action state, and reconnect its transport-independent sessions before retrying one protected action after interactive sign-in. Signing out MUST clear identity-bound projection state, reconnect anonymously, and retain public browsing. Known nonmembers MUST get a join prompt only when the selected action requires membership; open groups remain relay-authoritative, and write-restricted groups MUST deny ordinary posts while permitting reactions unless closed-group membership policy denies them. Role denials MUST expose a reason; queued participation MUST resume only after projected membership confirms the join; incomplete state remains relay-authoritative. Invalid commands and relay failures MUST produce structured, dismissible operation failures with the original relay reason and safe retryability instead of silently returning or discarding rejected promises. Room, member, reaction, read-state, custom-section, profile, status, portable Wave, and relay actions MUST remain controller-owned. The portable Wave action MUST send a `👋` NIP-17 direct message through authentication retry, while a typed host extension MAY override that behavior. Profile mutations MUST await relay acceptance and refresh the normalized settings and member projections; non-portable terminal, huddle, agent, activity-log, archive, edit, feedback, and follow behaviors MUST be exposed only through typed optional host extensions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LC-ARCH-011 | The package MUST expose one rebuildable `CommunityEventStore` contract with memory, IndexedDB, and lazily loaded Turso-WASM/OPFS implementations. The Turso adapter MUST consume the driver's prebuilt browser bundle so development, Storybook, and production use its self-contained WASM worker graph without Vite transforming or incompletely initializing internal workers. Browser selection MUST prefer Turso only when OPFS, cross-origin isolation, shared memory, and Web Locks are available, then degrade to IndexedDB and memory without changing source or controller behavior. Concurrent Community runtimes in one browser owner context MUST share one reference-counted Turso connection for each database name so multiple views and hot-reloaded package copies do not trigger an OPFS ownership fallback. Stored event envelopes MUST remain verified, relay-derived, identity/scope partitioned, bounded by configurable retention, and disposable; the store MUST NOT become an authoritative application database. Persistent storage MUST contain only public NIP-29 events and encrypted NIP-17 gift wraps, never decrypted rumors or private NIP-29 plaintext. The controller MUST materialize valid live inbox wraps in memory after encrypted ingestion and refresh the active projection without waiting for another synchronization cycle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LC-ARCH-012 | `CommunityEventRuntime` MUST expose restoration, batched ingestion, projection, local search, and disposal through one pure runtime core shared by inline and dedicated-worker execution. The runtime MUST retain the canonical raw event collection, return only newly accepted event deltas after restoration, and return normalized workspace, Inbox, settings, and search projections without retransmitting the complete graph on each revision. Browser execution MUST recover one worker crash by restoring the disposable cache and MUST fall back to the inline runtime after a repeated failure while exposing degradation. When Turso-WASM/OPFS is selected, the browser owner context MUST open the database and execute the shared runtime inline so the Turso driver can own its worker pool without a nested application worker. Runtime responses MUST carry the controller generation and monotonic revision so stale work after reconnect or scope changes can be ignored. WebSocket transport, interactive NIP-07 signing, and Svelte state MUST remain on the main thread.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LC-ARCH-013 | The public NIP-29 registry catalog source MUST open live release and curator subscriptions before querying configured relays, merge verified cached, queried, and buffered events without rollback, hydrate exact hash-verified manifests from the relay-owned HTTP Blossom endpoint, and build the existing deterministic projection in browser memory. Images, Markdown, and projected install bundle URLs MUST remain on that relay endpoint and MUST be addressed by signed SHA-256; the source MUST NOT fall back to publisher or fixture resource origins. Its bounded snapshot store MUST persist only raw signed events, exact manifest bytes, synchronization metadata, and lazily requested verified resources in trust-fingerprinted memory or IndexedDB partitions. Any one relay completing the registry queries MAY mark the source fresh; partial failures MUST remain visible, failed hydration MUST retain the preceding revision, and cached state MUST remain non-authoritative and disposable. Head-aware projections MUST require one identical current signed head on the configured install quorum, preserve complete immutable release evidence for pinned historical detail and proofs, and re-query that quorum before subscription events affect trusted state. The source MUST use an injected reader signer or ephemeral in-memory signer for read-only NIP-42 authentication and MUST NOT prompt NIP-07 for catalog browsing. Manifest hydration, live catalog subscriptions, and portable release proofs MUST remain dedicated modules composed by that source factory.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| LC-ARCH-014 | Community identity presentation MUST consume controller-reconciled NIP-38 text status and a separate relay-authoritative presence projection. Presence MUST combine live sessions, honor account-wide Auto/Away/Offline preferences, expire after 180 seconds, and show Unknown on unavailable or unverified data. Presence MUST remain outside durable content caches and registry materialization. Heartbeats MUST preserve unrelated editor state, and pending signing or network work MUST NOT extend displayed presence beyond its expiry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LC-ARCH-015 | Registry sources MUST distinguish browse freshness from install readiness. One complete configured relay MAY support browsing, but installation MUST require the configured curation quorum over release and decision queries. Cached or partial state MUST NOT be install-ready.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| LC-ARCH-016 | The host-owned Nostr signer broker MUST implement the public host contract structurally without importing host internals. It MUST keep local secret keys, NIP-46 invitation data, and NIP-46 client keys behind an injected OS-keychain-compatible credential store; expose only opaque account metadata and signed or encrypted results; require a host permission decision before every account or cryptographic operation; validate exact signed event templates; and close remote sessions without deleting durable credentials. Ordinary account metadata MAY use a separate non-secret store.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| LC-ARCH-017 | Host applications MUST be able to import the live NIP-29 registry source from a lightweight public package subpath without evaluating the registry presentation barrel. The subpath MUST expose the same production source used by Community and MUST NOT duplicate materialization or proof policy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| LC-ARCH-018 | Registry detail lookup MUST accept the stable plugin identity alone. Host adapters MUST NOT have to reconstruct Community-only presentation fields before resolving a detail from the deterministic projection. HTTP sources MUST derive the canonical `plugins/<id>.json` projection path from that identity rather than trust a caller-supplied location.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| LC-ARCH-019 | A host MAY revalidate stored Nostr release evidence against an install-ready live source using the previously verified inner-payload digest and size. Relay freshness alone MUST NOT clear an offline revocation warning. The Registry source MUST keep a non-disposable security high-water record scoped by plugin, release group, authority epoch, and pinned curator keys, detect lower or missing heads as rollback, detect conflicting content at one revision as equivocation, and treat expired signed heads or unreconciled publisher withdrawals as stale. These states MUST preserve browsing while blocking installs and ordinary management. Resetting this history MUST require a separately confirmed recovery action and MUST re-bootstrap only from a complete relay snapshot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LC-ARCH-020 | Optional edit and report actions MUST remain additive for custom controllers. The built-in Community and Registry discussion controllers MUST enforce author, room, identity, and curator-recipient boundaries before publication. Registry review mutations MUST reuse the same signed relay source and host-gated identity flow without coupling custom discussion snippets to the built-in controller.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LC-ARCH-021 | Project collaboration MUST be an opt-in package capability behind the public `./projects` source, model, builder, reducer, pagination, patch, activity, capability-discovery, and repository-read boundary. It MUST use the host's active Community relay and injected Nostr identity, without introducing a project database, Git checkout assumption, sidecar credential, project-specific relay REST API, or client-side authorization policy. The application MUST project a Buzz-shaped Activity-first workspace, expandable project/channel navigation, in-place project detail, and a repository-aware outer rail from that same source rather than routing projects through a channel or modal overlay. WebSocket `REQ`/`EVENT` remains the primary Buzz-compatible event transport; generic authenticated HTTP remains an equivalent verification path. Repository content and pull-request comparisons MUST be fetched only through the relay's NIP-98/NIP-29 gateway after the repository coordinate explicitly advertises the corresponding provider-neutral capability; signed clone URLs MUST NOT imply browser access. Pull-request comment reactions MUST remain ordinary signed NIP-25 events in the shared project source and mutation boundary so provider bridging does not introduce a Community-only reaction store or API. Multi-event operations MUST expose partial completion for deterministic retry rather than pretending an atomic publish. Trusted review and merge projections MUST use the repository channel `CanMaintain` set rather than requested reviewers or the `30617` owner. Merge execution MUST be offered only when the relay advertises the provider-neutral merge capability, the viewer `CanMaintain` the repository channel, and a current-tip approval exists from another maintainer, administrator, or OWNERS pubkey, MUST submit the full expected pull-request head through the authenticated relay command boundary, and MUST wait for the durable operation to complete or fail rather than simulating merged state in the client. Relay-backed GitHub merge, provider-neutral CI, and relay repository import are current foundations. Live default-branch protection is implemented. Automatic pull-request revisions [deferred: DEFER-FORGE-002], native WalGit merge [deferred: DEFER-FORGE-003], repository-state publication [deferred: DEFER-FORGE-004], and Community CI/import controls [deferred: DEFER-FORGE-008] [deferred: DEFER-FORGE-009] remain tracked separately. |
| LC-ARCH-023 | Relay application authentication MUST remain an optional adapter beneath `src/auth`. The adapter MUST validate public configuration and account-session responses, send credentialed requests without caching, establish Nostr sessions with a body-bound NIP-98 event, restore active managed and NIP-46 signers, require reconnection for external signers, validate every relay-signed event against the requested template, canonical account pubkey, event identifier, and signature, expose NIP-44 through the restored signer, and degrade an absent session to anonymous public browsing. Provider identities, signer custody, GitHub link state, and the canonical Nostr pubkey MUST remain separate account fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LC-ARCH-024 | Optional relay account management MUST remain behind the application auth adapter and exact server-advertised capabilities. Browser passkey operations MUST translate only the standard WebAuthn binary fields and surface cancellation without retaining credential responses. Managed-key transfer MUST decrypt the relay envelope only in browser memory using the specified X25519, HKDF-SHA256, and AES-GCM contract, verify that the secret derives the canonical account pubkey, and require a same-pubkey remote signer to produce the custody proof. Private keys, device keys, transfer ciphertext, possession challenges, and bunker invitations MUST NOT enter persistent browser storage, logs, analytics, or error text, except that the dedicated Vite development host MAY persist a pasted private-key secret in `localStorage` for refresh restore and MUST show a dismissible forget-key toast; that persistence MUST remain in `dev/community` and MUST NOT ship in the published package. A completed mutation MUST refresh the account session before the application replaces or disconnects its controller identity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| LC-ARCH-025 | Browser hosts MAY supply Keytr through a narrow structural adapter under the public auth boundary. The published Community package MUST NOT import or bundle the Keytr implementation. Keytr MUST remain an external browser signer: decrypted secret keys and WebAuthn PRF material MUST stay in browser memory, MUST NOT be sent to the application relay, stored, logged, or included in error text, and MUST be zeroed when login fails, the signer is replaced, the session expires, the identity disconnects, or its controller is disposed. Imported secrets MUST be validated before invoking the adapter, and sanitized failures MUST distinguish invalid input from authenticator, relay, and publication failures. A restored external relay session MUST require reconnection to the same canonical pubkey before signing. Keytr support MUST remain disabled unless the host supplies the adapter and a non-empty validated storage-relay list; insecure `ws:` storage MUST remain limited to loopback development hosts, including the documented `local-community.lapis.md` desktop development host. The reference Vite host MAY inject the reviewed implementation with a same-origin development RP and a bounded persistent kind `31777` storage endpoint, but that endpoint MUST remain development-only and validate signatures before storage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| LC-ARCH-028 | Repository validation MUST enforce counted-line budgets and the community/components/protocol dependency matrix with `scripts/check-architecture.mjs`. New production source MUST NOT exceed 300 counted lines. Existing files MUST NOT increase counted lines without updating the path budget in `scripts/architecture-baseline.json` in the same change. A recorded budget MUST fail when the current counted size plus twenty is still below that budget. `src/community` production modules MUST NOT import `src/components`, including type-only imports. Production modules MUST NOT import tests, stories, or `src/testing`. Composition roots MAY import feature public APIs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Desktop application authentication remains outside this browser slice
[deferred: DEFER-AUTH-001]. The account boundary also records follow-up work for
multi-passkey recovery [deferred: DEFER-AUTH-002], durable GitHub identity
unlinking [deferred: DEFER-AUTH-003], persistent browser/device signer
connections [deferred: DEFER-AUTH-004], custody rotation after disclosure
[deferred: DEFER-AUTH-005], and general protected-action replay
[deferred: DEFER-AUTH-006]. Additional providers, a general relay bunker,
legacy account migration, and default raw-key login require explicit scope
decisions [deferred: DEFER-AUTH-007] [deferred: DEFER-AUTH-008]
[deferred: DEFER-AUTH-009] [deferred: DEFER-AUTH-010].

For LC-ARCH-008, a configured relay override MUST remain distinguishable from
the host-provided default in normalized controller state. Removing that
override MUST delete the local configuration record, restore the original
scope URL, and rebuild the active relay session through the same controller
operation boundary as an edited URL.

For LC-ARCH-021, project presentation MUST remain inside the existing
`CommunityAppShell` composition. Fixed project navigation uses its header/body
regions, repository browsing uses its resizable body sidebar, and the contextual
project rail remains an independently controlled outer-right sidebar. Exclusive
Active/Completed task and Open/Merged review filters, plus the Commits Latest
label, live in shared project collection-filter helpers so one pressed rail
state can apply without growing the application or projects roots. Those
filter rows render as indented secondary children of Tasks and Reviews. Named
Named multi-select Activity event-type filters with page-scoped persistence and history-aware project Back live in extracted
helpers so the application and projects roots do not grow. Task
assignee selection reuses the application member command and publishes only
through the injected project session; it does not introduce component-local
membership authority. Removing a directly attached project channel MUST remain
an owner-authorized project replacement through that same mutation boundary;
it MUST NOT delete the NIP-29 channel or silently detach a repository-owned
channel association.
The shared project model MUST distinguish signed listing intent from NIP-29
access. Reducers normalize only the Buzz `unlisted` value, builders omit the
tag for the default listed state, and presentation filters aggregate discovery
without removing unlisted projects from the underlying catalog needed by exact
routes and bound-channel context.
Canonical project browser routes persist only the addressable project or
repository coordinate and top-level surface. Fragment hashes MUST keep the
NIP-34 `:` separators literal and MUST still parse percent-encoded `%3A`. They remain part of the composite
application location so browser history, Community history, and restored local
state resolve through one codec. Catalog normalization MUST preserve an
unresolved route until loading completes; it MUST NOT infer absence from an
empty or still-loading projection.
Project activity projection MUST retain the event category, review outcome,
assignment direction, and project coordinate needed for one deterministic
feed. Presentation MAY derive semantic icons, status labels, and weekly totals
from that projection, while
project navigation MUST resolve through the existing project-selection action
rather than introducing a second route or lookup boundary.

The static registry remains a deterministic projection. It can be rebuilt from
the event graph, configured trusted publisher and curator keys, and immutable
content-addressed manifests. The sibling `nostr-plugin-registry` repository owns
the Astro renderer, while the sibling `nostr-relay` repository owns relay
deployment and persistence.

Community presentation filtering happens after verified events enter the raw
event runtime. Registry publisher-authorization and registry-head control
events therefore remain available to the registry verifier and disposable
cache even when timelines, Inbox, activity, and search projections omit their
machine-readable payloads.

The public `registry` entry point models that projection independently of
Svelte and relay transport. Its HTTP adapter validates static projection
documents and content references for compatible consumers. Its NIP-29 adapter
verifies relay events, manifests, and viewed resources before exposing an
ephemeral browser projection. The component entry point owns host-controlled
navigation, installation requests, source-health presentation, and optional
discussion composition. Projection-local image references are made absolute
only at the HTTP adapter boundary and must remain beneath the configured
registry root; relay-backed media is exposed only through verified Blob data.

Normalized `CommunityMessageModel` values MAY retain the unique public keys from
message `p` and `P` tags as optional mention metadata. Presentation components
MUST combine that metadata with controller-owned member, room, and community
emoji models when rendering safe Markdown; they MUST NOT reinterpret relay
events or make unknown visible tokens interactive.

For LC-ARCH-021, the default browser project catalog store MUST persist raw
signature-verified events rather than derived project objects. It MUST scope
records by normalized relay URL, Community ID, and optional project channel,
restore only an exact scope, and remain a best-effort disposable optimization
over the relay-authoritative live projection.
The browser review-preference store MAY persist only presentation state. Diff
layout is scoped by normalized relay, Community, and signed-in member; viewed
files add repository, pull-request, base, and head identity so a revision
change cannot inherit stale progress. Anonymous review preferences remain
memory-only for the component session.
Pull-request reduction MUST retain every trusted lifecycle event in
chronological order in addition to the latest effective state. Presentation
MUST compose that history with the root and review activity without granting
authority to external observation events. A merged provider-backed review's
historical file set remains provider collaboration data and MUST NOT be
re-derived from the current target-branch comparison.

GitHub App connection administration for LC-ARCH-021 MUST remain behind the
relay's authenticated forge API and relay-administrator policy. The Community
source MAY create, completely replace, and revalidate a connection, but it MUST
consume only the relay's safe public connection record and MUST NOT expect the
relay to return App IDs, credential references, or secret values.
Repository retirement, merge queues, broader provider parity, NIP-34 patch
application, and production provider provisioning retain separate completion
boundaries [deferred: DEFER-FORGE-005] [deferred: DEFER-FORGE-006]
[deferred: DEFER-FORGE-007] [deferred: DEFER-FORGE-010]
[deferred: DEFER-FORGE-011].
Authenticated repository `loadRefs` MUST combine HEAD with every
`refs/branches` page, including nested sync heads, rather than treating the
HEAD-only `/refs` response as the complete picker list. The Files switcher
MUST partition `jj-sync/` carriers onto a Sync tab.
The repository workspace MUST expose an Activity tab that reuses the project
activity feed for dest-Git commits, NIP-34 work items, and kind `3901`
jj-sync operations scoped to the selected repository. Kind `3901` cards MUST
keep the full `operation_id` and `replica_id` and render them as History-style
copy buttons labelled operation ID and replica ID on one title row that
uses the remaining card width and wraps only when both cannot fit, with the
leading card glyph vertically centered on that row. A Log tab after
Activity maps kinds `3902`/`3903` from that same work-item stream onto
Community's `CommunityProjectsRevisionGraph`, matching `jj log`: ancestors of
the current view's heads, workspaces, and bookmarks. The current view is the
kind `3903` named by the latest kind `3904` `metadata.ended_at_ms`, or the
newest `3903` when no native operation time is present. Historical views stay
in the work-item stream as published evidence and MUST NOT seed rows or
workspace chips. One row per `change_id` keeps the commit the current view
names. Abandoned empty working copies are omitted. The Log `ColumnCanvas` MUST fill the remaining tab body and style
only the canvas root so column headers stay on the column chrome. The Log-tab
`AppShell.Body` MUST use `layout="regions"` so the shell body does not scroll;
column bodies MUST scroll through their Design Core ScrollAreas and MUST
window the newest graph page, revealing more rows when a body scrolls near
its end. Dest-Git
commit history MUST NOT open to build Log. Selecting a row MAY load that commit's changed-file
stats by native commit ID through `repository-source-reads` and
`repository-log-files`, then MUST render them with Design Core `FileListing`
and `FileListingViewModeToggle` in the compact bordered History host chrome.
An empty revision, or a dest-Git `git_object_not_found` response, MUST show
the FileListing empty state rather than a forge error code. Selecting a file MUST open a Design Core
`ColumnCanvas` column whose body is Design Core `FileDiff` for that dest-Git
file patch. The Diff header MUST keep `FileChangeStats` and icon-only
unified/split and wrap toggles on the trailing edge; FileDiff receives
`viewMode` and `wrap` only. Log rows MUST label change IDs and commit IDs with
Community copy buttons from kind `3902` `change_id_hex`. Log and Evolog rows MUST
lead with `CommunityMemberAvatar` using the Gravatar image for that revision's
author email, MUST expose that email in a Design Core tooltip on the avatar,
MUST NOT render the author name or email as visible row text, MUST render
`createdAt` with `CommunityRelativeTime`, and MUST NOT render a Snapshot reason
chip. Dest-Git Commits rows MUST reuse that same git-author Gravatar avatar
and MUST NOT treat a commit author email as a relay member. Blank descriptions MUST use jj's
`(empty) (no description set)` placeholder. Forked lanes MUST remain until the
shared parent so the branch edge can meet the main line. Those edges MUST
use cubic split, merge, and top-of-row converge joins.
The Log-tab outer rail MUST select Log or Op Log in place, without a new
toolbar tab. Op Log MUST project kind `3904` operation-parent edges, MUST turn commit SHAs
and change hex in operation descriptions into copy buttons, and MAY
load dest-Git files for a commit recorded in that operation's evolution map.
When a Log row is selected, an Evolog toggle MAY add a column after Log that
walks recorded `3904` predecessor maps for that change and hydrates rows from
kind `3902`. A pressed Evolog rail item MUST use the same selected background as Log and
Op Log. Closing the Evolog column MUST clear that toggle. Commit
parents, rewrite edges, and operation parents MUST stay distinct.

The agent activity archive uses the existing store owner and runtime worker
bridge. Additive store/runtime properties preserve custom adapters. Transient
Nostr kinds are excluded from ordinary runtime ingestion; observer telemetry
uses the owner-partitioned archive described in [Agents](agents.md). The
controller starts capture for only the selected signed-in community and
invalidates its private decoded state during identity or community changes.
Encrypted archive rows retain the signed agent profile and, for managed agents,
the owner-signed instance required to revalidate reciprocal custody. The JSON
identity payload evolves additively so existing external-agent rows need no
database migration and no decrypted telemetry enters identity storage.

UI composition ownership is additive: Design Core owns shared dialog and confirmation recipes; Community exports its avatar picker, reactions, and skeleton compositions and an optional composer form mode. The public catalog uses compiled examples with source imports during Storybook acceptance, while packaged consumer validation checks the actual dependency artifact. These changes do not grant agent-management capabilities or alter relay protocols.

For LC-ARCH-023, `CommunityApplication` consumes relay authentication only
through its optional public adapter and application authentication context.
The adapter's restored identity enters the existing controller connector;
account metadata stays presentation-only. Hosts that omit the adapter retain
the existing NIP-07, NIP-46, local identity, and public browsing behavior.
Account actions call their adapter methods with the original receiver intact.
A metadata-only account refresh preserves an already connected external signer
only while its active custody, account ID and verified public key still match.
Stale account responses cannot restore an identity after sign-out. Reloading an
external account restores its cookie and linked provider details, but requires
the same Nostr key to reconnect; GitHub access does not restore key custody.
The client rejects a mismatched reconnect key before sending a login challenge.
When a host supplies both relay auth and direct identity connection, provider
methods use relay auth, while host-owned key creation and import methods use the direct connector
before any relay fetch.
The dedicated Vite development host MAY persist a successfully pasted
private-key secret in `localStorage` so refresh restores that development
identity. That persistence MUST stay inside `dev/community`, MUST NOT ship in
the published package, MUST NOT log the secret, MUST restore the identity on
load, and MUST show a dismissible development toast that can forget the stored
key. Production Community login MUST keep imported secrets in memory only.

The deterministic application-authentication lane composes the current sibling
relay with local fake Google and GitHub providers. It exercises the same public
client, restored signer, controller connector, and account model as the browser
without adding a test branch to the production adapter. Its exact localhost
Community origin and Chromium virtual authenticator exercise the production
WebAuthn client conversion and relay RP-ID enforcement.

For LC-ARCH-025 and LC-OPS-005, the unified development host uses the pinned
Keytr adapter with `local-community.lapis.md` as its default RP ID and the
shared public relay as storage. It disables Vite's embedded Keytr relay.
Existing passkeys bound to `community.localhost` require new enrollment or
explicit import; domains are never silently rewritten. External gateways
still require related-origin authorization.

Vite binds port 7036 strictly, permits only its configured public host, emits
assets at that HTTPS origin, and connects HMR with WSS on port 443. Browser
relay requests remain direct so credentialed CORS is exercised. Existing
worker/WASM transforms and isolation headers remain enabled. The supervisor
watches the separate allowlisted public environment and restarts only its
checkout-owned child. The credentials directory is never a file-serving root.

The agent controller retains live state per agent and conversation. A private Svelte context supplies the optional shared composer activity row with the existing controller model, without introducing an application singleton or plaintext persistence. Conversation-scoped failures remain in that controller projection until newer activity replaces them, and runtime or memory administration errors are correlated in the same private ephemeral transport as successful responses.

Browser cache writes retain atomic statement batches. The pinned Turso browser
driver must distinguish execution yields from pending OPFS I/O, so a yielded
write cannot block the connection indefinitely. The published 0.8.0-pre.11
driver includes the upstream yield fix; 0.7.2 does not. Cold browser acceptance
covers bulk replay, concurrent encrypted archive capture, pagination, and
reopening existing data without a cache or archive reset.

Channel canvas state and load/save actions belong to the existing Community
controller and source, keyed by community and room. Settings and canvas
components consume normalized models. Loaded private canvas state is cleared
on identity changes and access revocation; reconnect refreshes an open canvas
without replacing the surrounding application shell.

## Transport-aware conversations and Inbox

NIP-27 content-mention decoding lives in `content-mentions.ts` so Inbox
projection and `CommunityMarkdownContent` share the same `nostr:npub` and
`nostr:nprofile` identity. Preview rewrites those tokens to `@Name` before
Mira safe sanitize so they cannot collapse to leftover `nostr` text. Composer
token decorations include the same `nostr:npub` form so live authoring chips
pasted mentions. The shared conversation reference distinguishes encrypted NIP-17 participant
sets, Buzz private relay channels, and NIP-29 channel/thread contexts. Read
cursors, Inbox projection and activity selection use that reference. The
controller owns selection, filters, pending sends and pagination; leaf views
render state and callbacks. Prepared encrypted events belong to the data source
and survive reconnect for the same pending command. Decoded content is cleared
when identity changes. Existing public room identifiers remain compatible.

Buzz DM compatibility is a client transport for supporting Buzz relays. It does
not add the Buzz DM command backend to Lapis Relay.

The public Agent editor retains separate signed definition and instance records. Shared legacy definitions are copied on edit and only the chosen instance is relinked. Processing state belongs to the controller and is projected from request-correlated encrypted acknowledgements independently of presence and operator configuration.

The production Community controller forwards agent processing queries and
revision-checked state changes to its agent controller. It returns the correlated
acknowledgement unchanged so gallery and profile actions can share the same
authoritative state. Relay publication alone does not complete a Start or Stop
action; presentation changes are covered by LC-UI-048.

Saved agent setups are an Add agent recovery destination, not additional gallery
identities. The controller projects them from saved definitions and all current
owner-signed instance references, independently of profile discovery. Both that
projection and edits use the same deletion-aware instance materialization; an old
deleted instance cannot force a copy of the active agent's configuration.

Room read receipts remain controller-owned. Presentation reports the latest
incoming event represented by its rendered room or topic boundary. The controller
validates that event against the conversation, advances its deterministic cursor
monotonically, and projects the same state into room counts and Inbox. An absent
receipt boundary on explicit Mark read retains the existing all-loaded-content
behavior. Read cursors MUST NOT advance merely because a room is selected.

## Responsive resource transitions

For LC-ARCH-008 and LC-ARCH-012, asynchronous presentation reads MUST be keyed by
identity, relay, resource and relevant revision. Only the current request may
publish results, errors or cleanup. Simultaneous projection requests MUST
coalesce with at most one projection in flight and one trailing pass; duplicate
event batches MUST NOT request a projection. Unchanged JSON model branches,
including keyed messages after insertion, MUST retain their references.
Overlapping canvas reads MUST share one request, and a save MUST invalidate a
previous read before refreshing the accepted head. Persisting navigation alone
MUST NOT request another projection. Empty resolved resources remain resolved
until explicit refresh or relevant invalidation.

The [transition inventory](transition-inventory.md) records the implementation
and regression boundary for every application destination. Pending entries are
not acceptance evidence. Initial loading uses a representative skeleton;
refresh preserves existing content. Subscriptions belong to the session, not a
page request, and must survive page cancellation.

## Cached history and compatible presentation

LC-ARCH-008 separates metadata bootstrap, live delivery and bounded history.
Content subscriptions use `limit: 0`; selecting a conversation reads a cached
50-message window before reconciling the head, and a covered connected revisit
makes no historical request. A synchronization watermark, older-page cursor and
read cursor represent different facts and MUST remain separate. Empty pages are
resolved results, not permission to repeat a loader.

Indexed event-store reads and persisted history-page records are additive,
optional contracts. Existing unpaged sources and custom stores keep their
snapshot fallback. Memory, IndexedDB and Turso commit verified page events and
coverage together; persistence failure or eviction cannot establish coverage.
Metadata restoration and cached search MUST avoid replaying the entire archive
into the active graph. Private envelopes persist under the identity audience;
decoded private data and draft state remain scoped to the current identity.

Each public logical history load admits at most three 100-event candidate
batches per relay, yielding between batches. Thread filters address NIP-29
replies and NIP-22 root references. Saturated equal-timestamp responses preserve
explicit coverage gaps rather than pretending that timestamp pagination proves
completeness. The scheduler allows two loads overall and one per conversation;
a newer navigation intent prevents an older response from moving the viewport.
Inbox candidate and context queries MUST be constrained to the scope's known
channels, so newer events in another community cannot displace that scope's
first page or leak into its history.

Community opts into Design Core history mode without production
virtualization; existing Design Core consumers retain their streaming,
snippet, and optional virtualize defaults. Lists start with 50 rows, with
guarded earlier-history controls at the relevant edge.
Controller-owned selection, reading positions and drafts survive list filters
and refreshes. A selected Inbox conversation remains available independently of
its currently visible summary row.

Root-list read boundaries acknowledge root messages only; opening a thread
acknowledges its displayed replies. Explicit room-wide mark-read actions retain
their existing behavior. New-message notifications use canonical eligible
unread event IDs, never resizing or pagination geometry, and counts with
incomplete coverage remain lower bounds. The transition inventory tracks the
remaining cross-application and scale acceptance work.

Member-search results, transient operation state and saved timeline positions remain independently reactive, so they do not invalidate the composed conversation state. Sign-out invalidates pending signer lookups before anonymous synchronization; stale successes, failures and subscriptions cannot restore the previous identity. Cache schema upgrades retain existing message and agent records and populate missing room indexes additively.

For LC-ARCH-011, the 64 MiB event-and-page cache budget MUST use byte accounting
updated with its writes. Metadata-only restoration MUST report the entire
requested audience partition without reading its message payloads. An
under-budget commit MUST NOT scan all cached events to compute storage usage.
Eviction MUST use access indexes, atomically remove coverage that references
an evicted event, preserve unrelated cached pages, and bound empty-page storage.
Memory access indexes MUST remain bounded when existing events are touched.
IndexedDB and Turso migrations MUST retain event and agent records and initialize
accounting from the existing cache. Failed transactions MUST NOT advance byte
usage or coverage. Concurrent persistent-store opens MUST share initialization;
closing or failed initialization MUST release the candidate database and its
owner lock. Turso eviction MUST yield between bounded batches in its supported
owner context.

For LC-ARCH-011, private-event classification MUST be incremental and follow verified channel identities and event references, including children received before their parent. Ordinary private arrivals and duplicate replay MUST NOT restore or clear the entire public cache. Public reference-existence indexes MUST include both cached event IDs and their e/E parents and remain scoped to the relay/scope and audience.

A newly private channel or a cached reference to a newly private event MUST remove cached plaintext descendants, including rows outside the active window. Cache migration scans and removal batches MUST yield after bounded work. Targeted deletion MUST preserve unrelated history coverage and encrypted inbox partitions while atomically updating dependent page coverage and byte accounting. The browser-selected store MUST forward these optional operations; existing custom stores retain a conservative clear-and-rebuild fallback.

A failed privacy purge MUST prevent cached reads and search from exposing the affected scope until retry succeeds. Identity changes MUST clear decoded private state without discarding the failure guard. Additive database migrations MUST populate reference indexes without removing existing message or agent history.

Browser cache wrappers MUST share repeated opens, await pending initialization before close, and retain the last shared Turso owner until shutdown finishes. A failed close MUST remain retryable without allowing a competing opener to bypass ownership. Reopening a healthy persistent store MUST clear obsolete degraded-state messages.

Configured private-room access MUST seed runtime privacy before restoration, ingestion, or a direct indexed page read, even when no room metadata is cached. An empty batch carrying changed access MUST still invalidate old public plaintext and reference descendants. Repeated reads with unchanged access MUST NOT repeat full-cache invalidation.

Legacy cached events without page records MUST restore a bounded 50-message window using at most three indexed batches of 100 candidates. Cached exhaustion MUST NOT establish relay coverage, an exact unread count, or a newer-only reconciliation point. A selected offline channel or thread MUST load earlier cached windows and retain content on uncached-history failure; cached-only reads MUST NOT create coverage. Legacy unpaged sources retain their existing full-snapshot contract.

Metadata restoration MUST retain cached deletion controls (kinds 5 and 9005), so hydrating an older legacy message cannot revive a deleted entry. These controls remain excluded from chat messages and unread-arrival notifications.

Queued history reads MUST evaluate current conversation visibility when a slot becomes available, preserving the two-load cap and one active load per conversation. A room that became hidden MUST NOT retain priority over the selected room or thread. Repeated requests continue to share a promise, and existing boolean-priority callers remain supported.

Queued mailbox and Inbox reads MUST verify their captured controller generation before changing loading state or accessing the session. A refresh MUST retain its originating generation and session through snapshot, persistence, and projection; results from a replaced or signed-out session MUST NOT enter the current event graph or restore private presentation state.

Project work-item resources are owned by one authenticated project session, not
by the selected page. Navigation releases view listeners while retaining resolved
results and live observations for visited repository revisions. Repository removal
or replacement evicts that resource; identity, relay, reconnect and explicit
session refresh dispose all session resources. A changed repository notifies only
views observing that repository. Event reads still use the existing source contract.

Release inspections and review entries are memoized inside the NIP-29 registry
source by its verified event union. Source authorities are copied at construction;
source replacement/disposal separates authority contexts. Duplicate events and
unchanged relay refreshes preserve the memoized revision. Pending callers share
source-owned work, while individual cancellation stops only their own wait.

The public `./build/vite` package entry exports the existing Turso bundle
transform for consuming Vite and Storybook hosts. It contains no Community
runtime imports and applies to both client and worker graphs. Consumers reuse
this integration through the installed package rather than copying the helper.

The public Turso Vite helper declares only its actual name, pre-transform order
and transform function. Its emitted types must not import the complete Vite
Plugin interface or couple consumers to the helper build peer graph.

For LC-UI-049, repository context uses the shared Column Canvas collapse state.
Activity progress reduction and scoped runtime controls have separate owners;
profile action geometry is composed by both agent profile and activity views.

For LC-UI-050, project canvas starter text is derived from the resolved project,
channel and repository graph at the application boundary. The channel canvas
receives only the resulting draft string and never publishes it before an
explicit save. Repository Activity owns its transcript disclosure state, while
collapsed transcripts mount only when opened. The shared transcript renderer
remains expanded for Log and commit consumers. Activity yields its initial
content render until after a browser paint, displaying the shared timeline
skeleton immediately and retaining loaded rows during background refresh.
Project navigation normalizes a selected project destination to its explicit
Activity route. Every selected-project route, including Activity, carries a
`project-*` main surface, with the selected tab and rendered workspace derived
from the same route. Reconstructed agent
context deduplicates commit IDs both within each checkpoint and across the turn
before rendering keyed checkpoint links, so repeated relay references cannot
abort the Activity surface. Known agents carry `kind: "agent"` on
`CommunityMemberModel`. `CommunityMemberAvatar` derives the rounded-square
shape from that kind wherever the identity is known, including Projects,
Inbox, direct messages, Activity, reviews, and comments. Git-author Gravatar avatars remain rounded
as a project author exception. `pnpm check:ui` rejects consumer CSS that
restyles member-avatar radius.

For LC-UI-040, Inbox owns the conversation-pane inset around the shared message
skeleton. Initial and selected-thread loading reuse one padded snippet, keeping
the shared skeleton independent of its containing surface.

For LC-UI-014, Inbox thread-region CSS stretches only the Body.Content
scrollport and uses the same non-scrolling flex fill as channel workspace
content, including `width: 100%` so the conversation is not content-sized.
The pane viewport overrides Design Core's inline
`overflow: hidden scroll` so computed overflow stays hidden. Nested
conversation and composer scrollports keep content height so the
message list can wheel without a second pane scroller.
Inbox keeps channel overflow anchoring. Production conversations render
the current history window in normal flow. The Conversation
scrollport story records that selector scope and updates the Inbox
stories path budget.

For LC-UI-049, checkpoint projection retains repository, channel, and native
change targets. Agent context reference menus own presentation and share an
application-provided conversation navigation adapter with Agent Activity.
Their repository Log links MUST use the canonical repository route and select
the shared revision-log pane; each repository contributes only one Log shortcut.
Repository Log navigation MUST be adapted at the application boundary to the
shared pane context. Selection, history restoration, and cancellable file reads
belong to a dedicated Log selection controller, not the application composition
root. Route commit identifiers participate in parsing, persistence, and history
identity for both the Commits and Log surfaces.

Checkpoint file reads MUST bind to the destination repository selected by the
route even before its browsing state has been prepared. Navigation from the
Projects, project, and repository Activity feeds MUST share this read path and
MUST NOT reuse a previous repository's coordinate.

Public agent conversations join verified source message events with checkpoint records. Commit feedback reuses repository note events and exact diff anchors; projections share event identity across thread, commit and activity views. No owner telemetry enters public projections.

Request-link navigation resolves unloaded messages through the shared agent conversation provider. The exact-event read and thread-root traversal have separate owners; application composition does not grow.

LC-UI-049 canonical transport validation lives in protocol, with consumer projection in community and native-page assembly in projects. Transcript types, discussion-message props and thread-panel props are extracted from large component modules; changed leaf budgets remain below 300 counted lines. The architecture baseline records the smaller message and thread-panel owners plus the bounded composer-status and story growth in the same change.
