from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config, llm
from app.errors import register_error_handlers
from app.routers import authors, chats, compare, twins

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
    return {"status": "ok", "llm": llm.available()}


api.include_router(chats.router)
api.include_router(authors.router)
api.include_router(twins.router)
api.include_router(compare.router)
app.include_router(api)
