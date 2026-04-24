import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_STATUS = Literal["pending", "paid", "declined", "expired", "cancelled"]

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class PaymentRequestCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    recipient_email: str = Field(..., max_length=320)
    amount_cents: int = Field(..., gt=0)
    note: str | None = Field(None, max_length=500)

    @field_validator("recipient_email")
    @classmethod
    def email_shape(cls, v: str) -> str:
        if not _EMAIL_RE.match(v.strip().lower()):
            raise ValueError("Invalid email format")
        return v


class PaymentRequestSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    counterparty_email: str
    amount_cents: int
    status: str
    created_at: datetime
    expires_at: datetime


class PaymentRequestDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    counterparty_email: str
    amount_cents: int
    status: str
    created_at: datetime
    expires_at: datetime
    note: str | None
    sender_email: str
    recipient_email: str
    paid_at: datetime | None
    declined_at: datetime | None
    cancelled_at: datetime | None
    seconds_until_expiry: int | None = None


class PaymentRequestCreated(BaseModel):
    id: uuid.UUID
    share_url: str
