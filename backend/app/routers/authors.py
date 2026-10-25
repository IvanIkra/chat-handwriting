from fastapi import APIRouter

from app.errors import ApiError
from app.models import Author, StyleProfile
from app.profile import build_profile
from app.routers.chats import get_stored_chat
from app.store import StoredChat

router = APIRouter(prefix="/chats/{chat_id}/authors")


@router.get("/{author_id}/profile", response_model=StyleProfile)
def get_profile(chat_id: str, author_id: str) -> StyleProfile:
    stored = get_stored_chat(chat_id)
    return build_profile(stored, get_author(stored, author_id))


def get_author(stored: StoredChat, author_id: str) -> Author:
    author = next((a for a in stored.chat.authors if a.id == author_id), None)
    if author is None:
        raise ApiError(404, "not_found", "В этом чате нет такого автора")
    return author
