import "dotenv/config";
import { CommandLayer } from "../src/index.js";

async function fakeSummarizeAgent(content: string) {
  return { summary: `Summary: ${content.slice(0, 24)}` };
}

if (!process.env.CL_PRIVATE_KEY_PEM) {
  console.error(
    "Missing CL_PRIVATE_KEY_PEM. Copy .env.example to .env and add a PKCS8 Ed25519 private key.",
  );
  process.exit(1);
}

const cl = new CommandLayer({
  signer: process.env.CL_RECEIPT_SIGNER ?? "runtime.commandlayer.eth",
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  canonicalization: process.env.CL_CANONICAL_ID ?? "json.sorted_keys.v1",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
});

const receipt = await cl.wrap("agent.execute", {
  input: { task: "summarize", content: "hello world" },
  run: async () => fakeSummarizeAgent("hello world"),
});

console.log(JSON.stringify(receipt, null, 2));
