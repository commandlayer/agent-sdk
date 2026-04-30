# Builder integration examples

These demo-safe examples show how different builders can use CommandLayer receipts with a simple pattern:

1. wrap a function with `CommandLayer.wrap(...)`
2. emit a signed receipt
3. verify it with the default CommandLayer verifier URL

All examples are dependency-free and intentionally use mocked execution (no real OpenAI, LangChain, or Zapier dependencies).

## Environment variables

- `CL_PRIVATE_KEY_PEM`
- `CL_KEY_ID`
- `CL_AGENT` (defaults to `exampleagent.eth`)

## Verifier endpoints

- Default verifier URL: `https://www.commandlayer.org/api/verify`
- VerifyAgent endpoint: `https://www.commandlayer.org/api/agents/verifyagent`

## Examples

- `examples/basic-agent.ts` — **Agent frameworks**
  - Minimal agent function (`summarize`) wrapped with CommandLayer.
- `examples/openai-tool-wrapper.ts` — **Tool/function calling**
  - Demo-safe OpenAI-style tool payload (`get_weather`) wrapped as `tool.get_weather`.
- `examples/langchain-agent.ts` — **Agent frameworks**
  - Demo-safe LangChain-style `chain.invoke(...)` flow.
- `examples/wrapped-agent-demo.ts` — **Agent frameworks**
  - Minimal wrapped demo that prints output, receipt, and verification.
- `examples/workflow-job-runner.ts` — **Workflow automation**
  - Demo-safe Zapier/Make/n8n-style workflow run with steps recorded in output.
- `examples/agent-to-agent-verify.ts` — **Multi-agent systems**
  - Agent A produces a receipt and Agent B verifies it.
- `examples/existing-agent-integration.ts` — **Existing agent integration**
  - Keep current agent logic and wrap only the execution boundary.

## Run

After building:

- `npm run example:basic`
- `npm run example:wrapped`
- `npm run example:tool`
- `npm run example:langchain`
- `npm run example:workflow`
- `npm run example:a2a`
- `npm run example:existing`

## Receipt shape example

```json
{
  "signer": "exampleagent.eth",
  "verb": "tool.get_weather",
  "ts": "2026-04-29T14:22:00.000Z",
  "input": {
    "tool_name": "get_weather",
    "arguments": {
      "city": "Jacksonville"
    }
  },
  "output": {
    "city": "Jacksonville",
    "forecast": "sunny"
  },
  "execution": {
    "status": "ok",
    "duration_ms": 12,
    "started_at": "2026-04-29T14:22:00.000Z",
    "completed_at": "2026-04-29T14:22:00.012Z"
  },
  "metadata": {
    "proof": {
      "canonicalization": "json.sorted_keys.v1",
      "hash_sha256": "..."
    }
  },
  "signature": {
    "alg": "ed25519",
    "kid": "v1",
    "sig": "..."
  }
}
```

## Common errors

- Missing `CL_PRIVATE_KEY_PEM`.
- Missing `CL_KEY_ID`.
- Missing `CL_AGENT` (if omitted, SDK/examples default to `exampleagent.eth`).
- Verification returns `INVALID` if receipt input/output is modified after signing.
- Network errors can occur when the public verifier is unreachable.
