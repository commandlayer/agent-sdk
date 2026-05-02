# CommandLayer SDK

## What the SDK does

`@commandlayer/agent-sdk` wraps an agent action, records execution metadata, creates a canonical receipt payload, signs the SHA-256 hash with Ed25519, and returns a VerifyAgent-compatible receipt object.

## Install

```bash
npm install @commandlayer/agent-sdk
```

## Local usage

```bash
npm install
npm run build
```

## Wrapped agent example

```ts
import { CommandLayer } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  signer: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
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

Verifier API URL: https://www.commandlayer.org/api/verify

Callable VerifyAgent URL: https://www.commandlayer.org/api/agents/verifyagent
