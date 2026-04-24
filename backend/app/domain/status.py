from fastapi import HTTPException, status

PENDING = "pending"
PAID = "paid"
DECLINED = "declined"
EXPIRED = "expired"
CANCELLED = "cancelled"

ALLOWED_FROM_PENDING = frozenset({PAID, DECLINED, EXPIRED, CANCELLED})


def assert_pending_for_mutation(current: str) -> None:
    if current != PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_status", "message": "Request is not pending."},
        )
