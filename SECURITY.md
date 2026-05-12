# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✓         |

## Reporting a Vulnerability

Please report security vulnerabilities to **security@commandlayer.org**. Do not open a public GitHub issue for security reports.

You will receive a response within 48 hours. If the issue is confirmed we will release a patch as soon as possible and credit the reporter.

## Signing Protocol

This SDK signs receipts using **Ed25519** over the raw UTF-8 bytes of the canonicalized JSON payload:

```
signature = Ed25519.sign(privateKey, UTF8(canonicalize(payload)))
```

Canonicalization uses recursive sorted-key JSON serialization (`json.sorted_keys.v1`), producing a deterministic UTF-8 string. The signature is over those bytes directly — no intermediate hash.

This is specified in the [CommandLayer Protocol](https://commandlayer.org/protocol).

## Known Limitations

**No key revocation.** Historical receipts signed with a compromised Ed25519 key remain verifiable against that key indefinitely. If a signing key is compromised, treat all receipts signed with it as untrusted from the point of compromise forward. A revocation mechanism (via ENS `cl.sig.expires`) is planned.

**ENS trust model.** The `verifierUrl` endpoint resolves signer public keys via ENS. Verification depends on ENS being accessible and the ENS record being accurate. Consider the ENS trust model before using in high-assurance contexts.

**Node.js-only schema loading.** `validateTrustRequest` / `validateTrustReceipt` use `createRequire` to load JSON schemas, which requires a Node.js runtime. Edge-runtime support (Cloudflare Workers, Deno) is planned once schemas are served from the canonical registry.
