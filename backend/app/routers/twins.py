from fastapi import APIRouter

from app.models import TwinsResult
from app.routers.chats import get_stored_chat
from app.twins import find_twins

router = APIRouter(prefix="/chats/{chat_id}/twins")


@router.get("", response_model=TwinsResult)
def get_twins(chat_id: str) -> TwinsResult:
    return find_twins(get_stored_chat(chat_id))
