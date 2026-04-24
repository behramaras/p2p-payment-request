import pytest
from fastapi import HTTPException

from app.domain import status as st


def test_assert_pending_for_mutation_ok():
    st.assert_pending_for_mutation(st.PENDING)


def test_assert_pending_for_mutation_bad():
    with pytest.raises(HTTPException):
        st.assert_pending_for_mutation(st.PAID)
