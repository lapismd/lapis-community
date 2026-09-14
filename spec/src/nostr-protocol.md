# Nostr Protocol and Trust

## Relay Presence Extension

Relays advertising `lapis_presence.version = 1` support authenticated kind-20001
connection heartbeats every 60 seconds and a 180-second server-time lease.
An explicit `presence-mode` tag changes the account preference (`auto`, `away`,
or `offline`); ordinary heartbeats never change preferences. Clients include a
monotonic millisecond `presence-sequence` to order same-second updates.

The client subscribes to relay-authored kind-20001 events with requested `p`
subjects before making signed NIP-98 `/query` requests for kind 40902 and those
authors. Each requested subject receives a verified relay-signed result with
`presence-mode`, `presence-revision`, and `expiration` tags. Only the advertised
relay signing key may assert a different subject. Newer revisions win; expiry,
missing results, invalid signatures, and transport failures cannot imply Offline.
Unsupported relays disable presence choices. NIP-38 text status is independent.

Clients serialize explicit preference publication after in-flight background
presence work, then fetch the relay-signed confirmation before resolving the
action. Only one manual preference operation may be pending. Closing the
session prevents a queued preference from publishing after the background
work settles.

The verified owned-agent directory and Buzz-compatible bridge are specified
in [Agents and saved activity](agents.md). Ordinary profile metadata and bot
roles do not establish the owner relationship.
Registering an existing agent MUST publish an owner-signed kind `30177`
replaceable discovery event whose `d` tag is the normalized agent public key.
Relay acceptance records the owner's discovery intent; the directory MUST keep
the agent hidden until a valid agent-signed kind `0` profile independently
attests to that owner.
Persona management MUST keep the owner-signed `30175` definition, owner-signed
`30177` instance, and agent-signed kind `0` profile as separate authorities.
Creating or editing an unlinked reusable persona MUST publish only kind `30175`;
it MUST NOT manufacture an instance link or mutate a public profile.
Relay directory reads MUST begin independently of optional local activity
archive restoration.
The instance links the persona's exact `d` value and records name inheritance
explicitly; matching strings never imply inheritance. Persona prompts remain
plaintext saved configuration and do not become active runtime state.
Buzz's numeric NIP-11 list does not advertise `OA`, `AO`, or client-side
NIP-44. A valid relay `self` key and NIP-29 permit authenticated directory
probes, with NIP-16 or `AO` enabling ephemeral observer subscriptions. The
query results must still satisfy signature and owner-attestation verification.

For LC-NOSTR-025, controller telemetry and controls use kind `24200`. A control
is a fresh owner-authored event with exact `p`, `agent`, and `frame=control`
tags, an optional group tag, and NIP-44 ciphertext addressed to the verified
agent. Community preserves controller-issued scope keys unchanged for cancel
and reset, and sends a permission response only for an unexpired request and an
outcome present in that request's decrypted offered set. Late telemetry
sequences cannot reactivate a completed live scope.

Runtime and memory administration extend this same envelope at control version
`2`. `runtime_get` and `runtime_set` omit `h`; runtime changes contain at least
one controller-catalog value. `memory_list` and `memory_action` carry the exact
configured channel in both content and `h`, and a memory action identifies
either one candidate for approve or reject, or one accepted memory for
retraction. Fresh `runtime_state` and `memory_state` telemetry is correlated by
request ID, updates owner-only profile state, and is excluded from the durable
activity archive and catch-up cursor. A fresh `administration_error` response
MUST reject the matching pending request with its bounded message and MUST NOT
enter activity history.

Protocol-backed presentation follows the package's portable, published Design
Core semver boundary; dependency refreshes do not alter event interpretation or
trust decisions.

For LC-NOSTR-007, public channel and forum message projections MAY retain their
verified source event so an explicit copy action can export the complete signed
envelope. Decrypted private-message rumors MUST NOT use that public-event path.

For LC-NOSTR-010, accepted kinds `9007`, `9000`, `9001`, `9021`, and `9022`
from the authoritative relay MUST remain available through bounded channel
history and live subscriptions. Channel presentation MUST project them as
standalone creation, addition, removal, join, or leave activity without message
mutation controls; referenced members MUST use the shared interactive member
reference, and the connected identity MUST be labelled `You`.

For LC-UI-033, the plugin-release review ledger MUST enumerate each distinct
signed release event in the canonical plugin-release group, retain its verified
inspection and configured-curator decisions, and remain deterministic across
reordered or duplicated relay replay. Release and curator activity counts are
derived presentation data and MUST NOT introduce a second protocol or source of
truth.

