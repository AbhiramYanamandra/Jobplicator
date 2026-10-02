import time, uuid, jwt, pytest
from cryptography.hazmat.primitives.asymmetric import ec
from auth import TokenVerifier


def test_real_signed_token_expiry_issuer_audience_and_algorithm(monkeypatch):
    private = ec.generate_private_key(ec.SECP256R1())
    verifier = TokenVerifier("https://example.supabase.co")

    class Key:
        key = private.public_key()

    monkeypatch.setattr(verifier.keys, "get_signing_key_from_jwt", lambda token: Key())
    claims = {
        "sub": str(uuid.uuid4()),
        "aud": "authenticated",
        "iss": "https://example.supabase.co/auth/v1",
        "exp": int(time.time()) + 300,
        "iat": int(time.time()),
        "role": "authenticated",
        "email": "test@example.test",
    }
    token = lambda data: jwt.encode(data, private, algorithm="ES256")
    assert verifier.verify(token(claims)).id == claims["sub"]
    for updates in [
        {"exp": int(time.time()) - 60},
        {"iss": "https://attacker.example/auth/v1"},
        {"aud": "other"},
        {"role": "anon"},
        {"is_anonymous": True},
        {"sub": "not-a-uuid"},
    ]:
        with pytest.raises((jwt.PyJWTError, ValueError)):
            verifier.verify(token({**claims, **updates}))
    forged = jwt.encode(
        claims, "test-only-hmac-key-with-more-than-32-bytes", algorithm="HS256"
    )
    with pytest.raises(jwt.PyJWTError):
        verifier.verify(forged)
