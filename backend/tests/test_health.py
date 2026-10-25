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
