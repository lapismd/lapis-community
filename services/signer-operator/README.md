# Registry signer operator

Core for an independently deployable threshold-share boundary. Each instance is
configured for one operator identity, an allowlist of public group keys, a
durable one-use round store, an opaque threshold-share engine, and a private
audit sink.

The operator reserves a round before invoking the engine, so a retry cannot
reuse signing nonces. Its logs contain only the operator id, group pubkey, round
id, outcome, and time—not the opaque engine payload, partial signature, share,
event content, OAuth identity, or recovery data.

The included memory store and fake test engine are development fixtures. A
production deployment requires durable atomic round reservation, an externally
reviewed FROST-compatible engine, isolated share storage, authenticated
coordinator transport, backup/re-sharing procedures, and an operator ceremony.
