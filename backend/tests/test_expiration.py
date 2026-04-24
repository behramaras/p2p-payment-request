from datetime import timedelta

from app.domain import status as st
from app.models.payment_request import PaymentRequest
from app.models.user import User
from app.services.expiration import expire_pending_if_due, utc_now


def test_expire_pending_if_due(db_session):
    u = User(email_normalized="a@test.dev")
    db_session.add(u)
    db_session.flush()
    past = utc_now() - timedelta(days=1)
    pr = PaymentRequest(
        sender_user_id=u.id,
        recipient_email="b@test.dev",
        amount_cents=100,
        status=st.PENDING,
        created_at=past,
        expires_at=past,
        note=None,
    )
    db_session.add(pr)
    db_session.commit()
    db_session.refresh(pr)
    expire_pending_if_due(db_session, pr)
    db_session.commit()
    db_session.refresh(pr)
    assert pr.status == st.EXPIRED
