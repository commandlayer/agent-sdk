# @commandlayer/agent-sdk

Wrap one function. Emit proof. Verify anywhere.

`@commandlayer/agent-sdk` is a minimal Node-first TypeScript SDK for generating signed receipts around agent actions.

> Publication note: this package scaffold is not published to npm yet.

## Why

Agent runs → receipt is signed → anyone can verify → tampering breaks it.

## Install (local repo)

```bash
npm install
npm run build
```

## Environment setup

```bash
cp .env.example .env
```

Then set your signer + Ed25519 PKCS8 private key PEM in `.env`.

## Run examples

```bash
npm run example:basic
npm run example:langchain
```

Paste output into:

https://www.commandlayer.org/verify.html

## Quick start

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

## Development

```bash
npm test
```

## License

MIT
