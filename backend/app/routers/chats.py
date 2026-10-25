import hashlib
from collections import Counter

from fastapi import APIRouter, UploadFile
from fastapi.concurrency import run_in_threadpool

from app import config, store
from app.errors import ApiError
from app.models import Author, Chat, Period
from app.telegram import InvalidExport, ParsedChat, parse_export

router = APIRouter(prefix="/chats")


@router.post("", status_code=201, response_model=Chat)
async def upload_chat(file: UploadFile) -> Chat:
    raw = await file.read(config.MAX_UPLOAD_BYTES + 1)
    if len(raw) > config.MAX_UPLOAD_BYTES:
        limit_mb = config.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ApiError(413, "file_too_large", f"Файл больше {limit_mb} МБ")
    try:
        # разбор 50 МБ — около секунды; в потоке, чтобы не держать остальные запросы
        parsed = await run_in_threadpool(parse_export, raw)
    except InvalidExport as exc:
        raise ApiError(400, "invalid_export", str(exc)) from exc

    # id из содержимого: тот же файл после перезапуска бэкенда получит тот же id
    chat_id = "c_" + hashlib.sha1(raw).hexdigest()[:16]
    chat = _build_chat(chat_id, parsed)
    store.save(store.StoredChat(chat=chat, messages=parsed.messages))
    return chat


@router.get("/{chat_id}", response_model=Chat)
def get_chat(chat_id: str) -> Chat:
    return get_stored_chat(chat_id).chat


def get_stored_chat(chat_id: str) -> store.StoredChat:
    stored = store.get(chat_id)
    if stored is None:
        raise ApiError(404, "not_found", "Чат не найден — загрузи файл заново")
    return stored


def _build_chat(chat_id: str, parsed: ParsedChat) -> Chat:
    counts = Counter(m.author_id for m in parsed.messages)
    # Для надёжности анализа считаем только то, что автор написал сам
    style_counts = Counter(m.author_id for m in parsed.messages if m.has_style)
    # Сообщения отсортированы по времени, так что берём последнее имя автора
    names = {m.author_id: m.author_name for m in parsed.messages}
    authors = [
        Author(
            id=author_id,
            name=names[author_id],
            message_count=count,
            enough_data=style_counts[author_id] >= config.MIN_MESSAGES,
        )
        for author_id, count in counts.most_common()
    ]
    return Chat(
        id=chat_id,
        title=parsed.title,
        kind=parsed.kind,
        message_count=len(parsed.messages),
        period=Period(from_=parsed.messages[0].sent_at, to=parsed.messages[-1].sent_at),
        authors=authors,
    )