## Requirements

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-NOSTR-033 | Agent edits MUST preserve signed persona, instance and ownership records internally, copy shared definitions before relinking only the selected agent, and preserve unknown configuration fields. Owner-signed instance DM allowlists MUST default to owner-only. Kind-24200 processing controls MUST correlate request IDs and revisions and trust only verified controller acknowledgements, never relay acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| LC-NOSTR-032 | Conversation identity MUST include transport and immutable participants or relay/channel scope. NIP-17 creation MUST default to encrypted transport, limit recipients to eight, include sender recovery, preserve NIP-27 mention identity, reuse prepared deliveries across retries and reconnect, and page history with bounded decryption. Buzz private DM discovery MUST verify metadata and membership, preserve its original kind-9 transport, and apply relay-signed kind-30622 visibility; explicit kind-41010 open/reopen and kind-41012 hide MUST be capability-gated. Inbox MUST group incoming DMs, mentions and participated threads with shared read cursors, ignore own/control events, and retain controller selection. Private activity MUST be partitioned by the full conversation identity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LC-NOSTR-001 | Registry releases, curator decisions, forum topics, replies, and reactions MUST use the standard Nostr event kinds and tag relationships defined by the package protocol implementation. Community presentation MUST retain signed registry publisher-authorization and registry-head control events for verification and caching while excluding them from timelines, inboxes, last-activity summaries, and search results. Community search presentation MUST project kind `0` results as profiles, kinds `9`, `11`, and `1111` as messages, map each message's NIP-29 `h` tag to its configured application room when available, and MUST NOT present other event payloads as message content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LC-NOSTR-002 | Relay access that requires authentication MUST use NIP-42, and browser publishing MUST remain behind a user-controlled `CommunityIdentity` signer. NIP-07 MUST remain the default browser connector, while host-supplied NIP-46, generated-account, or imported-key flows MUST resolve the same signer boundary without exposing secret material to presentation components. Replacing an anonymous reader or previous signer on a live transport MUST authenticate a separate author-bound connection without interrupting existing read subscriptions, and rejected protected mutations MUST retain the relay's original reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LC-NOSTR-003 | The materializer MUST verify event signatures, preserve a successful boundary-verification result for deterministic downstream projections without mutating immutable caller-owned events, and MUST treat release and approval events as authoritative only when their authors match configured trusted publisher and curator keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LC-NOSTR-004 | NIP-29 group membership and relay acceptance MUST be treated as transport and moderation controls, not as proof that a registry event is authoritative. Relay-owned Blossom storage MAY supply a manifest or resource only by its signed SHA-256 and size; successful relay retrieval MUST NOT bypass publisher, curator, schema, or integrity validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| LC-NOSTR-005 | Registry projections MUST be deterministic for the same trusted authorities, manifest bytes, event set, and generation timestamp.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LC-NOSTR-006 | Community relay implementations MUST verify published events and provide deterministic filters, NIP-45 multi-filter counts, live subscriptions, cancellation, replaceable-event handling, author-bound NIP-42 authentication, and NIP-29 state transitions through the public relay contract. Count results MUST preserve exact or approximate state and optional HLL metadata, deduplicate overlapping OR filters, ignore filter limits, and retain the numeric single-filter compatibility API. Memory, Storybook, and Docker conformance lanes MUST seed the same signed scenario builder, including its multi-author forum reply history.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LC-NOSTR-007 | The NIP-29 community source and its registry adapter MUST treat relay URL plus group ID as room identity, read authoritative state only from the owning relay, allow configured mirrors to supplement content reads, and publish commands only to the authority. When public-room discovery is enabled, the source MUST discover non-hidden kind `39000` groups from the authority, classify channels and forums from `supported_kinds` with Buzz `channel_type=stream` or `channel_type=forum` as a compatibility fallback, subscribe to their subsequent state and content, and merge them with explicitly configured rooms without duplicates. A locally persisted relay-URL change MUST rebuild the source session before it can become the new authority. Latest valid kind `0` metadata MUST project into normalized member and personal-settings models without mutating the supplied signed events during verification. Profile edits, including picture metadata, MUST merge and publish kind `0`, then reconcile the accepted event into both normalized settings and member models; custom emoji edits MUST replace only the connected author's parameterized NIP-30 kind `30030` set, while the read model deterministically merges community sets. Group reactions MUST carry their NIP-29 `h` context so public readers can retrieve them. An undirected message submitted from an open forum topic MUST be a NIP-22 kind `1111` comment whose root and parent tags both target that topic's kind `11` event, rather than a group stream message. Channel and forum projections MUST keep replies out of root timelines while retaining them in threads, aggregate root reply and reaction summaries, retain up to three newest unique reply participants in activity order, and expose the latest reply timestamp; the registry adapter MUST preserve bounded count-backed discussion reads through the same relay factory and use standard base64 for Nostr HTTP authorization. |
| LC-NOSTR-008 | Direct messages MUST use NIP-17 sender and recipient gift wraps backed by NIP-44, validate the wrap, seal, and rumor chain before materialization, and remain unavailable when the connected identity lacks encryption support. Community MUST persist only the encrypted kind `1059` wrap and keep decrypted rumors memory-only. It MUST decrypt and materialize valid inbox deliveries from both synchronization results and the live subscription without requiring an explicit refresh. Live/query duplicates MUST merge by stable rumor ID.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| LC-NOSTR-009 | Cross-device read markers and preferences MUST use encrypted-to-self kind `30078` events with per-device addressable slots, deterministic monotonic/LWW merging, local-first loading, bounded payloads, and no plaintext logging. Registry discussion read cursors, forced-unread state, follow state, bookmarks, and composer height are an explicit versioned browser-local exception scoped by normalized relay set, plugin support group, viewer, and root topic. These personal Registry preferences MUST NOT publish NIP-29 group pin events or rewrite NIP-51 bookmark lists; same-forum suggestions MUST use bounded root, latest-reply, and count queries and fail independently of the active discussion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LC-NOSTR-010 | Community management MUST resolve application room IDs to canonical NIP-29 group IDs and encode create, metadata update, owner delete, moderator delete, group delete, join, leave, add-member, and remove-member commands as kinds `9007`, `9002`, `5`, `9005`, `9008`, `9021`, `9022`, `9000`, and `9001` respectively, leaving relay acknowledgements authoritative. A positive join acknowledgement means `Join requested`; queued participation MUST remain pending until kind `39002` state confirms membership, then publish the original action once. Accepted-but-not-projected state MUST retain the action without blind republishing. Negative NIP-01 acknowledgements MUST preserve standard failure prefixes and relay reasons; an exact duplicate acknowledgement MUST reconcile as idempotent success. Reaction toggles MUST publish kind `7` once and delete the connected author's reaction on the second toggle; custom reactions MUST carry NIP-30 emoji tags. Permission projection MUST distinguish authored content from reactions: closed or restricted groups require confirmed membership for both, while a public write-restricted group denies non-writer posts but permits reactions. Public message links MUST encode NIP-19 event, author, and relay hints or use an injected host link builder. Direct messages, replies, reactions, and deletions MUST remain encrypted NIP-17 rumors, route recipient and sender wraps to each participant's latest advertised kind `10050` inbox relays, reject recipients without an advertised inbox, and never expose decrypted content to logs or public links.                                                                                                                                                                                                                                                                                                                                                          |
| LC-NOSTR-011 | A local event cache MUST remain a verified, replayable optimization over relay events. Cache partitions MUST preserve relay provenance and scope, reject invalid envelopes, deduplicate by event ID, and retain synchronization checkpoints only after successful relay EOSE completion. Public NIP-29 events MAY be persisted; private NIP-29 plaintext and decrypted NIP-17 rumors MUST remain memory-only. Kind `1059` gift wraps MAY be persisted only as received ciphertext within the connected identity's partition.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LC-NOSTR-012 | A cache-aware NIP-29 session MUST open live subscriptions before synchronization and fully reload authoritative metadata, administrators, and members. The optional bootstrap strategy MUST omit unbounded public-history queries while preserving complete-snapshot behavior when omitted or when paging is unsupported. Bounded content windows MUST use an exclusive `(created_at, id)` cursor, clamp limits to 1–100, deduplicate overlaps, and verify same-second boundaries before advancing a room-specific oldest checkpoint. The controller MUST persist a checkpoint only after relay EOSE, signature verification, runtime ingestion, and cache commit succeed; aborted or failed pages MUST retain the last checkpoint and resume from it on Refresh or Reconnect. Live/query races MUST remain event-ID deduplicated, and a projection MUST become current only when synchronization is complete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LC-NOSTR-013 | The NIP-29 community source MUST query and subscribe to NIP-38 kind 30315 events for known authors alongside profile metadata. The materializer MUST project only the latest valid general status per author, include its trimmed content in normalized member models, and treat a newer empty general status as a clear operation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LC-NOSTR-014 | Publisher authority MUST derive from the latest exact-shape curator-signed authorization for a plugin and publisher, with configured publisher keys retained only as an explicit legacy fallback. Curator decisions MUST use the canonical release group, target exactly one release event, and contain only the supported decision value. Sequenced release manifests MUST use `lapis.registry.nip29-release/2`, a canonical positive-decimal sequence, and the exact predecessor event, with contiguous sequences and unique plugin/version pairs. Legacy v1 releases MAY be retained beneath a curator-signed sequence-zero bootstrap head. Publisher-signed `withdrawn` decisions MUST target that publisher's own release and MUST remain immutable audit evidence rather than deletion requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| LC-NOSTR-015 | One public verifier MUST validate online and portable offline Nostr release proofs. It MUST verify event envelopes and signatures, pinned curator authority, publisher authorization, manifest bytes, plugin identity, artifact hash and size, and the exact curator decision. Current proofs MUST additionally verify the curator-signed head, authority epoch, release inclusion and state, manifest hash, active release, predecessor chain, and signed freshness window of at most 30 days. It MAY accept exact artifact bytes during installation or a previously verified artifact digest during later freshness checks. Offline verification MUST report that current revocation freshness still requires relay synchronization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| LC-NOSTR-016 | A live Nostr registry source MUST assemble portable release proofs only from a current install-ready relay quorum. The proof MUST include the accepted release event, its exact curator-signed publisher authorization and approval decision, the verified manifest bytes, and, for head-aware releases, the exact current head observed on that quorum. Releases admitted only through a legacy static publisher allowlist MUST NOT produce portable proofs. Historical accepted releases MUST retain their complete immutable proof while revoked, rejected, withdrawn, unknown, and unaccepted versions fail closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| LC-NOSTR-017 | Local signer accounts MUST use independently generated Nostr secret keys. NIP-46 connections MUST retain the bunker invitation and generated client key only in the host credential store, reconnect with the same client identity after session closure, reject a changed remote public key, and provide NIP-44 only through the opaque broker operation. Neither credential form may cross the plugin-facing account boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| LC-NOSTR-018 | Public channel, forum, and Registry review edits MUST publish a group-scoped kind `40003` event referencing the original event. Projection MUST apply only the latest deterministic non-empty edit signed by the original author in the same group, retain the original event identity and timestamp, and ignore cross-author or cross-group edits. Author deletion MUST publish a same-author group-scoped kind `5` event and hide the referenced message. Message reports MUST be encrypted NIP-17 group messages sent to every curator in the latest verified kind `39002` role snapshots, must not change the active room or Registry review route, and MUST fail visibly when no curator or advertised kind `10050` inbox relay is available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

