"""Настройки из переменных окружения и `.env` в корне репозитория."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or None
