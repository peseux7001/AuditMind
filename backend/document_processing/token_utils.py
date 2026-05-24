"""Submission-link token helpers.

Raw customer link tokens are shown only in outbound URLs. The database stores
only SHA-256 token hashes so a DB leak does not expose usable customer links.
"""

from __future__ import annotations

import hashlib
import secrets


DEFAULT_TOKEN_BYTES = 32


def generate_submission_token(token_bytes: int = DEFAULT_TOKEN_BYTES) -> str:
    """Return a long URL-safe token for a customer submission link."""

    if token_bytes < 24:
        raise ValueError("Submission tokens must be at least 24 random bytes.")
    return secrets.token_urlsafe(token_bytes)


def hash_submission_token(raw_token: str) -> str:
    """Return the database-safe SHA-256 hash for a raw URL token."""

    token = str(raw_token or "").strip()
    if not token:
        raise ValueError("Submission token cannot be empty.")
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