| LC-NOSTR-019 | Pulse MUST load verified public kind `1` notes from configured Community read relays without adding a database or submission API. Everyone, Mine, NIP-02 Following, undeleted `+` kind-7 Liked, and optionally supplied agent-author feeds MUST deduplicate and order deterministically, exclude NIP-34 `30617:` project comments, resolve reply parents and kind-0 profiles, and ignore forged or author-invalid kind-5 deletions. Pulse publication MUST remain behind the injected signer, use kind `1` with marked reply and mention/media tags, use kind `7` content `+` for likes, and use same-author kind `5` deletion of the reaction for unlike. The recent Pulse window MUST remain memory-only and refresh only while active. |
| LC-NOSTR-020 | Community member management MUST preserve every normalized role from the latest verified kind `39001` and `39002` state, distinguish relay administrators from assignable member roles, and accept kind `39003` role definitions only when signed by the current kind `39000` relay authority. Role replacement MUST publish kind `9000` with the complete role list, including an empty list to clear roles. Writer-only room updates MUST encode `write-restricted` in kind `9007`/`9002` content and tags while preserving unedited authoritative metadata. Private-room invite creation MUST use a cryptographically random kind `9009` code and a canonical NIP-29 `nostr:naddr` URI; invite joining MUST reject malformed, signer-mismatched, or unconfigured-relay addresses, load the referenced group from its configured authority, and publish kind `9021` with the invite `code`, leaving membership relay-authoritative until kind `39002` confirmation. |
| LC-NOSTR-021 | The public project-forge source MUST retain ordinary signed Nostr events as authority and interoperate with Buzz Desktop project, repository, task, pull-request, update, status, kind-1 collaboration, NIP-22 comment, NIP-25 reaction, and NIP-09 deletion encodings. Project and repository enumeration MUST drain deterministic 500-event pages with the relay `before_id` boundary, deletion discovery MUST chunk address or event filters by 100, and each repository work-item load MUST issue Buzz's four `#a` filters plus one repository-scoped kind `7` filter at a 2,000-event limit before independently loading NIP-22 comments. Project creation MUST publish only kind `30621`; repeatable bounded `buzz-related-channel` tags MUST project alongside the home and repository channels without duplicates, and every bound channel including the home channel MUST remain available to the expandable navigation tree. Editable project settings MUST publish an owner-signed kind `30621` replacement at the existing coordinate while preserving non-editable and extension tags. Clone-less hosted repositories and explicit external repositories MUST be added separately, while a marked clone-less project task anchor MUST be created lazily and avoid real-repository coordinate collisions. Task and pull-request projections MUST preserve raw events while applying the relay's signer trust, current-tip, lifecycle, review, comment, inline-anchor, reaction-target, deletion, and event-ID tie rules. A projected comment reaction MUST match the comment's `e`, author `p`, kind `k`, and repository `a` tags, aggregate by emoji, and derive the connected author's selected state without trusting provider metadata as Nostr authorship. Browser Git reads MUST use exact-URL and method kind `27235` NIP-98 authorization against the relay's allowlisted repository and pull-request diff APIs, parse both JSON and terminal SSE results, and MUST NOT access the WalGit sidecar directly. Generic `POST /events` and `POST /query` compatibility MUST use body-bound one-shot NIP-98 credentials. |
| LC-NOSTR-024 | Browser custody transfer MUST preserve the account's canonical Nostr pubkey. After decrypting a relay envelope, Community MUST derive and compare the transferred secret's pubkey before displaying it. Completion MUST use the imported remote signer, rather than the paused managed signer, to sign kind `22242` with the exact relay URL, relay-issued challenge, and `purpose=custody-transfer`; Community MUST validate that proof before submission. Once the key has been disclosed, interruption MUST leave the account migration-pending until completion or a fresh passkey-authorized restart. |
| LC-NOSTR-026 | Keytr discovery and setup MUST use signed kind `31777` key records from explicitly configured relays. Before decryption, Community MUST verify the event ID and signature, kind, expected author when reconnecting, selected RP ID, unique required `d`, `rp`, `algo`, `kdf`, and `v` tags, supported PRF version, and bounded ciphertext. Credential identifiers MUST accept equivalent padded and unpadded base64url encodings while rejecting malformed input. Private-key protection MUST accept valid `nsec` and 64-character hexadecimal secrets, reject malformed secrets before WebAuthn, and distinguish key validation from sanitized authenticator failures. New and imported identities MUST locally sign their encrypted key record and require acceptance by at least one configured relay before relay-account login. Total publication failure MUST dispose the key and request best-effort authenticator cleanup through the injected adapter. Local Keytr signing MUST satisfy the existing Community event and NIP-44 contracts. |

