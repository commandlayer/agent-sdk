# CommandLayer Python SDK

Signs and verifies CommandLayer agent action receipts using Ed25519.

## Install

```bash
pip install commandlayer-agent-sdk[crypto]
```

The `[crypto]` extra installs the `cryptography` package required for Ed25519 signing.

## Quickstart

```python
import os
from commandlayer import CommandLayer

cl = CommandLayer(
    signer=os.environ["CL_AGENT"],
    key_id=os.environ["CL_KEY_ID"],
    private_key_pem=os.environ["CL_PRIVATE_KEY_PEM"],
)

result = cl.wrap("verify", lambda: {"approved": True}, input={"challenge": "abc"})
print(result["output"])
print(result["receipt"])

verification = cl.verify(result["receipt"])
print(verification)
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `CL_AGENT` | ENS name of the signing agent |
| `CL_KEY_ID` | Key identifier |
| `CL_PRIVATE_KEY_PEM` | PKCS8-encoded Ed25519 private key |
| `CL_VERIFIER_URL` | Override the verifier endpoint (optional) |

## API

### `CommandLayer(*, signer, key_id, private_key_pem, [canonicalization], [verifier_url])`

Constructor. `agent` is accepted as an alias for `signer`.

### `cl.wrap(verb, fn, *, input=None) -> dict`

Executes `fn()`, records execution metadata, signs the receipt with Ed25519, and returns `{"output": ..., "receipt": ...}`.

If `fn()` raises, the error is recorded in `receipt.execution.error` and `status` is set to `"error"`.

### `cl.verify(receipt) -> dict`

POSTs the receipt to the configured verifier URL and returns the parsed JSON response.

## Receipt proof schema

```json
{
  "proof": {
    "alg": "ed25519",
    "canonical": "json.sorted_keys.v1",
    "kid": "<key-id>",
    "signature": "<base64>",
    "signer_id": "<ens-name>"
  }
}
```

## License

MIT
