# ADR 0007: Buzz-first registry and community

- Status: accepted for implementation; production cutover remains gated
- Date: 2026-09-01
- Supersedes: ADR 0006 relay and membership implementation, ADR 0005 relay quorum

## Decision

Run the registry on the stock Buzz relay and leave its feature set intact. Lapis
does not build a custom Grain/Deno relay, extract Buzz crates, or add a registry
submission API. Buzz's PostgreSQL, Redis, object-store, and Git data are relay
implementation state; the signed Nostr event graph remains the portable source
of truth and the Lapis registry owns no projection database.

Use deterministic public NIP-29 groups derived with UUIDv5 from
`registry.lapismd.com/<path>`:

- `plugin-releases`: open stream for signed release submissions;
- `general` and `plugin-development`: open discussion streams;
- `forums`: open forum;
- `support/<plugin-id>`: one open forum per plugin.

A release submission is a normal kind `9` message in `plugin-releases` with
`t=lapis-plugin-release`, `t=plugin:<id>`, and one NIP-92 `imeta` attachment for
the release manifest. The materializer verifies the event signature, configured
publisher key, manifest bytes/hash, plugin ID, bundle digest, and existing
bundle signature trust. It does not infer authority from Buzz membership.

Curator decisions are standard kind `7` reactions to the exact release event:
`✅` approves, `❌` rejects, and `🚫` revokes. Only configured Lapis curator
pubkeys count. The latest trusted decision wins by `created_at`, then lowest
event ID. A reaction stored by the relay is not automatically authoritative.

Discussion uses Buzz's standard surface: kind `9` stream messages, kind `7`
reactions, and forum kinds `45001` (root), `45003` (reply), and `45002` (vote).
Clients page long histories with bounded relay queries and cursor state rather
than loading the complete thread.

Initial authentication is Nostr-key only through NIP-07 or another signer that
can satisfy NIP-42. Google/GitHub bridges, threshold signing, custom membership
events, and a Lapis security UI are deferred. Buzz capabilities such as private
messaging, media, search, workflows, Git, moderation, and agent identities stay
available even when the first Lapis UI does not expose them.

## Consequences

- Buzz handles generic community membership and moderation; Lapis clients and
  materializers handle registry meaning and trusted-key verification.
- The generated HTTP V1 registry remains a disposable compatibility projection
  and may coexist with the current registry until explicit cutover approval.
- The previous custom registry event materializer remains temporarily available
  for migration evidence but is no longer the target publication protocol.
- Production image publication, keys/events, DNS, deployment, and cutover remain
  manual gates.
