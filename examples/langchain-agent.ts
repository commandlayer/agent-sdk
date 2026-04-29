import { CommandLayer } from "../src/index.js";

const chain = {
  async invoke(input: { prompt: string }) {
    return { text: `Mocked response for: ${input.prompt}` };
  },
};

const cl = new CommandLayer({
  signer: process.env.CL_RECEIPT_SIGNER ?? "runtime.commandlayer.eth",
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  canonicalization: process.env.CL_CANONICAL_ID ?? "json.sorted_keys.v1",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
});

const input = { prompt: "Summarize how receipts prove agent actions." };

const receipt = await cl.wrap("chain.invoke", {
  input,
  run: async () => chain.invoke(input),
});

console.log(JSON.stringify(receipt, null, 2));