For LC-NOSTR-007, browser relay configuration MUST store only an explicit
override. Resetting to the host-provided default MUST remove that record before
the active session reconnects, so a later host or environment default change is
not shadowed by an indistinguishable copied value.

For LC-NOSTR-021, the source MUST resolve the relay's provider-neutral
capability document for each signed `30617` coordinate before treating an
external repository as browsable. Full ref names such as `refs/heads/main`
MUST be signed and requested as canonical slash-preserving gateway paths so
NIP-98 verification covers the exact URL received by the relay.
Successful JSON GET responses MAY be retained briefly in a bounded in-memory
cache scoped by relay URL and signer public key. Progress-stream responses MUST
not be cached, and a successful forge mutation MUST invalidate that cache.
Provider merge commands MUST bind the full expected pull-request head in their
NIP-98-authenticated JSON payload and poll the relay operation outside the read
cache until it explicitly completes or fails.
Submitted pull-request reviews MUST remain signed kind `1` collaboration
events rooted at the pull request and repository, bind the reviewed commit with
`c`, and use exactly one `t` value: `review-comment`, `approval`, or
`changes-requested`. Line comments MUST retain the existing
`inline-comment`, `file`, `side`, and `line` tags so the relay can map
them to provider-native review comments without changing Nostr authorship.
Trusted `1630` through `1633` events MUST remain individually available to the
client projection for review history while only the deterministic latest event
sets effective lifecycle. Kind `1` events carrying `t=review-request` MUST
remain visible as review activity; only a trusted root actor may extend the
Nostr reviewer set, and an external reviewer tag is presentation provenance
rather than a Nostr authorization grant.
The project activity reducer MUST distinguish review requests, approvals, and
change requests from ordinary collaboration comments. Approval and change
request outcomes MAY supply derived presentation detail and review-aware weekly
totals, but those labels MUST NOT replace or alter the underlying signed event.
GitHub connection creation, complete replacement, and revalidation MUST sign
the exact relay forge endpoint and HTTP method with NIP-98. Requests containing
connection configuration MUST bind the complete JSON payload, while a
body-less revalidation MUST omit the payload tag. Connection responses MUST be
treated as public status records and MUST NOT contain mounted credential
references or secret values.
When a project owner removes a direct channel attachment, the kind `30621`
replacement MUST replace the complete bounded `buzz-related-channel` set while
preserving every other non-editable tag. Omitting that set from an ordinary
settings update MUST preserve the existing related-channel tags.
Project listing MUST use Buzz's `buzz-visibility` semantics: only `unlisted`
is emitted, absent or unknown values materialize as `listed`, and returning a
project to Listed MUST remove a prior `buzz-visibility` tag. Public/private
access MUST remain derived from the authoritative NIP-29 home channel rather
than being encoded in the project announcement.

