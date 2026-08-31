# HTTP V1 migration

`pnpm v1:check` reads the sibling legacy registry's generated V1 tree without
modifying it. The importer:

1. loads the existing trust root and restricts verification to registry-role
   Ed25519 keys;
2. verifies every index, revocation, and plugin-detail inline signature against
   its sidecar;
3. preserves bundle URL, digest, size, release metadata, and all catalog media;
4. converts each plugin and version into protocol-ready definition/release
   records;
5. projects those records back to unsigned V1 semantics and requires an exact
   canonical root match.

Generate an ignored local evidence artifact with `pnpm v1:import`. The output is
an import plan, signature evidence, and parity report; it contains no Nostr
secret keys and publishes no events. Turning records into signed publisher,
assessment, approval, and snapshot events remains behind the signer and public
publication gates.

The trust-root file hash is recorded in every plan so a later import can pin and
review the exact legacy trust basis rather than silently accepting a replaced
root.
