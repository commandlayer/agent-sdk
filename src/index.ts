import { createReceipt, type Receipt } from "./receipt.js";
import type { JsonValue } from "./canonicalize.js";

export { canonicalize } from "./canonicalize.js";
export { createReceipt, canonicalPayloadFromReceiptInput, type Receipt } from "./receipt.js";

export interface CommandLayerConfig {
  signer?: string;
  agent?: string;
  keyId: string;
  canonicalization?: string;
  privateKeyPem?: string;
  privateKey?: string;
  verifierUrl?: string;
}

export const DEFAULT_VERIFIER_URL = "https://www.commandlayer.org/api/verify";

export interface WrapOptions<TOutput = unknown> {
  input?: JsonValue;
  run: () => Promise<TOutput>;
}

export interface WrapResult<TOutput = unknown> {
  output: TOutput;
  receipt: Receipt;
}

export class CommandLayer {
  private readonly config: Required<
    Pick<CommandLayerConfig, "keyId" | "canonicalization" | "verifierUrl">
  > &
    CommandLayerConfig;

  readonly verifierUrl: string;

  constructor(config: CommandLayerConfig) {
    this.config = {
      ...config,
      canonicalization: config.canonicalization ?? "json.sorted_keys.v1",
      verifierUrl: config.verifierUrl ?? DEFAULT_VERIFIER_URL,
    };

    this.verifierUrl = this.config.verifierUrl;
  }

  async wrap<TOutput>(
    verb: string,
    fn: () => Promise<TOutput>,
  ): Promise<WrapResult<TOutput>>;

  async wrap<TOutput>(
    verb: string,
    options: WrapOptions<TOutput>,
  ): Promise<WrapResult<TOutput>>;

  async wrap<TOutput>(
    verb: string,
    fnOrOptions: (() => Promise<TOutput>) | WrapOptions<TOutput>,
  ): Promise<WrapResult<TOutput>> {
    const privateKeyPem = this.config.privateKeyPem ?? this.config.privateKey;

    if (!privateKeyPem) {
      throw new Error("CommandLayer privateKeyPem is required for signing");
    }

    const signer = this.config.agent ?? this.config.signer;

    if (!signer) {
      throw new Error("CommandLayer agent or signer is required");
    }

    const run =
      typeof fnOrOptions === "function" ? fnOrOptions : fnOrOptions.run;

    const input =
      typeof fnOrOptions === "function" ? {} : fnOrOptions.input ?? {};

    const startedMs = Date.now();
    const startedAt = new Date().toISOString();

    try {
      const output = await run();

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;

      const receipt = await createReceipt({
        keyId: this.config.keyId,
        privateKeyPem,
        canonicalization: this.config.canonicalization,
        input: {
          signer,
          verb,
          ts: startedAt,
          input: input as JsonValue,
          output: output as JsonValue,
          execution: {
            status: "ok",
            duration_ms: durationMs,
            started_at: startedAt,
            completed_at: completedAt,
          },
        },
      });

      return { output, receipt };
    } catch (err) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;

      const receipt = await createReceipt({
        keyId: this.config.keyId,
        privateKeyPem,
        canonicalization: this.config.canonicalization,
        input: {
          signer,
          verb,
          ts: startedAt,
          input: input as JsonValue,
          output: null,
          execution: {
            status: "error",
            duration_ms: durationMs,
            started_at: startedAt,
            completed_at: completedAt,
            error: err instanceof Error ? err.message : String(err),
          },
        },
      });

      return {
        output: undefined as unknown as TOutput,
        receipt,
      };
    }
  }

  async verify(receipt: Receipt): Promise<unknown> {
    const response = await fetch(this.config.verifierUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
    });

    return response.json();
  }
}
