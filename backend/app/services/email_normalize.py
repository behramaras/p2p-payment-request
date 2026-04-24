"""ASCII-oriented email normalization (strip + lower). See specs/001-p2p-payment-request/research.md."""


def normalize_email(s: str) -> str:
    return s.strip().lower()
