# Backup and restore

## Data classes

Back up these classes independently so no backup operator gains a complete user
or registry signing key:

| Data                                       | Backup form                                                | Restore proof                                            |
| ------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------- |
| Official raw events and snapshot manifests | append-only, content-addressed export                      | event signatures, event IDs, snapshot root               |
| PostgreSQL event/challenge state           | encrypted logical and provider-native backup               | migration, row counts, event-envelope equality           |
| Materializer cache and static projection   | disposable copy                                            | rebuild from raw events and compare roots                |
| Public role/kind/relay configuration       | versioned signed configuration                             | exact digest and authority-set review                    |
| Operator shares                            | independently encrypted operator custody                   | operator-local share check; never central reconstruction |
| OAuth provider mappings and account state  | encrypted private backup with separate mapping-key custody | opaque lookup and account consistency                    |
| Audit records                              | append-only encrypted export                               | sequence, time bounds, and sink integrity checks         |

Challenge rows are operational state, not durable identity data. Expired or
consumed challenges need not be restored when the approved retention policy has
removed them.

## Backup procedure

1. Record the approved environment, backup window, source snapshot root, schema
   versions, and retention class.
2. Quiesce only the component that cannot provide a consistent online export;
   do not pause public browsing or installation unnecessarily.
3. Export raw events before derived caches. Export private identity and operator
   data through their owning services, never through the registry projection.
4. Encrypt each class to its approved custodians, calculate a digest, and store
   the digest and object metadata separately from decryption material.
5. Verify that logs and manifests contain no OAuth tokens, provider subjects,
   emails, private shares, recovery contents, NIP-46 plaintext, or secret keys.
6. Replicate to the approved failure domains and record completion in the
   private audit sink.

## Clean-room restore drill

1. Obtain approval for an isolated, non-public environment with no production
   relay publication or OAuth callbacks.
2. Restore public configuration and raw events, then migrate PostgreSQL into an
   empty database.
3. Rebuild the catalog, security, community, and V1 projections from the raw
   event set. Compare accepted event IDs, exclusion counts, artifact hashes,
   and roots with the backup record.
4. Prove that a deliberately incomplete snapshot is rejected and that the prior
   complete snapshot remains usable.
5. Restore private identity mappings separately. Verify opaque lookup and
   account metadata without printing provider subjects.
6. Have each threshold operator prove its own recovery path in isolation. The
   drill must not reconstruct or export a complete private key.
7. Run one non-public signing test with a fresh round ID, verify the resulting
   event, then dispose of the test environment and record the result.

Any root mismatch, missing exact event, unverified artifact, authority drift,
or sensitive value in output fails the drill and starts incident review.
