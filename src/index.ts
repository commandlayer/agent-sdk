import { createReceipt, type Receipt } from "./receipt.js";
import type { JsonValue } from "./canonicalize.js";

export { canonicalize } from "./canonicalize.js";
export { createReceipt, canonicalPayloadFromReceiptInput, type Receipt } from "./receipt.js";

export interface CommandLayerConfig {
  signer: string;
  keyId: string;
  canonicalization: string;
  privateKeyPem?: string;
  verifierUrl?: string;
}

export interface WrapParams<TOutput> {
  input: unknown;
  run: () => Promise<TOutput>;
}

export interface WrapResult<TOutput> {
  output: TOutput;
  receipt: Receipt;
}

export class CommandLayer {
  constructor(private readonly config: CommandLayerConfig) {}

  async wrap<TOutput extends JsonValue>(
    verb: string,
    params: { input: JsonValue; run: () => Promise<TOutput> },
  ): Promise<Receipt> {
    if (!this.config.privateKeyPem) {
      throw new Error("CommandLayer privateKeyPem is required for signing");
    }

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    try {
      const output = await params.run();
      const duration = Date.now() - started;

      const receipt = await createReceipt({
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

      return { output, receipt };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const receipt = await createReceipt({
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
            duration_ms: Date.now() - startedMs,
            started_at: startedAt,
            completed_at: completedAt,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });

      return { output: undefined as TOutput, receipt };
    }
  }

  async verify(receipt: Receipt): Promise<unknown> {
    if (!this.config.verifierUrl) {
      throw new Error("CommandLayer verifierUrl is required for verify");
    }

    const response = await fetch(this.config.verifierUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(receipt),
    });

    if (!response.ok) {
      throw new Error(`Verification request failed: ${response.status}`);
    }

    return response.json();
  }
}
