# Operator runbooks

These runbooks define the production gates around the locally verified registry
implementation. They deliberately contain no production endpoints, credentials,
key shares, OAuth client values, or recovery packages.

- [`key-ceremony.md`](key-ceremony.md): create, distribute, rotate, and revoke
  protected registry and threshold identities.
- [`backup-and-restore.md`](backup-and-restore.md): back up each data class and
  prove a clean-room restore without centralizing user keys.
- [`incident-response.md`](incident-response.md): contain relay, authority,
  identity, signer, and artifact incidents and publish attributable corrections.
- [`rollback.md`](rollback.md): return the site and Lapis to a prior complete
  state while keeping installation available.
- [`data-retention.md`](data-retention.md): separate durable public events from
  erasable private account, audit, and operational data.

Executing any ceremony, production restore, public correction, deployment, or
cutover remains a manual gate. Every exercise must record its participants,
approved scope, immutable input/output digests, start/end time, and result in a
private incident or ceremony record. Never record secret material.
