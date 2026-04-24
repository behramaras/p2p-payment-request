from app.services.email_normalize import normalize_email


def test_normalize_email():
    assert normalize_email("  A@Example.COM  ") == "a@example.com"
