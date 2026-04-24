"""E2E-only helpers. Disabled unless E2E_SEED=1."""

import os
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.domain import status as st
from app.models.payment_request import PaymentRequest
from app.models.user import User
from app.services.email_normalize import normalize_email
from app.services.expiration import utc_now

router = APIRouter(prefix="/api/test", tags=["test"])


@router.post("/seed-expired")
def seed_expired(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if os.getenv("E2E_SEED") != "1":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    other = db.scalar(select(User).where(User.id != user.id))
    if other is None:
        o = User(email_normalized="e2e_counterparty@example.test")
        db.add(o)
        db.flush()
        other = o
    now = utc_now()
    pr = PaymentRequest(
        sender_user_id=other.id,
        recipient_email=normalize_email(user.email_normalized),
        amount_cents=100,
        note="seed expired",
        status=st.PENDING,
        created_at=now - timedelta(days=8),
        expires_at=now - timedelta(days=1),
    )
    db.add(pr)
    db.flush()
    return {"id": str(pr.id)}
