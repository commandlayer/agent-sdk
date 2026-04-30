# Builder integration examples

These examples show how different builders can use CommandLayer receipts with a simple pattern:

1. wrap a function with `CommandLayer.wrap(...)`
2. emit a signed receipt
3. verify it with the default CommandLayer verifier URL

All examples use these env vars:

- `CL_PRIVATE_KEY_PEM`
- `CL_KEY_ID`
- `CL_AGENT` (defaults to `exampleagent.eth`)

## Examples

- `examples/basic-js-agent.ts` — **Agent frameworks**
  - A minimal agent function (`summarize`) wrapped with CommandLayer.
- `examples/openai-tool-wrapper.ts` — **Tool/function calling**
  - A fake OpenAI-style tool call (`get_weather`) wrapped as `tool.get_weather`.
- `examples/langchain-wrapper.ts` — **Agent frameworks**
  - A fake LangChain-style `chain.invoke(...)` flow.
- `examples/workflow-job-runner.ts` — **Workflow automation**
  - A Zapier/Make/n8n-style workflow run with steps recorded in output.
- `examples/agent-to-agent-verify.ts` — **Multi-agent systems**
  - Agent A produces a receipt, and Agent B verifies it.
- `examples/existing-agent-integration.ts` — **Existing agent integration**
  - Keep your current agent implementation and wrap only the execution boundary.

## Run

After building:

- `npm run example:basic`
- `npm run example:tool`
- `npm run example:langchain`
- `npm run example:workflow`
- `npm run example:a2a`
- `npm run example:existing`


## Receipt shape

```json
{
  "signer": "exampleagent.eth",
  "verb": "tool.get_weather",
  "ts": "2026-04-29T14:22:00.000Z",
  "input": {
    "city": "Jacksonville"
  },
  "output": {
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

- `signer` = ENS identity of the agent
- `verb` = action being proven
- `input`/`output` = what was executed
- `metadata.proof.hash_sha256` = canonical receipt hash
- `signature` = Ed25519 signature over the receipt proof

## Common errors

- Missing `CL_PRIVATE_KEY_PEM`
- Missing `CL_KEY_ID`
- Verification returns `INVALID` if receipt input/output is edited after signing
- Network failure when public verifier is unreachable
