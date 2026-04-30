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

## Builder integration examples

All examples are dependency-free TypeScript and use:

- `CL_PRIVATE_KEY_PEM`
- `CL_KEY_ID`
- `CL_AGENT` (defaults to `exampleagent.eth`)

Examples by builder type:

- **Agent frameworks**
  - `examples/basic-js-agent.ts`
  - `examples/langchain-wrapper.ts`
- **Tool/function calling**
  - `examples/openai-tool-wrapper.ts`
- **Workflow automation**
  - `examples/workflow-job-runner.ts`
- **Multi-agent systems**
  - `examples/agent-to-agent-verify.ts`
- **Existing agent integration**
  - `examples/existing-agent-integration.ts`

Run them after build:

```bash
npm run example:basic
npm run example:tool
npm run example:langchain
npm run example:workflow
npm run example:a2a
npm run example:existing
```

See also: `docs/examples.md`.

## Already have an agent?

CommandLayer wraps the boundary around the action so your agent keeps its existing logic. The SDK emits a signed receipt that can be verified publicly.

```ts
const result = await cl.wrap("agent.execute", {
  input,
  run: () => existingAgent.run(input)
});

const verified = await cl.verify(result.receipt);
```


## Development

```bash
npm test
```

## License

MIT
