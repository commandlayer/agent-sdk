import { createReceipt, type Receipt } from "./receipt.js";
import type { JsonValue } from "./canonicalize.js";

export { canonicalize } from "./canonicalize.js";
export { createReceipt, canonicalPayloadFromReceiptInput, type Receipt } from "./receipt.js";
export {
  createExecutionReceipt,
  signExecutionProof,
  attachSettlementProof,
  signSettlementProof,
  verifyExecutionReceipt,
  assertSafeReceipt,
  EXECUTION_RECEIPT_SCHEMA,
  EXECUTION_PROOF_COVERS,
  SETTLEMENT_PROOF_COVERS,
  type ClasExecutionReceiptV1,
  type ClasExecutionAgent,
  type ClasExecutionAction,
  type ClasExecutionSettlement,
  type ClasScopedProof,
  type ClasExecutionProof,
  type ClasSettlementProof,
  type VerifyScopedExecutionReceiptResult,
  type VerifyScopedProofResult,
} from "./execution-receipt.js";
export { validateTrustRequest, validateTrustReceipt, assertValidTrustRequest, assertValidTrustReceipt, type TrustValidationResult } from "./trust.js";

export interface CommandLayerConfig {
  signer?: string;
  agent?: string;
  keyId: string;
  canonicalization?: string;
  privateKeyPem?: string;
  /** @deprecated Use privateKeyPem instead. */
  privateKey?: string;
  verifierUrl?: string;
}

export const DEFAULT_VERIFIER_URL = "https://runtime.commandlayer.org/verify";
export const DEFAULT_CANONICALIZATION = "json.sorted_keys.v1";

export const TRUST_FAMILY = "trust-verification" as const;
export const TRUST_VERSION = "1.0.0" as const;

export interface WrapOptions<TOutput = unknown> {
  input?: JsonValue;
  run: () => Promise<TOutput>;
}

export interface WrapResult<TOutput = unknown> {
  output: TOutput;
  receipt: Receipt;
}

export interface VerifyResult {
  ok?: boolean;
  status?: string;
  [key: string]: unknown;
}

const TRUST_VERBS = [
  "verify",
  "authenticate",
  "authorize",
  "attest",
  "sign",
  "permit",
  "grant",
  "approve",
  "reject",
  "endorse",
] as const;

export type TrustVerb = (typeof TRUST_VERBS)[number];

const TRUST_VERB_SET: ReadonlySet<string> = new Set(TRUST_VERBS);

export function normalizeTrustVerb(verb: string): string {
  const prefix = `clas.${TRUST_FAMILY}.`;
  return verb.startsWith(prefix) ? verb.slice(prefix.length) : verb;
}

/**
 * Normalize and validate a trust verb. Throws if the resulting short verb is
 * not a member of the schema-defined TRUST_VERBS enum.
 */
function resolveAndValidateTrustVerb(verb: string): string {
  const normalized = normalizeTrustVerb(verb);
  if (!TRUST_VERB_SET.has(normalized)) {
    throw new Error(
      `Invalid trust verb "${verb}". Must be one of: ${TRUST_VERBS.join(", ")}. ` +
      `Fully-qualified names like "clas.trust-verification.verify" are also accepted.`,
    );
  }
  return normalized;
}

export class CommandLayer {
  private readonly config: {
    signer: string;
    privateKeyPem: string;
    keyId: string;
    canonicalization: typeof DEFAULT_CANONICALIZATION;
    verifierUrl: string;
  };

  readonly verifierUrl: string;

  constructor(config: CommandLayerConfig) {
    const signer = config.agent ?? config.signer;
    const privateKeyPem = config.privateKeyPem ?? config.privateKey;

    if (!signer) {
      throw new Error("Missing signer (agent or signer required)");
    }

    if (!privateKeyPem) {
      throw new Error("Missing privateKeyPem (or deprecated privateKey alias)");
    }

    const canonicalization = config.canonicalization ?? DEFAULT_CANONICALIZATION;
    if (canonicalization !== DEFAULT_CANONICALIZATION) {
      throw new Error(
        `Unsupported canonicalization \"${canonicalization}\". Only \"${DEFAULT_CANONICALIZATION}\" is supported.`,
      );
    }

    this.config = {
      ...config,
      signer,
      privateKeyPem,
      canonicalization,
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
    const privateKeyPem = this.config.privateKeyPem;

    if (!privateKeyPem) {
      throw new Error("CommandLayer privateKeyPem is required for signing");
    }

    const signer = this.config.signer;

    if (!signer) {
      throw new Error("CommandLayer agent or signer is required");
    }

    const run =
      typeof fnOrOptions === "function" ? fnOrOptions : fnOrOptions.run;

    const input =
      typeof fnOrOptions === "function" ? {} : fnOrOptions.input ?? {};

    const startedMs = Date.now();
    // Validate verb before running the wrapped function so callers get a
    // synchronous, descriptive error rather than a non-schema-valid receipt.
    const normalizedVerb = resolveAndValidateTrustVerb(verb);
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
          version: TRUST_VERSION,
          family: TRUST_FAMILY,
          signer,
          verb: normalizedVerb,
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
          version: TRUST_VERSION,
          family: TRUST_FAMILY,
          signer,
          verb: normalizedVerb,
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

  async verify(receipt: Receipt): Promise<VerifyResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(this.verifierUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = (await response.text()).slice(0, 200);
        throw new Error(
          `CommandLayer verify failed with status ${response.status}: ${responseText}`,
        );
      }

      return response.json() as Promise<VerifyResult>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
