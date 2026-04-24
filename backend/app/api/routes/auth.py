import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, parse_bearer_token
from app.db import get_db
from app.models.auth_token import AuthToken
from app.models.user import User
from app.schemas.auth import LoginBody, TokenOut, UserOut
from app.services.email_normalize import normalize_email

router = APIRouter(prefix="/api", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/auth/session", response_model=TokenOut)
def login(
    body: LoginBody,
    db: Session = Depends(get_db),
) -> TokenOut:
    raw = body.email.strip()
    if not _EMAIL_RE.match(raw.lower()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email")
    email = normalize_email(raw)
    user = db.scalar(select(User).where(User.email_normalized == email))
    if user is None:
        user = User(email_normalized=email)
        db.add(user)
        db.flush()
    token_str = secrets.token_urlsafe(32)
    db.add(AuthToken(token=token_str, user_id=user.id))
    db.flush()
    return TokenOut(token=token_str)


@router.delete("/auth/session", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: Session = Depends(get_db)) -> Response:
    raw = parse_bearer_token(request.headers.get("Authorization"))
    if raw:
        row = db.scalar(select(AuthToken).where(AuthToken.token == raw))
        if row is not None:
            db.delete(row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email_normalized)
