import { createReceipt, type Receipt } from "./receipt.js";
import type { JsonValue } from "./canonicalize.js";

export { canonicalize } from "./canonicalize.js";
export { createReceipt, canonicalPayloadFromReceiptInput, type Receipt } from "./receipt.js";

export class CommandLayer {
  constructor(
    private readonly config: {
      signer: string;
      keyId: string;
      canonicalization: string;
      privateKeyPem?: string;
    },
  ) {}

  async wrap<TOutput extends JsonValue>(
    verb: string,
    params: { input: JsonValue; run: () => Promise<TOutput> },
  ): Promise<Receipt> {
    if (!this.config.privateKeyPem) {
      throw new Error("CommandLayer privateKeyPem is required for signing");
    }

    const started = Date.now();

    try {
      const output = await params.run();
      const duration = Date.now() - started;

      return createReceipt({
        keyId: this.config.keyId,
        privateKeyPem: this.config.privateKeyPem,
        canonicalization: this.config.canonicalization,
        input: {
          signer: this.config.signer,
          verb,
          ts: new Date().toISOString(),
          input: params.input,
          output,
          execution: { status: "ok", duration_ms: duration },
        },
      });
    } catch (error) {
      const duration = Date.now() - started;
      return createReceipt({
        keyId: this.config.keyId,
        privateKeyPem: this.config.privateKeyPem,
        canonicalization: this.config.canonicalization,
        input: {
          signer: this.config.signer,
          verb,
          ts: new Date().toISOString(),
          input: params.input,
          output: { ok: false, error: "agent_error" },
          execution: {
            status: "error",
            duration_ms: duration,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });
    }
  }
}