Task assignee edits under LC-NOSTR-021 MUST compare the projected assignee set
with the command selection and publish explicit assignment and removal events
for only the changed public keys. An empty selection is a valid request to
remove all projected assignees; UI selection state never replaces signed relay
events as authority. Project activity MUST preserve each accepted event's
`assign` or `unassign` direction so presentation can distinguish the two
operations without parsing a generated label.

For LC-UI-030, production-component stories project signed kind `0`, `1`, `3`,
`5`, and `7` test events through the same Pulse controller boundary used by
configured relays. Fixture signatures and author relationships remain subject
to the LC-NOSTR-019 verification and deterministic materialization rules.

For LC-UI-032, relay-contract fixtures retain the LC-NOSTR-020 authority and
command shapes while exercising the role, writer-policy, and invite controls
rendered by the production application.

Plugin support discussions use one NIP-29 group per plugin. NIP-7D kind `11`
topics, NIP-22 kind `1111` replies, and NIP-25 kind `7` reactions remain
ordinary signed relay events. Clients render them in posting order and retain
reply context without inventing a second content persistence model. A private,
versioned browser-local last-read cursor may retain only a post event ID and
timestamp scoped by normalized relay set, support group, and viewer. It is a
navigation preference, never relay or Registry state, and invalid or
unavailable cursors fail closed without delaying the signed discussion load.

