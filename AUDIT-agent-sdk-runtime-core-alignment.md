# Audit: agent-sdk runtime-core alignment

Date: 2026-05-18
Branch: `audit/agent-sdk-runtime-core-alignment`
Scope audited: current repository (`/workspace/agent-sdk`); requested `commandlayer/agent-sdk` path is not present in this environment.

## 1) Current rating
**4/10 (partially aligned, not canonical-runtime-core aligned).**

Why:
- SDK does emit signed receipts, but proof envelope is legacy (`proof.canonical`, `proof.alg`, `proof.signature`) rather than canonical `metadata.proof.*` hierarchy.
- Algorithm identifier in emitted receipts is lowercase `ed25519`, not canonical `Ed25519`.
- Verification path is remote HTTP pass-through (`cl.verify`) only; no local runtime-core-backed verification integration.
- Canonicalization/signing implementation is local/custom (`canonicalize.ts`, `receipt.ts`, `crypto.ts`) instead of delegating to runtime-core authority.

## 2) Target rating
**9/10** after migration to `@commandlayer/runtime-core@1.2.0` as source of truth for:
- `signCommandLayerReceipt()`
- `verifyCommandLayerReceipt()`
- `buildCanonicalProof()`
- constants (`CANONICAL_METHOD`, `SIGNATURE_ALG`)
- `parsePublicKey()` where ENS/public-key path exists.

(10/10 after publish-quality docs/examples/tests all updated and old shapes removed or explicitly compatibility-gated.)

## 3) Does agent-sdk currently emit receipts VerifyAgent can verify?
**Likely yes for current legacy VerifyAgent compatibility, but not in canonical envelope form required by runtime-core alignment.**

Evidence:
- README/docs claim VerifyAgent compatibility and remote verify flow.
- `cl.verify()` posts `{ receipt }` to verifier endpoint.
- Receipt schema and tests enforce legacy proof fields.

Risk:
- If VerifyAgent/runtime starts requiring canonical `metadata.proof.hash/signature/canonicalization` envelope, current SDK output will fail or require server-side legacy normalization.

## 4) Does agent-sdk currently verify runtime receipts?
**No local canonical verification. Partial remote verification only.**

- Current API `cl.verify(receipt)` is an HTTP call to verifier URL.
- No local invocation of runtime-core `verifyCommandLayerReceipt()`.
- No local parsing/verification of canonical runtime envelope.

## 5) Duplicate crypto/proof logic inventory
Local implementations that should be replaced/delegated to runtime-core:
- JSON canonicalization: `src/canonicalize.ts`
- Canonical payload assembly: `canonicalPayloadFromReceiptInput` in `src/receipt.ts`
- Signature generation: `src/crypto.ts` + `createReceipt` in `src/receipt.ts`
- Proof envelope construction: `createReceipt` in `src/receipt.ts`
- Schema lock-in to legacy proof layout: `src/schemas.trust-receipt-v1.json`

## 6) Public API mismatch list
1. **Proof location mismatch**
   - Current: top-level `proof`
   - Target: `metadata.proof.{canonicalization,hash,signature}`

2. **Algorithm casing mismatch**
   - Current emitted/validated enum: `ed25519`
   - Target: `Ed25519`

3. **Hash envelope mismatch**
   - Current: no explicit hash envelope (`hash.alg`, `hash.value`) in receipt proof.
   - Target: explicit `metadata.proof.hash.alg = "SHA-256"`, `value`.

4. **Signature field naming mismatch**
   - Current: `proof.signature` (+ `proof.kid`, `proof.signer_id`)
   - Target: `metadata.proof.signature.{alg,value,kid}`

5. **Constructor key naming (partial mismatch/aliasing)**
   - Current: `privateKeyPem` preferred, legacy alias `privateKey` accepted.
   - Requested audit concern includes `privateKeyPemOrDer`; not present in current public config.

6. **Verifier API contract uncertain for canonical receipts**
   - Current client sends raw `receipt` to remote verifier; no explicit version negotiation for canonical envelope.

## 7) Files likely affected (implementation phase)
- `src/index.ts` (SDK config/API shape and verification integration)
- `src/receipt.ts` (receipt/proof generation)
- `src/crypto.ts` (likely deleted or narrowed to runtime-core passthrough)
- `src/canonicalize.ts` (likely deleted/replaced)
- `src/schemas.trust-receipt-v1.json`
- `src/schemas.trust-request-v1.json` (if request schema references proof expectations indirectly)
- `src/trust.ts` (schema validation behavior)
- `test/receipt.test.ts`
- `test/trust.test.ts`
- `README.md`
- `docs/sdk.md`
- `docs/examples.md`
- `examples/*.ts`
- `package.json` (add runtime-core dependency; potential semver bump)

