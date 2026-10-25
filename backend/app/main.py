from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.errors import register_error_handlers

app = FastAPI(title="Это точно Саша?")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

api = APIRouter(prefix="/api")


@api.get("/health")
def health() -> dict:
    # LLM подключим в #9, пока всегда false
    return {"status": "ok", "llm": False}


app.include_router(api)
