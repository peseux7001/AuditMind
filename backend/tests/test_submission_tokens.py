from __future__ import annotations

import re
import unittest

from backend.document_processing.token_utils import generate_submission_token, hash_submission_token


class SubmissionTokenTest(unittest.TestCase):
    def test_generated_token_is_stable_url_safe_secret_material(self) -> None:
        token = generate_submission_token()

        self.assertGreaterEqual(len(token), 32)
        self.assertRegex(token, re.compile(r"^[A-Za-z0-9_-]+$"))

    def test_hash_is_deterministic_and_does_not_reveal_raw_token(self) -> None:
        token = "sample_customer_link_token"
        digest = hash_submission_token(token)

        self.assertEqual(digest, hash_submission_token(token))
        self.assertNotIn(token, digest)
        self.assertEqual(len(digest), 64)

    def test_short_entropy_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            generate_submission_token(8)


if __name__ == "__main__":
    unittest.main()
