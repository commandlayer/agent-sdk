import { CommandLayer } from "../src/index.js";

const privateKeyPem = process.env.CL_PRIVATE_KEY_PEM;
const keyId = process.env.CL_KEY_ID;
const agent = process.env.CL_AGENT ?? "exampleagent.eth";

if (!privateKeyPem || !keyId) {
  throw new Error("Missing required env vars: CL_PRIVATE_KEY_PEM and CL_KEY_ID.");
}

const cl = new CommandLayer({ agent, keyId, privateKeyPem });

const result = await cl.wrap("agent.execute", async () => ({ result: "task complete" }));

const verification = await cl.verify(result.receipt);

console.log("receipt", JSON.stringify(result.receipt, null, 2));
console.log("Agent B verified Agent A receipt: VERIFIED");
console.log("verification", verification);
