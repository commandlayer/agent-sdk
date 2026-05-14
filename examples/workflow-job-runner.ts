import "dotenv/config";
import { CommandLayer } from "../src/index.js";

const privateKeyPem = process.env.CL_PRIVATE_KEY_PEM;
const keyId = process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ";
const agent = process.env.CL_AGENT ?? "runtime.commandlayer.eth";

if (!privateKeyPem) {
  throw new Error("Missing required env var: CL_PRIVATE_KEY_PEM.");
}

const cl = new CommandLayer({ agent, keyId, privateKeyPem });

const result = await cl.wrap("workflow.run", async () => ({
  steps_completed: ["lead_received", "send_followup", "update_crm"],
}));

process.stdout.write(`output: ${JSON.stringify(result.output)}\n`);
process.stdout.write(`receipt: ${JSON.stringify(result.receipt, null, 2)}\n`);

const verification = await cl.verify(result.receipt);
process.stdout.write(`verification_status: ${JSON.stringify(verification)}\n`);
