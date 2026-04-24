import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.user import User
from app.schemas.payment_request import (
    PaymentRequestCreate,
    PaymentRequestCreated,
    PaymentRequestDetail,
    PaymentRequestSummary,
)
from app.services import payment_requests as pr_service

router = APIRouter(prefix="/api/payment-requests", tags=["payment-requests"])


def _frontend_base() -> str:
    return os.getenv("FRONTEND_BASE", "http://localhost:5173").rstrip("/")


@router.post("", response_model=PaymentRequestCreated, status_code=status.HTTP_201_CREATED)
def create_payment_request(
    body: PaymentRequestCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PaymentRequestCreated:
    rid, _ = pr_service.create_request(db, user, body)
    share = f"{_frontend_base()}/requests/{rid}"
    return PaymentRequestCreated(id=rid, share_url=share)


@router.get("/sent", response_model=list[PaymentRequestSummary])
def list_sent(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: str | None = None,
    q: str | None = None,
):
    return pr_service.list_sent(db, user, status_filter=status, q=q)


@router.get("/received", response_model=list[PaymentRequestSummary])
def list_received(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: str | None = None,
    q: str | None = None,
):
    return pr_service.list_received(db, user, status_filter=status, q=q)


@router.get("/{request_id}", response_model=PaymentRequestDetail)
def get_one(
    request_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PaymentRequestDetail:
    return pr_service.get_request_for_user(db, user, request_id)


@router.post("/{request_id}/pay", response_model=PaymentRequestDetail)
def pay(
    request_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> PaymentRequestDetail:
    return pr_service.pay_request(db, user, request_id, idempotency_key)


@router.post("/{request_id}/decline", response_model=PaymentRequestDetail)
def decline(
    request_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PaymentRequestDetail:
    return pr_service.decline_request(db, user, request_id)


@router.post("/{request_id}/cancel", response_model=PaymentRequestDetail)
def cancel(
    request_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PaymentRequestDetail:
    return pr_service.cancel_request(db, user, request_id)
