from fastapi import APIRouter

from app.models import PairDetails, TwinsResult
from app.pair import pair_details
from app.routers.chats import get_stored_chat
from app.twins import find_twins

router = APIRouter(prefix="/chats/{chat_id}/twins")


@router.get("", response_model=TwinsResult)
def get_twins(chat_id: str) -> TwinsResult:
    return find_twins(get_stored_chat(chat_id))


@router.get("/{a_id}/{b_id}", response_model=PairDetails)
def get_pair(chat_id: str, a_id: str, b_id: str) -> PairDetails:
    return pair_details(get_stored_chat(chat_id), a_id, b_id)