For LC-NOSTR-002, Registry discussion posts, replies, and reactions initiated
inside `CommunityApplication` MUST use the same active host-provided
`CommunityIdentity` selected by the application login flow. The Registry
presentation MUST NOT replace that identity with an implicit NIP-07 signer.

The disposable browser event cache does not alter those protocol semantics.
When its Turso-WASM/OPFS implementation is available, the browser owner context
opens the cache through the driver's self-contained browser bundle so it can own
its complete worker pool; verified event envelopes remain the only values passed
into the shared runtime projection.
Multiple Community runtimes in that owner context share the same disposable
cache connection and cannot change event authority or verification semantics.

When materializing NIP-29 kind `9` messages or validated, decrypted NIP-17
rumors, the read model MAY preserve unique `p` and `P` tag values as mention
public keys. Those routing and relationship tags are candidate identity
metadata only: a renderer MUST link a visible member reference only when its
text resolves to a known member and the corresponding public key is present;
ambiguous or unknown text remains plain Markdown.

For LC-NOSTR-007, normalized room metadata MUST count visible kind `9`, `11`,
and `1111` events carrying the room's exact NIP-29 `h` tag and derive last
activity from the newest event in that same set. Reactions, administrative
events, deleted messages, and events for other groups MUST NOT inflate either
aggregate.

The static catalog consumes only the materialized projection and its verified
content-addressed documents. Community MAY build the same deterministic
projection directly from signed relay events and exact manifests in browser
memory when the host supplies the trusted authorities and relay set. Browser
media and Markdown MUST remain lazy, size- and SHA-256-verified resources:
image fetches MAY use a credential-free Blossom base before the signed source
URL, and no failed or unverified request may fall back to direct rendering.

Private kind `14` rumors are materialized only after their NIP-17 gift wrap and
kind `13` seal validate and decrypt for the connected identity. Application
state uses eight recent per-device NIP-78 slots, a 32 KiB plaintext ceiling,
two-second debouncing, and message/thread marker pruning before room cursors.
Host activity-log navigation is presentation-only: exposing it through the
optional application extension MUST NOT create, query, or reinterpret a Nostr
event.

For LC-NOSTR-011, the browser project catalog cache MUST persist only verified
project event envelopes and MUST partition them by normalized relay URL,
Community ID, and optional project channel. An exact cached catalog MAY restore
immediately, but MUST remain visibly stale until a live query succeeds. A
scope change MUST clear the active project projection before another partition
is restored, and invalid cached events MUST invalidate the snapshot. An
unchanged relay scope MUST retain one live project session across equivalent
options-wrapper updates. Aborted or failed session setup MUST close its relay
so repeated refresh and development reloads cannot exhaust browser WebSocket
capacity.

