from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "llm": False}


def test_cors_allows_frontend_origin():
    resp = client.get("/api/health", headers={"Origin": config.FRONTEND_ORIGIN})
    assert resp.headers["access-control-allow-origin"] == config.FRONTEND_ORIGIN


def test_unknown_path_returns_contract_error():
    resp = client.get("/api/nope")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_unexpected_error_returns_internal(monkeypatch):
    def boom():
        raise RuntimeError("секретные подробности")

    monkeypatch.setattr("app.main.llm.available", boom)
    # в проде Starlette после ответа пробрасывает исключение в лог — здесь его не ждём
    resp = TestClient(app, raise_server_exceptions=False).get("/api/health")
    assert resp.status_code == 500
    error = resp.json()["error"]
    assert error["code"] == "internal"
    assert "секретные" not in error["message"]


def test_wrong_method_returns_http_error():
    resp = client.put("/api/health")
    assert resp.status_code == 405
    assert resp.json()["error"]["code"] == "http_error"
