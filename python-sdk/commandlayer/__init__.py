"""CommandLayer Python SDK.

Provides wrap() for signing agent action receipts with Ed25519,
and verify() for validating receipts against the CommandLayer verifier.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        PublicFormat,
        load_pem_private_key,
    )
    import base64
    _CRYPTO_AVAILABLE = True
except ImportError as _crypto_import_err:  # pragma: no cover
    _CRYPTO_AVAILABLE = False
    _crypto_import_err_msg = str(_crypto_import_err)

T = TypeVar("T")

DEFAULT_VERIFIER_URL = "https://runtime.commandlayer.org/verify"
TRUST_FAMILY = "trust-verification"
TRUST_VERSION = "1.0.0"


def _canonicalize(value: Any) -> str:  # noqa: ANN401
    """Serialize value to canonical JSON with sorted keys, recursively."""
    if isinstance(value, dict):
        return "{" + ",".join(
            f'{json.dumps(k)}:{_canonicalize(value[k])}'
            for k in sorted(value.keys())
        ) + "}"
    if isinstance(value, list):
        return "[" + ",".join(_canonicalize(v) for v in value) + "]"
    return json.dumps(value)


def _load_private_key(pem: str) -> "Ed25519PrivateKey":
    if not _CRYPTO_AVAILABLE:
        raise RuntimeError(
            "cryptography package is required for signing. "
            "Install it with: pip install cryptography"
        )
    key = load_pem_private_key(pem.encode(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise ValueError("Only Ed25519 private keys are supported")
    return key


def _sign_ed25519_base64(private_key: "Ed25519PrivateKey", message: str) -> str:
    signature = private_key.sign(message.encode())
    return base64.b64encode(signature).decode()


class CommandLayer:
    """Signs and verifies CommandLayer agent action receipts."""

    def __init__(
        self,
        *,
        signer: str | None = None,
        agent: str | None = None,
        key_id: str,
        private_key_pem: str,
        canonicalization: str = "json.sorted_keys.v1",
        verifier_url: str = DEFAULT_VERIFIER_URL,
    ) -> None:
        resolved_signer = agent or signer
        if not resolved_signer:
            raise ValueError("signer or agent is required")
        if not private_key_pem:
            raise ValueError("private_key_pem is required")
        if not key_id:
            raise ValueError("key_id is required")

        self._signer = resolved_signer
        self._key_id = key_id
        self._private_key_pem = private_key_pem
        self._canonicalization = canonicalization
        self.verifier_url = verifier_url

    def wrap(self, verb: str, fn: Callable[[], T], *, input: Any = None) -> dict[str, Any]:  # noqa: ANN401
        """Execute fn, record execution metadata, sign, and return {output, receipt}."""
        input_payload: Any = input if input is not None else {}
        started_at = datetime.now(timezone.utc).isoformat()
        started_ms = time.monotonic_ns() // 1_000_000

        try:
            output = fn()
            completed_at = datetime.now(timezone.utc).isoformat()
            duration_ms = (time.monotonic_ns() // 1_000_000) - started_ms

            receipt = self._build_receipt(
                verb=verb,
                input_payload=input_payload,
                output=output,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                status="ok",
            )
            return {"output": output, "receipt": receipt}

        except Exception as err:
            completed_at = datetime.now(timezone.utc).isoformat()
            duration_ms = (time.monotonic_ns() // 1_000_000) - started_ms

            receipt = self._build_receipt(
                verb=verb,
                input_payload=input_payload,
                output=None,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                status="error",
                error=str(err),
            )
            return {"output": None, "receipt": receipt}

    def _build_receipt(
        self,
        *,
        verb: str,
        input_payload: Any,  # noqa: ANN401
        output: Any,  # noqa: ANN401
        started_at: str,
        completed_at: str,
        duration_ms: int,
        status: str,
        error: str | None = None,
    ) -> dict[str, Any]:
        execution: dict[str, Any] = {
            "completed_at": completed_at,
            "duration_ms": duration_ms,
            "started_at": started_at,
            "status": status,
        }
        if error is not None:
            execution["error"] = error

        payload: dict[str, Any] = {
            "execution": execution,
            "family": TRUST_FAMILY,
            "input": input_payload,
            "output": output,
            "signer": self._signer,
            "ts": started_at,
            "verb": verb,
            "version": TRUST_VERSION,
        }

        canonical = _canonicalize(payload)
        private_key = _load_private_key(self._private_key_pem)
        signature = _sign_ed25519_base64(private_key, canonical)

        return {
            **payload,
            "proof": {
                "alg": "ed25519",
                "canonical": self._canonicalization,
                "kid": self._key_id,
                "signature": signature,
                "signer_id": self._signer,
            },
        }

    def verify(self, receipt: dict[str, Any]) -> dict[str, Any]:  # noqa: ANN401
        """Post receipt to verifier and return response as dict."""
        body = json.dumps({"receipt": receipt}).encode()
        req = urllib.request.Request(
            self.verifier_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
                return json.loads(resp.read())
        except urllib.error.HTTPError as err:
            snippet = err.read(200).decode(errors="replace")
            raise RuntimeError(
                f"CommandLayer verify failed with status {err.code}: {snippet}"
            ) from err


__all__ = ["CommandLayer", "DEFAULT_VERIFIER_URL", "TRUST_FAMILY", "TRUST_VERSION"]