For LC-NOSTR-022, Buzz observer lifecycle handling includes `turn_finished`.
Live turn ordering is tracked separately from stored event pagination so a
late start cannot revive a completed turn. Profile and channel UI permissions
consume signed ownership and relay membership without granting owners room
administration rights.

For LC-ARCH-023, Nostr account login signs kind `27235` over the relay's exact
login URL, `POST` method, and SHA-256 digest of the challenge body. A restored
relay signer accepts only a signed event whose kind, timestamp, content, tags,
canonical account public key, identifier, and signature match the requested
template. Relay-backed NIP-44 operations remain bound to that same account
session and validated peer public key.

Provider callbacks surface only the relay's stable `auth_error` code. Community
removes that marker from the browser URL before presenting its mapped message;
OAuth authorization codes, state values, and provider response text never
enter the application model.

The Docker authentication contract MUST prove managed-session restoration,
author-bound NIP-42, relay event signing, NIP-44 encryption, NIP-17 gift-wrap
delivery, and NIP-98 repository reads through the real relay boundary. NIP-17
acceptance MUST allow the ephemeral gift-wrap author while retaining the
authenticated account as the session and signing authority.
It MUST also prove that an exact allowed Community origin can register a
passkey, authorize managed-key release, derive the same canonical Nostr pubkey
from the released secret, and observe migration-pending state without live
provider or authenticator credentials.

The Keytr browser Docker contract uses signed encrypted kind 31777 records
on the same relay as application authentication, exercising pre-login recovery
and subsequent NIP-42 and NIP-98 signing through the normal adapters.

### Relay-managed agent bootstrap

When NIP-11 advertises `lapis_managed_agents` version `1`, Add Agent offers an
explicit managed creation path. Community creates a disposable NIP-46 client
key in memory, asks the relay for a pending custodied identity, publishes the
owner persona, signs kind `30177`, requests the one allowed agent kind `0`, and
asks the relay to atomically activate the reciprocal records. It never receives
the agent secret key.

The one-time `lapis.agent-controller-bootstrap/1` bundle contains relay, agent,
owner, persona, prompt, managed authorization, signer environment references,
confirmed groups, defaults, and explicit placeholders for host, runtime, and
remaining groups. The NIP-46 client secret and complete bundle are never stored
in IndexedDB, Turso, local storage, logs, analytics, errors, or activity
archives, and are cleared when the dialog closes, identity changes, or the page
unloads.

The operator downloads that bundle as an owner-only file and passes its path to
`nostr-acp init`. The CLI selects the local host identifier, workspace, ACP
runtime, and any additional groups, while retaining only the file reference in
controller configuration. Community neither copies signer values into a
process environment nor invokes the controller or its managed AI Host.

Room selection performs ordinary NIP-29 add-member operations after identity
creation. A room failure is reported separately and does not roll back the
created identity. Replacement, revocation, and deletion use the relay's signed
managed-agent API. Community does not start a controller or choose a workspace,
runtime, model, or thinking level.

A general-purpose bunker for arbitrary clients remains deferred under
DEFER-AUTH-008. Git workspace bootstrap, forge tools, controller process and
runtime selection, and additional signer backends remain deferred under
DEFER-AGENT-013, DEFER-AGENT-009, DEFER-AGENT-002, and DEFER-AGENT-011.

| LC-NOSTR-027 | Community MUST discover managed-agent support through NIP-11 and complete resumable create, reciprocal activation, replacement, revocation, and deletion through body-bound NIP-98 requests. |
| LC-NOSTR-028 | Community MUST expose the controller secret only in a one-time in-memory bootstrap bundle and MUST clear it at every dialog, identity, and page-lifetime boundary. |

### Agent activity catch-up

Community uses fresh owner-signed and owner-encrypted kind `24200`
`sync_activity` controls after its live subscription is ready. Requests name an
exact DM, channel, thread, or forum-topic context and an optional controller
cursor; they never contain an opaque controller scope. Fresh agent telemetry
returns bounded pages of the original signed encrypted activity events plus a
fresh current-state snapshot. Community validates the outer event first and
accepts historical timestamps only for fully verified nested events.
Version `2` telemetry carries typed transcript entries derived from the
accepted owner-authored Nostr request and normalized controller runtime events.
Community rejects the previous ACP-envelope display format and does not read
provider session files.
Managed-agent telemetry authorization requires the relay-scoped managed tag and
the owner's signed current `30177` instance linking that exact agent; the tag
alone never establishes ownership for live capture, replay, or archive reads.
The fixed high-water mark bounds original replay events. Snapshot events may
reflect newer current state, remain state-only, and never advance the committed
replay cursor; stable signed event IDs deduplicate their later ordinary replay.