## 8) Safe implementation order
1. Add runtime-core dependency and wire thin adapters (no behavior change yet behind feature flag).
2. Implement canonical proof generation path using runtime-core APIs.
3. Add dual-read compatibility verification path (accept canonical; optionally legacy only if required).
4. Update schemas to canonical envelope (optionally transitional schema supporting both shapes for one release).
5. Migrate SDK public types and emitted receipt shape.
6. Update docs/examples.
7. Expand tests for canonical + compatibility scenarios.
8. Remove duplicate local crypto/canonicalization logic after parity is proven.

## 9) Tests needed
- Unit: emitted receipt has canonical envelope fields exactly.
- Unit: algorithm casing is exactly `Ed25519`; hash alg exactly `SHA-256`.
- Unit: canonicalization value matches runtime-core `CANONICAL_METHOD`.
- Unit: signatures generated by SDK verify via `verifyCommandLayerReceipt()`.
- Unit: SDK verifies runtime-emitted receipts (round-trip interoperability).
- Contract tests: VerifyAgent endpoint accepts SDK canonical receipts.
- Regression tests: legacy receipts behavior (accept/reject policy explicit).
- Type-level tests: public API config key names and deprecations.

## 10) Release blockers before npm publish
1. Canonical envelope not implemented.
2. Lowercase alg (`ed25519`) hardcoded in schema/tests.
3. Local crypto authority duplicates runtime-core.
4. No runtime-core verification integration.
5. README/docs claim VerifyAgent compatibility without clarifying canonical/legacy boundary.
6. CI/build currently failing in this environment due to dependency install failure and resulting TypeScript missing-module errors.

## 11) Recommendation: safe to use as canonical SDK today?
**No.**

Use only as **legacy-compatible wrapper** pending runtime-core alignment. Not recommended as canonical CLAS SDK until proof envelope, algorithm casing, and verification pipeline are runtime-core sourced.

---

## Required audit checklist findings

### A. Current receipt signing logic
- `CommandLayer.wrap()` builds receipt input + execution metadata, then calls `createReceipt`.
- `createReceipt` canonicalizes payload and signs canonical string bytes with Ed25519 private key from PEM.
- Output includes top-level `proof` legacy fields.

### B. Current verification logic
- Only remote verifier call via `fetch(verifierUrl, { body: { receipt } })`.
- No local signature verification API in SDK surface.

### C. Local canonicalization/hash/signature code
- Canonicalization: custom sorted-key canonicalizer.
- Signature: WebCrypto `subtle.sign("Ed25519", ...)` and base64 encoding.
- No explicit receipt hash value materialized in proof envelope.

### D. Local schema/proof definitions
- Receipt schema requires `proof.canonical`, `proof.alg`, `proof.signature`, `proof.kid`, `proof.signer_id`.
- `proof.alg` enum only allows `ed25519`.

### E. Legacy fields status
- `hash_sha256`: not present.
- `signature_b64`: not present.
- `proof.alg`: present (legacy).
- `proof.canonical`: present (legacy).
- `proof.canonical_id`: not present.
- top-level `signature.*`: not present.

### F. Algorithm casing
- Crypto API uses WebCrypto algorithm name `Ed25519` internally.
- Receipt payload/schema/tests use lowercase `ed25519` (mismatch with canonical requirement).

### G. Key config names
- Public constructor supports `privateKeyPem` and deprecated alias `privateKey`.
- No `privateKeyPemOrDer` in current API.
- Internal normalization: `privateKeyPem = config.privateKeyPem ?? config.privateKey`.

### H. Current public SDK API
- `new CommandLayer({ signer|agent, kid, privateKeyPem|privateKey, verifierUrl, timeoutMs, canonicalization })`
- `wrap(verb, handler)` => `{ output, receipt }`
- `verify(receipt)` => remote verifier response
- local schema helpers exported from `trust.ts`

### I. Example output shape
Examples/docs show:
- top-level `proof` object with `canonical`, `alg`, `signature`, `kid`, `signer_id`.

### J. README claims
- Markets SDK as signed-receipt + verifier integration.
- States local validation is schema-only and remote verify is source of truth.
- Does not yet document canonical runtime-core proof envelope.

### K. Test coverage
- Strong coverage for legacy receipt construction/schema validity and remote verify request wiring.
- No tests for runtime-core API usage or canonical metadata.proof envelope.

### L. npm publish readiness
- `package.json` has publish metadata, but canonical alignment blockers above remain.
- Build/test not currently passing in this environment due to install/build failures.
