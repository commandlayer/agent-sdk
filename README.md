# @commandlayer/agent-sdk

Wrap your agent. Emit a signed receipt. Verify through CommandLayer.

`@commandlayer/agent-sdk` is a minimal Node-first TypeScript SDK for generating signed receipts from ENS-named agents and verifying them with the public CommandLayer verifier.

## Install

```bash
npm install @commandlayer/agent-sdk
```

> Temporary caveat (as of May 9, 2026): package availability on npm may vary by registry policy/account permissions.
> If `npm install @commandlayer/agent-sdk` fails in your environment, use local development install:

```bash
npm install
npm run build
```

## Quickstart

```ts
import { CommandLayer, validateTrustReceipt } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  signer: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
});

const { output, receipt } = await cl.wrap("verify", {
  input: { challenge: "abc" },
  run: async () => ({ approved: true }),
});

const local = validateTrustReceipt(receipt); // schema only
if (!local.ok) throw new Error(local.errors.join("; "));

const remote = await cl.verify(receipt); // cryptographic verification
console.log({ output, receipt, remote });
```

## Wrap your agent

`wrap()` returns `{ output, receipt }`; `receipt` is signed.

```ts
import { CommandLayer } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  signer: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  verifierUrl: process.env.CL_VERIFIER_URL ?? "https://www.commandlayer.org/api/verify",
});
```

`verifierUrl` is optional; use it only when you need to override the default verifier endpoint.

> **Note:** The constructor accepts both `signer` and `agent` as field names (they are aliases). `signer` is the canonical field name used in receipt payloads; `agent` is accepted for backward compatibility.

## CLAS Trust Verification v1

Use local schema validation helpers to check request/receipt shape before transport or persistence:

```ts
import {
  validateTrustRequest,
  validateTrustReceipt,
  assertValidTrustRequest,
  assertValidTrustReceipt,
} from "@commandlayer/agent-sdk";

const requestResult = validateTrustRequest(requestPayload);
if (!requestResult.ok) console.error(requestResult.errors);

const receiptResult = validateTrustReceipt(receiptPayload);
if (!receiptResult.ok) console.error(receiptResult.errors);

assertValidTrustRequest(requestPayload);
assertValidTrustReceipt(receiptPayload);
```

These helpers validate schema shape only. They do **not** perform cryptographic verification and do not replace `cl.verify()`.

Supported receipt verbs: `verify`, `authenticate`, `authorize`, `attest`, `sign`, `permit`, `grant`, `approve`, `reject`, `endorse`. Canonical capability names for discovery/catalog use `clas.trust-verification.<verb>` (for example `clas.trust-verification.verify`).

## Python SDK

A Python SDK is available in the `python-sdk/` directory. See `python-sdk/README.md` for usage.

## Development

```bash
npm test
```

## License

MIT


### Verb conventions

Use `cl.wrap("verify", handler)` for normal SDK usage. For discovery/catalog metadata, advertise the canonical capability name `clas.trust-verification.verify`. The SDK also accepts fully-qualified trust capability inputs in `wrap(...)` and normalizes emitted receipt `verb` to the short form.
