import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test health check returns healthy status."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_dev_login(client: AsyncClient):
    """Test dev login endpoint for role switcher."""
    response = await client.post("/api/v1/auth/dev-login", json={"role": "Owner"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    """Test login with incorrect password fails with 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "sarah.chen@acmecloud.io", "password": "WrongPassword123!"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_valid_credentials(client: AsyncClient):
    """Test login with valid seeded credentials."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "sarah.chen@acmecloud.io", "password": "SecureFlow2026!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_auth_me(client: AsyncClient, auth_headers):
    """Test /auth/me returns current user context with role and permissions."""
    headers = auth_headers("u-owner-001")
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "sarah.chen@acmecloud.io"
    assert data["active_role"] == "Owner"
    assert "workflow.approve" in data["permissions"]


@pytest.mark.asyncio
async def test_google_oauth_endpoints(client: AsyncClient, monkeypatch):
    """Test Google OAuth URL generation and OIDC callback exchange.

    Forces sandbox mode via monkeypatching so this test is environment-independent
    and never attempts a real network call to accounts.google.com.
    """
    from app.core import config as cfg

    # Force sandbox mode regardless of real env vars set in Docker
    monkeypatch.setattr(cfg.settings, "GOOGLE_CLIENT_ID", "mock-google-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(cfg.settings, "GOOGLE_CLIENT_SECRET", "mock-google-client-secret")

    # 1. URL generation — endpoint must return 200 and a Google auth URL
    url_resp = await client.get("/api/v1/auth/google/url")
    assert url_resp.status_code == 200
    url_data = url_resp.json()
    assert "accounts.google.com" in url_data["url"]
    assert "client_id" in url_data

    # 2. Callback exchange — sandbox mode resolves code without calling Google
    cb_resp = await client.post(
        "/api/v1/auth/google/callback",
        json={"code": "sample_auth_code_test", "state": "secureflow-oauth-state"},
    )
    assert cb_resp.status_code == 200
    cb_data = cb_resp.json()
    assert "access_token" in cb_data
    assert cb_data["token_type"] == "bearer"
