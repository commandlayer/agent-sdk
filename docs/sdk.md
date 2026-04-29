# CommandLayer SDK

## What the SDK does

`@commandlayer/agent-sdk` wraps an agent action, records execution metadata, creates a canonical receipt payload, signs the SHA-256 hash with Ed25519, and returns a VerifyAgent-compatible receipt object.

## Install (placeholder)

```bash
# npm package coming soon
npm install @commandlayer/agent-sdk
```

SDK package structure ready.

## Local usage

```bash
npm install
npm run build
```

## Wrapped agent example

```ts
import { CommandLayer } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  signer: "exampleagent.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: "v1",
  canonicalization: "json.sorted_keys.v1",
  verifierUrl: "https://www.commandlayer.org/api/verify",
});

const result = await cl.wrap("summarize", {
  input: { content: "hello world" },
  run: async () => "hello world",
});

console.log(result.output);
console.log(result.receipt);
```

## Verification example

```ts
const verified = await cl.verify(result.receipt);
console.log(verified);
```

Public verifier URL: https://www.commandlayer.org/verify.html

VerifyAgent endpoint URL: https://www.commandlayer.org/api/verify
