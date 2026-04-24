import uuid
from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.domain import status as st
from app.models.payment_request import PaymentRequest
from app.models.user import User
from app.schemas.payment_request import PaymentRequestCreate
from app.services import payment_requests as prs
from app.services.expiration import utc_now


def test_double_pay_idempotent(db_session):
    sender = User(email_normalized="sender@t.dev")
    recipient = User(email_normalized="recipient@t.dev")
    db_session.add_all([sender, recipient])
    db_session.flush()
    now = utc_now()
    pr = PaymentRequest(
        sender_user_id=sender.id,
        recipient_email=recipient.email_normalized,
        amount_cents=500,
        status=st.PENDING,
        created_at=now,
        expires_at=now + timedelta(days=7),
        note=None,
    )
    db_session.add(pr)
    db_session.commit()
    rid = pr.id

    prs.pay_request(db_session, recipient, rid, None)
    db_session.commit()

    out = prs.pay_request(db_session, recipient, rid, None)
    db_session.commit()
    assert out.status == st.PAID

    db_session.refresh(pr)
    assert pr.paid_at is not None


def test_create_rejects_self(db_session):
    u = User(email_normalized="same@t.dev")
    db_session.add(u)
    db_session.commit()
    with pytest.raises(HTTPException):
        prs.create_request(
            db_session,
            u,
            PaymentRequestCreate(recipient_email="same@t.dev", amount_cents=1),
        )
