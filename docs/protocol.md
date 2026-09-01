# Registry protocol v1

The registry is an event graph with a deterministic curated projection. Relay
arrival order is not authoritative.

## Event graph

1. A publisher signs an addressable software-application event for a plugin ID.
2. The same publisher signs an addressable release-artifact-set event for an
   exact plugin version and bundle SHA-256.
3. A configured assessor signs a label containing automated check results and
   references the exact release event ID and bundle hash.
4. A configured curator signs an approval referencing the exact release,
   passing assessment, plugin version, and bundle hash.
5. Revocations and moderation decisions may remove matching events from the
   curated projection without deleting raw relay history.
6. A distinct snapshot signer signs the materialized root and its complete set
   of accepted event IDs.

Security materialization is independent from community reporting. An advisory
names one exact release event and artifact digest. Only a configured security
disposition authority can turn that advisory into an installer `warn` or
`block`; a later exact `resolved` disposition corrects the state
deterministically. When the service materializes security state, the advisory's
release event and artifact digest must also resolve to the approved catalog.
NIP-56 reports remain non-enforcing reviewer context.

Community materialization is also independent from catalog and security roots.
It applies one current addressable rating per pubkey/plugin, rating withdrawal,
NIP-22 review threading, NIP-25 reactions to known review events, NIP-56 report
validation, NIP-51 app collections and follow lists, plus transparent moderation
exclusions. A reaction is retained once per author, target, and reaction value
in the deterministic read model. Ratings, reviews, reactions, and reports have
no path to approval or installer enforcement.

An approval is valid only when every reference resolves exactly. One passing
assessment plus one curator approval is required in protocol v1. Event trust is
additional to, not a replacement for, existing bundle signature verification.

## Determinism

The materializer verifies event IDs/signatures, validates content and tags,
deduplicates by event ID, applies Nostr replacement ordering (`created_at`, then
lowest event ID), and sorts all projection collections before hashing canonical
JSON. Identical valid event sets therefore produce the same root when relays
reorder or replay events.

Clients consume one complete materialized snapshot. They never merge individual
plugin rows from a live Nostr result with HTTP V1 or cache rows.

## Relay membership

Relay write membership is also derived from signed events and is independent of
catalog authority. A self-registration event signed by the subject establishes
only an active community member and is accepted only when NIP-42 authentication
matches its author. A configured membership administrator may publish a full
decision for a subject containing status, additive roles, publisher plugin
scopes, and a public reason.

The latest trusted administrative decision is selected by `created_at` and then
the lowest event ID, and it always overrides self-registration regardless of
registration time. Active identities receive the `member` capability;
`publisher`, `curator`, and `security` are explicit additional roles and do not
inherit publisher scope from one another. Suspended and banned identities have
no write capability.

Membership permits relay admission but never establishes registry trust. The
materializers continue to require their independently configured publisher,
curator, registry-operator, assessor, moderator, snapshot, and security keys.

## Kinds

Standard kinds and provisional workflow-kind handling are recorded in
[`docs/adr/0002-nostr-kind-allocation.md`](adr/0002-nostr-kind-allocation.md).
Production callers must inject an approved map; fixture-only kind values are not
an allocation. Membership kinds follow the same injected-map rule.
