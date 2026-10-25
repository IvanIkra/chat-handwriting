from fastapi import APIRouter

from app import llm
from app.check import check_message
from app.errors import ApiError
from app.models import Author, CheckRequest, CheckResult, StyleProfile
from app.profile import build_profile
from app.routers.chats import get_stored_chat
from app.store import StoredChat

router = APIRouter(prefix="/chats/{chat_id}/authors")


@router.get("/{author_id}/profile", response_model=StyleProfile)
def get_profile(chat_id: str, author_id: str) -> StyleProfile:
    stored = get_stored_chat(chat_id)
    return build_profile(stored, get_author(stored, author_id))


@router.post("/{author_id}/check", response_model=CheckResult)
def check(chat_id: str, author_id: str, body: CheckRequest) -> CheckResult:
    stored = get_stored_chat(chat_id)
    author = get_author(stored, author_id)
    result = check_message(stored, author, body.text, body.sent_at)
    return llm.add_check_texts(stored, author, body.text, result)


def get_author(stored: StoredChat, author_id: str) -> Author:
    author = next((a for a in stored.chat.authors if a.id == author_id), None)
    if author is None:
        raise ApiError(404, "not_found", "В этом чате нет такого автора")
    return author
