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
  signer: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  verifierUrl: process.env.CL_VERIFIER_URL ?? "https://www.commandlayer.org/api/verify",
});
```

> **Note:** The constructor accepts both `signer` and `agent` as field names (they are aliases). `signer` is the canonical field name used in receipt payloads; `agent` is accepted for backward compatibility.

## Practical trust flow (schema + remote verification)

```ts
import { CommandLayer, validateTrustReceipt } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  signer: "verifyagent.eth",
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
});

const result = await cl.wrap("verify", {
  input: { challenge: "abc" },
  run: async () => ({ approved: true }),
});

const local = validateTrustReceipt(result.receipt);
if (!local.ok) throw new Error(local.errors.join("; "));

const remote = await cl.verify(result.receipt);
console.log(remote);
```

Local validation checks only JSON shape/format against CLAS schemas. It does **not** prove signature correctness, hash integrity, or signer trust. Cryptographic verification is performed by the verifier (`cl.verify(...)`).

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

## Canonical CLAS verb list

The following trust-verification verbs are defined in [commandlayer/clas](https://github.com/commandlayer/clas) and are the canonical set recognized by the CLAS Trust Verification v1 schema:

`verify`, `authenticate`, `authorize`, `attest`, `sign`, `permit`, `grant`, `approve`, `reject`, `endorse`

Use `cl.wrap("verify", handler)` as the standard SDK path. For discovery/catalog metadata, use the canonical capability name format `clas.trust-verification.<verb>` (for example `clas.trust-verification.verify`).

## ENS discovery

When publishing agent metadata to ENS, use the TXT record keys defined in the CLAS ens-discovery spec:

| Key | Description |
|-----|-------------|
| `cl.schema` | CLAS schema URI |
| `cl.openapi` | OpenAPI spec URI |
| `cl.mcp` | MCP endpoint URI |
| `cl.receipt.schema` | Receipt schema URI |
| `cl.verifier` | Verifier endpoint URI |
| `cl.capability` | Agent capability descriptor |
| `cl.version` | CLAS version |
| `cl.family` | Schema family |
| `cl.verb` | Supported verb(s) |
| `cl.proof` | Proof method |
| `cl.signer` | Signer ENS name |
| `agent-registration[<registry>][<agentId>]` | Agent registry record |

These keys are defined in the CLAS ens-discovery spec (`commandlayer/clas`) and should be used when publishing agent metadata to ENS.
