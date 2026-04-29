# @commandlayer/agent-sdk

Wrap one function. Emit proof. Verify anywhere.

`@commandlayer/agent-sdk` is a minimal Node-first TypeScript SDK for generating signed receipts around agent actions.

> Publication note: this package scaffold is not published to npm yet.

## Why

Agent runs → receipt is signed → anyone can verify → tampering breaks it.

Agents don’t make claims — they produce proof.

Verification endpoint: https://www.commandlayer.org/verify.html

## Install (local for now)

```bash
npm install
```

## Quick start

### 1) Environment setup

Copy `.env.example` and set your signer + Ed25519 PKCS8 private key PEM:

```env
CL_RECEIPT_SIGNER=runtime.commandlayer.eth
CL_KEY_ID=vC4WbcNoq2znSCiQ
CL_CANONICAL_ID=json.sorted_keys.v1
CL_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
```

### 2) Basic usage

```ts
import { CommandLayer } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  signer: "runtime.commandlayer.eth",
  keyId: "vC4WbcNoq2znSCiQ",
  canonicalization: "json.sorted_keys.v1",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
});

const receipt = await cl.wrap("agent.execute", {
  input: { task: "summarize", content: "hello world" },
  run: async () => ({ summary: "hello world" }),
});

console.log(receipt);
```

## Receipt format

```json
{
  "signer": "runtime.commandlayer.eth",
  "verb": "agent.execute",
  "ts": "2026-01-01T00:00:00.000Z",
  "input": {},
  "output": {},
  "execution": { "status": "ok", "duration_ms": 12 },
  "metadata": {
    "proof": {
      "canonicalization": "json.sorted_keys.v1",
      "hash_sha256": "..."
    }
  },
  "signature": {
    "alg": "ed25519",
    "kid": "vC4WbcNoq2znSCiQ",
    "sig": "..."
  }
}
```

## Signing behavior

- Canonicalize sorted JSON payload.
- Hash canonical payload with SHA-256.
- Sign the hash hex string with Ed25519.
- Attach base64 signature.

Canonical payload includes only:

```json
{
  "signer": "...",
  "verb": "...",
  "input": {},
  "output": {},
  "execution": {},
  "ts": "..."
}
```

## Development

```bash
npm run build
npm test
```

## License

MIT
