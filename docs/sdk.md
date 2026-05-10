# CommandLayer SDK

## What the SDK does

`@commandlayer/agent-sdk` wraps an agent action, records execution metadata, creates a canonical receipt payload, signs the SHA-256 hash with Ed25519, and returns a VerifyAgent-compatible receipt object.

## Install

```bash
npm install @commandlayer/agent-sdk
```

## Wrapped agent example

```ts
import { CommandLayer } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  agent: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  verifierUrl: process.env.CL_VERIFIER_URL ?? "https://www.commandlayer.org/api/verify",
});
```

## Validation semantics (local) vs verification semantics (remote)

- `validateTrustRequest` / `validateTrustReceipt` perform local JSON Schema checks for CLAS Trust Verification v1 shape.
- `assertValidTrustRequest` / `assertValidTrustReceipt` throw descriptive schema-path errors on invalid payloads.
- Local validation does **not** verify signatures, hash integrity, key ownership, or trust status.
- `cl.verify(receipt)` calls the remote verifier API and remains the source of truth for cryptographic verification outcomes.

## Verification example

```ts
const verified = await cl.verify(result.receipt);
console.log(verified);
```

Verifier API URL: https://www.commandlayer.org/api/verify

Deprecated alias: `privateKey` is still accepted for backward compatibility, but prefer `privateKeyPem` in all new code.
