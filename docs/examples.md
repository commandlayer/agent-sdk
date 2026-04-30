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

## Run

After building:

- `npm run example:basic`
- `npm run example:tool`
- `npm run example:langchain`
- `npm run example:workflow`
- `npm run example:a2a`
