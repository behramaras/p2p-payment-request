from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PaymentRequest(Base):
    __tablename__ = "payment_requests"
    __table_args__ = (
        Index("ix_payment_requests_sender_status", "sender_user_id", "status"),
        Index("ix_payment_requests_recipient_status", "recipient_email", "status"),
        Index("ix_payment_requests_created_at", "created_at"),
        Index("ix_payment_requests_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(320), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sender: Mapped["User"] = relationship("User", back_populates="requests_sent", foreign_keys=[sender_user_id])
