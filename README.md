# @commandlayer/agent-sdk

Wrap your agent. Emit a signed receipt. Verify through CommandLayer.

`@commandlayer/agent-sdk` is a minimal Node-first TypeScript SDK for generating signed receipts around agent actions and verifying them with the live verifier API.

> Publication note: this package scaffold is not published to npm yet.

## Install (local repo)

```bash
npm install
npm run build
```

## Wrap your agent

```ts
import { CommandLayer } from "@commandlayer/agent-sdk";

const cl = new CommandLayer({
  agent: "exampleagent.eth",
  privateKey: process.env.CL_PRIVATE_KEY_PEM,
  keyId: "v1",
  verifierUrl: "https://www.commandlayer.org/api/verify",
});

const result = await cl.wrap("summarize", async () => {
  return { summary: "hello world" };
});
```

## Emit a signed receipt

```ts
console.log(result.output);
console.log(result.receipt);
```

## Verify through CommandLayer

```ts
const verified = await cl.verify(result.receipt);
console.log(verified.status);
```

Live verifier API:

- `https://www.commandlayer.org/api/verify`

VerifyAgent page:

- https://www.commandlayer.org/verify.html

## Development

```bash
npm test
```

## License

MIT
