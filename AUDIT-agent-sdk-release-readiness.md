# Audit: agent-sdk release readiness (canonical runtime-core alignment)

Date: 2026-05-18 (UTC)
Branch: `audit/agent-sdk-release-readiness`
Scope note: requested path `commandlayer/agent-sdk` does not exist in this checkout; audit executed in repository root package `@commandlayer/agent-sdk`.

## Current rating
**5/10 (Not release-ready)**

## Target rating
**9/10 (Release-ready)**

## Findings

### 1) package.json version and exports
- Current version is `1.1.0`.
- `exports` field is not defined.
- `main` and `types` point to `dist/src/index.js` and `dist/src/index.d.ts`.

Assessment:
- Version has not been incremented for canonical runtime-core alignment.
- Missing `exports` increases risk for resolution ambiguity across ESM/CJS and tooling.

### 2) package files include dist and schemas
- `files` currently includes:
  - `dist/src`
  - `dist/examples`
  - `README.md`
  - `LICENSE`
- Package file allowlist does **not** explicitly include schema JSON files.
- `npm pack --dry-run` confirms packaged content omits `src/schemas.*.json` and any copied schemas unless present under included paths.

Assessment:
- Potential release blocker if consumers need runtime schema assets from the package.
- Including `dist/examples` in release tarball is unusual and may be unnecessary weight.

### 3) README install/import examples
- Install example is correct: `npm install @commandlayer/agent-sdk`.
- Import example uses named ESM import and appears consistent with current SDK API.

Assessment:
- README install/import snippets are generally aligned.

### 4) no legacy proof field references
### 5) no stale receipt.proof references
- No obvious legacy `receipt.proof` references found in source/readme.
- References consistently use `receipt.metadata.proof` across tests and examples.

Assessment:
- ✅ Looks aligned with canonical metadata proof envelope usage.

### 6) all examples build
- Build fails; examples do not compile in this environment because dependencies/types are unresolved.
- Primary cause appears to be failed dependency installation (`npm install` 403), causing missing `@types/node`, `dotenv`, `@commandlayer/runtime-core`, `ajv`, etc.

Assessment:
- Release validation incomplete; examples cannot be confirmed buildable under current environment constraints.

### 7) package-lock status
- `package-lock.json` exists.
- No lockfile modifications were made during this audit.

Assessment:
- Lockfile present and stable in this run.

### 8) npm pack --dry-run contents
- Dry run succeeds and reports package `@commandlayer/agent-sdk@1.1.0`.
- Tarball includes dist JS/DTs and README/LICENSE/package.json.
- Tarball does **not** show schema JSON assets.

Assessment:
- Packaging currently passes mechanically but likely misses schema artifacts for trust validation workflows if they are expected at runtime.

### 9) whether version should be 1.2.0 or 2.0.0
Recommendation: **1.2.0** (minor), not 2.0.0.

Rationale:
- Canonical runtime-core alignment appears additive/normalization-focused rather than an explicit breaking API removal.
- No clear evidence in this audit of deliberate breaking surface changes requiring major bump.
- If introducing strict `exports` causes import-path breakage for known consumer deep-import patterns, reassess to 2.0.0; otherwise keep at 1.2.0 with release notes.

### 10) release blockers

## Release recommendation
**Do not release yet**. Address blockers first, then rerun full install/build/test/pack checks in a clean environment.

## Blockers
1. `npm install` fails with `403 Forbidden` fetching dependency tarball (`require-from-string@2.0.2`) in this environment, preventing reliable verification.
2. `npm run build` / `npm test` fail due to unresolved dependencies/types (downstream of failed install).
3. Package allowlist (`files`) does not explicitly include schemas; `npm pack --dry-run` output suggests schema JSON assets are missing from tarball.
4. `package.json` lacks explicit `exports` map (not always mandatory, but recommended for release hardening and compatibility clarity).

## Commands run (and outcomes)
- `npm install` → failed (403 Forbidden from npm registry URL).
- `npm run build` → failed (TypeScript unresolved modules/types).
- `npm test` → failed (pretest build failure).
- `npm pack --dry-run` → succeeded; inspected tarball contents.
