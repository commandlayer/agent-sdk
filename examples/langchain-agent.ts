import "dotenv/config";
import { CommandLayer } from "../src/index.js";

const chain = {
  async invoke(input: { prompt: string }) {
    return { text: `Mocked response for: ${input.prompt}` };
  },
};

if (!process.env.CL_PRIVATE_KEY_PEM) {
  throw new Error(
    "Missing CL_PRIVATE_KEY_PEM. Copy .env.example to .env and add a PKCS8 Ed25519 private key.",
  );
}

const cl = new CommandLayer({
  agent: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  privateKey: process.env.CL_PRIVATE_KEY_PEM,
});

const input = { prompt: "Summarize how receipts prove agent actions." };

const result = await cl.wrap("chain.invoke", async () => chain.invoke(input));

console.log(JSON.stringify(result.receipt, null, 2));
