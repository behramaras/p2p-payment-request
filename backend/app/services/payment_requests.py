from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.domain import status as st
from app.models.payment_idempotency import PaymentIdempotency
from app.models.payment_request import PaymentRequest
from app.models.user import User
from app.schemas.payment_request import PaymentRequestCreate, PaymentRequestDetail, PaymentRequestSummary
from app.services.email_normalize import normalize_email
from app.services.expiration import as_utc_aware, expire_pending_if_due, utc_now


def _detail_from_row(
    row: PaymentRequest,
    viewer: User,
    *,
    seconds_until_expiry: int | None = None,
) -> PaymentRequestDetail:
    is_sender = row.sender_user_id == viewer.id
    counterparty = row.recipient_email if is_sender else row.sender.email_normalized
    return PaymentRequestDetail(
        id=row.id,
        counterparty_email=counterparty,
        amount_cents=row.amount_cents,
        status=row.status,
        created_at=row.created_at,
        expires_at=row.expires_at,
        note=row.note,
        sender_email=row.sender.email_normalized,
        recipient_email=row.recipient_email,
        paid_at=row.paid_at,
        declined_at=row.declined_at,
        cancelled_at=row.cancelled_at,
        seconds_until_expiry=seconds_until_expiry,
    )


def create_request(session: Session, sender: User, body: PaymentRequestCreate) -> tuple[uuid.UUID, str]:
    recipient = normalize_email(body.recipient_email)
    if recipient == sender.email_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "self_request", "message": "Cannot request money from yourself."},
        )
    now = utc_now()
    expires = now + timedelta(days=7)
    pr = PaymentRequest(
        sender_user_id=sender.id,
        recipient_email=recipient,
        amount_cents=body.amount_cents,
        note=body.note,
        status=st.PENDING,
        created_at=now,
        expires_at=expires,
    )
    session.add(pr)
    session.flush()
    return pr.id, str(pr.id)


def list_sent(session: Session, user: User, *, status_filter: str | None, q: str | None) -> list[PaymentRequestSummary]:
    stmt = (
        select(PaymentRequest)
        .options(joinedload(PaymentRequest.sender))
        .where(PaymentRequest.sender_user_id == user.id)
    )
    if status_filter:
        stmt = stmt.where(PaymentRequest.status == status_filter)
    if q:
        nq = normalize_email(q)
        stmt = stmt.where(PaymentRequest.recipient_email.contains(nq))
    rows = list(session.scalars(stmt).unique().all())
    out: list[PaymentRequestSummary] = []
    for row in rows:
        expire_pending_if_due(session, row)
        session.refresh(row)
        out.append(
            PaymentRequestSummary(
                id=row.id,
                counterparty_email=row.recipient_email,
                amount_cents=row.amount_cents,
                status=row.status,
                created_at=row.created_at,
                expires_at=row.expires_at,
            )
        )
    return out


def list_received(session: Session, user: User, *, status_filter: str | None, q: str | None) -> list[PaymentRequestSummary]:
    stmt = (
        select(PaymentRequest)
        .options(joinedload(PaymentRequest.sender))
        .join(User, PaymentRequest.sender_user_id == User.id)
        .where(PaymentRequest.recipient_email == user.email_normalized)
    )
    if status_filter:
        stmt = stmt.where(PaymentRequest.status == status_filter)
    if q:
        nq = normalize_email(q)
        stmt = stmt.where(User.email_normalized.contains(nq))
    rows = list(session.scalars(stmt).unique().all())
    out: list[PaymentRequestSummary] = []
    for row in rows:
        expire_pending_if_due(session, row)
        session.refresh(row)
        out.append(
            PaymentRequestSummary(
                id=row.id,
                counterparty_email=row.sender.email_normalized,
                amount_cents=row.amount_cents,
                status=row.status,
                created_at=row.created_at,
                expires_at=row.expires_at,
            )
        )
    return out