Both directions use the existing private ephemeral route. The relay applies
normal freshness, ownership, optional mutual NIP-29 membership, envelope size,
and rate limits, while storing neither controls nor pages. Final messages remain
ordinary persisted Nostr history.

## Public agent work signals

Discover non-owned agent profiles and their reciprocal owner instances from the
current relay membership graph for public status only. Subscribe to fresh kind
20002 signals from those verified identities. This never makes an agent owned,
exposes private previews, enables activity links, or permits control commands.
Owner-encrypted records remain bound to the signed-in owner and current channel
membership, including when decrypting archived records.

## Channel canvas snapshots

Project home and related channels expose one shared Markdown canvas, compatible
with Buzz Desktop kind `40100`. The owning relay admits authorized snapshots;
clients MUST verify signatures and the exact single `h` tag. Full documents are
limited to 65,536 UTF-8 bytes. The newest timestamp wins, with the lowest event
ID breaking ties. An empty snapshot clears the document without deleting history.

Before signing, clients MUST refresh channel membership, management permission,
archive state, and the canvas head. A changed head preserves the draft and
requires review; this check does not make concurrent publication atomic.
Canvas events MUST use channel read ACLs and MUST NOT become chat messages,
Inbox notifications, invocation triggers, or persistent private plaintext caches.

| ID           | Requirement                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LC-NOSTR-031 | Channel canvases MUST use verified, relay-authorized kind 40100 snapshots with one h tag, a 64 KiB UTF-8 limit, deterministic head selection, membership and management checks, read-only archives, and a fresh head check before writing. |

## Messaging and Inbox controller actions

New direct messages use encrypted NIP-17. On a relay that advertises the Buzz
implementation and its signing key, the explicitly selected Buzz transport uses
private kind-9 channels, acknowledged kind-41010 open/reopen and kind-41012 hide.
Signed kind-30622 snapshots determine hidden channels. A rejected operation
never switches transport. Kind-10050 relay deliveries retain prepared encryption
for both automatic operation retry and resubmitting the unchanged draft.

```ts
await controller.actions.sendDirectMessage([recipientPubkey], "Hello");
await controller.actions.selectInboxItem?.(conversationKey);
controller.actions.setInboxFilter?.("Direct messages", true);
await controller.actions.sendInboxMessage?.("Reply in this conversation");
await controller.actions.loadDirectHistory?.();
```

Full NIP-17 participant identity also scopes agent activity, including group DMs.
Explicit mentions are NIP-27 references in content; recipient tags alone do not
identify mentioned agents. Identity changes clear decoded conversations, drafts,
visibility snapshots and private runtime events. Shared search excludes private
plaintext and canvas/control records.

Start/Stop presentation in LC-UI-048 uses the existing version-2
`processing_get` and `processing_set` commands through the production Community
controller. Unknown state permits a refresh only; state changes carry the last
acknowledged revision. Neither a stale presence signal nor a relay publish ACK
may determine which processing state is shown as applied.

Agent configuration sharing and saved-setup deletion resolve the newest signed
kind-30177 record per owner and agent, applying valid author-matched kind-5 event
and address tombstones. A missing public profile does not remove a surviving
instance reference. Before deleting a saved kind-30175 definition, Community
refreshes references and tombstones and refuses deletion if the scan is partial
or any surviving instance still links it. This is a fresh client check, not an
atomic guarantee against a simultaneous link published by another client.

Channel and forum read acknowledgements MUST use the existing local read-cursor
store; viewing content MUST NOT publish a Nostr message or control event. A read
receipt MAY bound the cursor to one verified incoming event and, for NIP-29, a
thread identity. Topic roots belong to their own thread for unread projection.
Manual room Mark unread MUST invalidate that room's thread cursors as well as
its room cursor, without touching another relay or conversation transport.

For LC-ARCH-012, duplicate verified events MUST NOT invalidate projected
conversation content. Request ordering is local presentation state and MUST NOT
change event authority, timestamp/event-ID ordering or signature verification.
Replacing an identity or resource invalidates pending read results and errors.

### Bounded conversation history

Content live subscriptions request no stored replay (`limit: 0`). Bounded
history queries remain independent of subscriptions and read acknowledgements.
NIP-29 and Buzz pages keep their transport identity; NIP-22 comments use their
uppercase root tag. NIP-17 queries recipient envelopes, orders decoded messages
by inner timestamps, and reconciles randomized wrapper timestamps with a
two-day overlap. A saturated timestamp or incomplete relay response MUST NOT
establish complete coverage; preserved page gaps keep count claims partial.
