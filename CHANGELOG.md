# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-05-18

### Changed

- Emits canonical `@commandlayer/runtime-core` receipts.
- Uses the `metadata.proof` envelope for receipt proofs.
- Delegates signing to `@commandlayer/runtime-core`.
- Verifies SDK-emitted receipts with `@commandlayer/runtime-core` in tests.
- Build fixes: Ajv 2020 compatibility and cross-platform schema copy handling.
- No publishing was performed in this PR.

## [1.1.0] - 2026-05-12

### Breaking Changes

- **Signing approach changed**: receipts are now signed over `Ed25519(UTF8(canonicalize(payload)))` — the raw UTF-8 bytes of the canonical JSON string. Previously the SDK signed the hex-encoded SHA-256 hash of the canonical string. Receipts signed with v1.0.x are **not** verifiable by v1.1.0 verifiers and vice versa.
- **Proof field names renamed** to align with CommandLayer Protocol v1.1:
  - `proof.signature_alg` → `proof.alg`
  - `proof.key_id` → `proof.kid`
  - `proof.signer` → `proof.signer_id`
  - `proof.canonicalization` → `proof.canonical`
- **`proof.hash` removed** — the intermediate SHA-256 hex field is no longer produced or included in the proof.
- **`DEFAULT_VERIFIER_URL`** changed from `https://www.commandlayer.org/api/verify` to `https://runtime.commandlayer.org/verify`.

### Added

- `TRUST_FAMILY` and `TRUST_VERSION` are now exported constants from the main entry point.
- `publishConfig` added to `package.json` for public npm publishing.
- `SECURITY.md` documenting the signing protocol and known limitations.
- CI workflow (`.github/workflows/ci.yml`) — runs `npm test` on every push and PR.

### Changed

- `src/trust.ts` now uses `createRequire` instead of `readFileSync` for JSON schema loading — more idiomatic ESM.
- `proof.alg` is now validated as an `enum: ["ed25519"]` in the receipt schema rather than a free string.
- Default `canonicalization` value in `CommandLayer` constructor simplified to a single string literal.
- Version bumped to `1.1.0`.

## [1.0.1] - 2026-04-15

### Fixed

- Corrected `privateKey` deprecation warning logic.

## [1.0.0] - 2026-03-01

Initial release.