def get_request_for_user(session: Session, user: User, request_id: uuid.UUID) -> PaymentRequestDetail:
    row = session.scalar(
        select(PaymentRequest)
        .options(joinedload(PaymentRequest.sender))
        .where(PaymentRequest.id == request_id)
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if row.sender_user_id != user.id and row.recipient_email != user.email_normalized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    expire_pending_if_due(session, row)
    session.refresh(row)
    sec: int | None = None
    exp = as_utc_aware(row.expires_at)
    if row.status == st.PENDING and exp > utc_now():
        sec = max(0, int(math.ceil((exp - utc_now()).total_seconds())))
    return _detail_from_row(row, user, seconds_until_expiry=sec)


def decline_request(session: Session, user: User, request_id: uuid.UUID) -> PaymentRequestDetail:
    row = session.scalar(
        select(PaymentRequest)
        .options(joinedload(PaymentRequest.sender))
        .where(PaymentRequest.id == request_id)
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if row.recipient_email != user.email_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "forbidden_role", "message": "Only the recipient can decline."},
        )
    expire_pending_if_due(session, row)
    session.refresh(row)
    if row.status == st.EXPIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired", "message": "Request has expired."},
        )
    st.assert_pending_for_mutation(row.status)
    if as_utc_aware(row.expires_at) <= utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired", "message": "Request has expired."},
        )
    res = session.execute(
        update(PaymentRequest)
        .where(
            PaymentRequest.id == request_id,
            PaymentRequest.status == st.PENDING,
            PaymentRequest.recipient_email == user.email_normalized,
        )
        .values(status=st.DECLINED, declined_at=utc_now())
    )
    if res.rowcount != 1:
        session.refresh(row)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_transition", "message": "Could not decline request."},
        )
    session.refresh(row)
    return _detail_from_row(row, user)


def cancel_request(session: Session, user: User, request_id: uuid.UUID) -> PaymentRequestDetail:
    row = session.scalar(
        select(PaymentRequest)
        .options(joinedload(PaymentRequest.sender))
        .where(PaymentRequest.id == request_id)
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if row.sender_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "forbidden_role", "message": "Only the sender can cancel."},
        )
    expire_pending_if_due(session, row)
    session.refresh(row)
    if row.status == st.EXPIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired", "message": "Request has expired."},
        )
    st.assert_pending_for_mutation(row.status)
    if as_utc_aware(row.expires_at) <= utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired", "message": "Request has expired."},
        )
    res = session.execute(
        update(PaymentRequest)
        .where(
            PaymentRequest.id == request_id,
            PaymentRequest.status == st.PENDING,
            PaymentRequest.sender_user_id == user.id,
        )
        .values(status=st.CANCELLED, cancelled_at=utc_now())
    )
    if res.rowcount != 1:
        session.refresh(row)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_transition", "message": "Could not cancel request."},
        )
    session.refresh(row)
    return _detail_from_row(row, user)


def pay_request(
    session: Session,
    user: User,
    request_id: uuid.UUID,
    idempotency_key: str | None,
) -> PaymentRequestDetail:
    row = session.scalar(
        select(PaymentRequest)
        .options(joinedload(PaymentRequest.sender))
        .where(PaymentRequest.id == request_id)
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if row.recipient_email != user.email_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "forbidden_role", "message": "Only the recipient can pay."},
        )

    if idempotency_key:
        existing = session.scalar(
            select(PaymentIdempotency).where(
                PaymentIdempotency.request_id == request_id,
                PaymentIdempotency.client_key == idempotency_key[:128],
            )
        )
        if existing is not None:
            return get_request_for_user(session, user, request_id)

    expire_pending_if_due(session, row)
    session.refresh(row)

    if row.status == st.PAID:
        return get_request_for_user(session, user, request_id)

    if row.status == st.EXPIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired", "message": "Request has expired."},
        )

    st.assert_pending_for_mutation(row.status)
    if as_utc_aware(row.expires_at) <= utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired", "message": "Request has expired."},
        )

    now = utc_now()
    now_naive = now.replace(tzinfo=None)
    res = session.execute(
        update(PaymentRequest)
        .where(
            PaymentRequest.id == request_id,
            PaymentRequest.status == st.PENDING,
            PaymentRequest.recipient_email == user.email_normalized,
            PaymentRequest.expires_at > now_naive,
        )
        .values(status=st.PAID, paid_at=now)
    )
    if res.rowcount != 1:
        session.refresh(row)
        if row.status == st.PAID:
            return get_request_for_user(session, user, request_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "concurrent_transition", "message": "Payment could not be completed."},
        )

    if idempotency_key:
        with session.begin_nested():
            try:
                session.add(
                    PaymentIdempotency(
                        request_id=request_id,
                        client_key=idempotency_key[:128],
                        created_at=now,
                    )
                )
                session.flush()
            except IntegrityError:
                pass
    session.flush()
    return get_request_for_user(session, user, request_id)
