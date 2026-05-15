# CommandLayer Repository Instructions

This repository is part of the CommandLayer protocol stack.

## Repo role

`commandlayer/agent-sdk` is the developer SDK layer for wrapping agent actions and producing CommandLayer-compatible receipts.

This repository owns:

- developer-facing SDK APIs
- action wrapping helpers
- receipt construction helpers
- SDK-side validation
- verifier client helpers
- examples for integrating CommandLayer into agents
- TypeScript and Python SDK surfaces where present

This repository does not own CLAS schema truth, core cryptographic semantics, runtime execution policy, public verifier UI, MCP transport behavior, commercial pricing, or website marketing copy.

## Hard rules

- Do not guess.
- Do not publish packages.
- Do not merge pull requests.
- Do not invent alternate receipt shapes.
- Do not redefine CLAS schema semantics.
- Do not redefine cryptographic semantics owned by `runtime-core`.
- Do not mock, skip, simulate, or weaken verification.
- Do not claim package publication status unless verified from package metadata and registry evidence.
- Do not introduce placeholders, TODOs, skipped tests, or hardcoded secrets.
- Do not change public SDK APIs without documenting migration impact.
- Do not change receipt semantics without referencing the CLAS stack contract.

## Protocol requirements

SDK behavior MUST align with the canonical stack contract in `commandlayer/clas`:

- canonicalization ID: `json.sorted_keys.v1`
- hash algorithm: SHA-256
- signature algorithm: Ed25519
- receipts include required proof fields
- verifier responses preserve `ok`, `status`, `checks`, and `errors` semantics
- invalid hash or signature MUST NOT be represented as verified

The SDK MAY provide ergonomic wrappers, but those wrappers MUST emit CLAS-compatible receipts.

## Before editing

1. Inspect `package.json`, `README.md`, `src`, examples, tests, Python SDK files, docs, and `.env.example` where present.
2. Identify whether the change affects public API, receipt construction, wrapping behavior, verification, examples, docs, or package metadata.
3. Compare the change against the CLAS stack contract.
4. Make the smallest safe change.
5. Run build, test, typecheck, lint, and package checks if available.
6. Report changed files, commands run, results, and remaining risks.

## SDK rules

- SDK APIs SHOULD be ergonomic, but MUST NOT hide verification failure.
- Wrapped actions MUST NOT produce receipts that knowingly fail schema validation.
- SDK examples MUST use environment variables for private keys and verifier URLs.
- Examples MUST NOT hardcode private keys, production secrets, or fake verification guarantees.
- SDK docs MUST distinguish local signing, remote verification, sample receipts, and live verifier calls.
- TypeScript and Python behavior SHOULD stay semantically aligned where both exist.
- Any renamed config fields MUST include migration notes.

## Test requirements

Changes to wrapping, signing, receipt construction, verification clients, or examples SHOULD include tests for:

- valid wrap-to-receipt flow
- schema-valid receipt output
- invalid verb rejection
- missing signer configuration
- tampered receipt failure
- invalid signature failure
- verifier client invalid response handling
- TypeScript/Python parity where applicable

## Review focus

When reviewing changes, focus on:

- SDK API drift
- schema drift
- receipt shape drift
- hidden verification bypasses
- hardcoded secrets or keys
- example code that cannot run
- README claims not backed by exports
- stale package publication claims
- inconsistent TypeScript and Python behavior
- unsafe default verifier behavior

## Output format

For every task, report:

1. Summary
2. Files changed
3. Checks run
4. Results
5. Risks remaining
6. Follow-up recommendations
