# Contributing to @commandlayer/agent-sdk

This SDK implements the [CLAS](https://github.com/commandlayer/clas) trust-verification schema family for agent signing and receipt generation.

## Scope

This repo accepts:
- SDK source changes that produce or validate CLAS-compliant receipts
- Documentation improvements
- Example agents and integration patterns
- Test coverage for signing and verification flows

This repo does not accept:
- Changes that produce receipts incompatible with CLAS schemas
- Vendor-specific transport lock-in
- Closed discovery mechanisms

## Design principles

- Receipts must be CLAS-compliant: `json.sorted_keys.v1` canonicalization, SHA-256 hash, Ed25519 signature
- Local validation (`validateTrustRequest` / `validateTrustReceipt`) checks schema shape only
- Cryptographic verification is performed by `cl.verify()` against the remote verifier
- The canonical trust-verification verb list is defined in commandlayer/clas

## Canonical verbs

`verify`, `authenticate`, `authorize`, `attest`, `sign`, `permit`, `grant`, `approve`, `reject`, `endorse`

## Pull requests

- Keep changes minimal and focused
- Include or update tests for signing/validation behavior
- Do not introduce new dependencies without discussion
- Reference the relevant CLAS schema or spec when changing receipt structure
