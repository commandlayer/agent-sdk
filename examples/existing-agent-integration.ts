import { CommandLayer } from "../src/index.js";

const privateKeyPem = process.env.CL_PRIVATE_KEY_PEM;
const keyId = process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ";
const agent = process.env.CL_AGENT ?? "runtime.commandlayer.eth";

if (!privateKeyPem) {
  throw new Error("Missing required env var: CL_PRIVATE_KEY_PEM.");
}

const existingAgent = {
  async run(input: { task: string; context: string }) {
    return {
      answer: `Handled task: ${input.task}`,
      context_used: input.context,
    };
  },
};

const cl = new CommandLayer({ agent, keyId, privateKeyPem });

const input = {
  task: "generate a one-line status update",
  context: "release build green",
};

console.log("Already have an agent? Wrap the action, don't rewrite the agent.");

const result = await cl.wrap("agent.execute", {
  input,
  run: () => existingAgent.run(input),
});

const verification = await cl.verify(result.receipt);

console.log("output", result.output);
console.log("receipt", JSON.stringify(result.receipt, null, 2));
console.log("verification_status", verification);
