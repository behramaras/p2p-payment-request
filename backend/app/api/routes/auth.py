import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.auth import LoginBody, UserOut
from app.services.email_normalize import normalize_email

router = APIRouter(prefix="/api", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/auth/session", status_code=status.HTTP_204_NO_CONTENT)
def login(
    request: Request,
    body: LoginBody,
    db: Session = Depends(get_db),
) -> Response:
    raw = body.email.strip()
    if not _EMAIL_RE.match(raw.lower()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email")
    email = normalize_email(raw)
    user = db.scalar(select(User).where(User.email_normalized == email))
    if user is None:
        user = User(email_normalized=email)
        db.add(user)
        db.flush()
    request.session["user_id"] = user.id
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/auth/session", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(request: Request, db: Session = Depends(get_db)) -> UserOut:
    uid = request.session.get("user_id")
    if uid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = db.get(User, int(uid))
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return UserOut(id=user.id, email=user.email_normalized)
