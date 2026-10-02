"""Supabase JWT verification and private account allow-list."""

from dataclasses import dataclass
from uuid import UUID
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from db import LOCAL_OWNER, use_repository

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class User:
    id: str
    email: str = ""


class TokenVerifier:
    def __init__(self, supabase_url):
        self.issuer = supabase_url + "/auth/v1"
        self.keys = jwt.PyJWKClient(
            self.issuer + "/.well-known/jwks.json",
            cache_jwk_set=True,
            lifespan=300,
            timeout=10,
        )

    def verify(self, token):
        key = self.keys.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=self.issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
        if claims.get("role") != "authenticated" or claims.get("is_anonymous"):
            raise jwt.InvalidTokenError("An authenticated account is required")
        return User(str(UUID(claims["sub"])), str(claims.get("email", "")))


def current_user(
    request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
):
    settings = request.app.state.settings
    if settings.auth_mode == "local":
        # A second guard prevents accidental public access to local-only mode.
        if request.client and request.client.host not in (
            "127.0.0.1",
            "::1",
            "testclient",
        ):
            raise HTTPException(403, "Local mode only accepts loopback requests")
        return User(LOCAL_OWNER, "local@example.test")
    if credentials is None:
        raise HTTPException(
            401, "Sign in to continue", headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        user = request.app.state.verifier.verify(credentials.credentials)
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            401,
            "Your session is invalid or expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    if settings.allowed_user_ids and user.id not in settings.allowed_user_ids:
        raise HTTPException(403, "This account has not been invited to this workspace")
    return user


async def workspace(request: Request, user: User = Depends(current_user)):
    # This async dependency sets context in the request task. FastAPI propagates
    # it into sync endpoint workers; cleanup runs in the original request task.
    with request.app.state.engine.begin() as connection:
        with use_repository(connection, user.id):
            yield user
