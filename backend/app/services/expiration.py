from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.domain import status as st
from app.models.payment_request import PaymentRequest


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc_aware(dt: datetime) -> datetime:
    """SQLite may return naive datetimes; treat them as UTC wall time."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def expire_pending_if_due(session: Session, row: PaymentRequest) -> None:
    if row.status != st.PENDING:
        return
    now = utc_now()
    if as_utc_aware(row.expires_at) <= now:
        session.execute(
            update(PaymentRequest)
            .where(
                PaymentRequest.id == row.id,
                PaymentRequest.status == st.PENDING,
            )
            .values(status=st.EXPIRED)
        )
        session.flush()
        row.status = st.EXPIRED
