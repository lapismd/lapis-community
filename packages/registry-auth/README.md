# @lapismd/registry-auth

Key-custody-free signing and request-authentication boundaries for the Lapis
registry. NIP-07 and NIP-46 adapters ask an external signer to sign exact event
templates; registry code never receives the private key.

The package also creates and verifies NIP-98 HTTP authorization events, including
exact URL/method, freshness, optional payload digest, and an implementation-level
challenge tag for replay-resistant sensitive operations.
