# Audit: agent-sdk runtime-core alignment

Date: 2026-05-18
Branch: `codex/create-audit-for-agent-sdk-release-readiness`
Scope audited: current repository (`/workspace/agent-sdk`); requested `commandlayer/agent-sdk` path is not present in this environment.

## 1) Current rating
**8.3/10 (close to release-ready, with packaging/versioning cleanup still required).**

Why:
- Canonical proof shape is now aligned to `receipt.metadata.proof.*`.
- Verified local validation (outside Codex registry-limited environment) passed full install/build/test.
- Test results indicate runtime-core-verifiable receipt behavior is covered in current suite.
- Remaining concerns are release packaging and versioning decisions, not core runtime/protocol correctness.

## 2) Target rating
**9/10** after final release packaging/version cleanup:
- add explicit package `exports` map,
- finalize semver decision,
- re-run `npm pack` after build and verify packaged contents (including schemas).

## 3) Commands and validation status
### Codex environment (this container)
- Registry/network constraints may prevent reproducible npm install in this environment.
- These environment-specific issues should not be treated as product/runtime failures.

### Verified local Windows validation (authoritative for this PR update)
- `npm install` ✅ passed
- `npm run build` ✅ passed
- `npm test` ✅ passed
- Result: **17 passed, 0 failed**

## 4) Does agent-sdk currently emit receipts VerifyAgent can verify?
**Yes, based on local validated test suite and canonical proof-shape alignment.**

- Canonical proof shape now follows `receipt.metadata.proof.*`.
- Local tests indicate emitted receipts are runtime-core-verifiable.

## 5) Does agent-sdk currently verify runtime receipts?
**Evidence indicates yes at the SDK behavior level under local validated tests.**

- Local test pass (17/0) supports runtime interoperability expectations for canonical receipts.
- Remaining release risks are packaging/version signaling, not receipt verification semantics.

## 6) Remaining release blockers (real blockers only)
1. Package version remains `1.1.0` (release bump decision pending).
2. No explicit `exports` map in `package.json`.
3. `npm pack` should be re-run locally after build as final packaging gate.
4. Confirm schema files are included in built output (`dist/src`) and npm tarball.
5. Decide semver path: `1.2.0` vs `2.0.0`.

## 7) Version recommendation
- **Likely `1.2.0`** if no external users rely on the old proof shape.
- **Use `2.0.0`** if `metadata.proof` migration is treated as a public breaking API change for downstream consumers.

## 8) Release recommendation
**Not ready to publish yet, but close.**

- Remaining work is packaging/version/export cleanup.
- No additional runtime-core protocol/signature architecture changes are the primary blocker at this stage.

## 9) Final readiness summary
- Runtime/protocol alignment: **substantially complete**.
- Local quality gate: **passed** (`install`, `build`, `test`; 17/0).
- Release gate: **pending packaging + semver finalization**.
