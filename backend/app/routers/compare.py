from fastapi import APIRouter

from app.compare import compare_chats
from app.errors import ApiError
from app.models import Comparison
from app.routers.chats import get_stored_chat

router = APIRouter(prefix="/compare")


@router.get("", response_model=Comparison)
def compare(a: str, b: str) -> Comparison:
    if a == b:
        raise ApiError(422, "validation", "Нужны два разных чата")
    return compare_chats(get_stored_chat(a), get_stored_chat(b))
