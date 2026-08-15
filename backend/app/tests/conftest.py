import asyncio
import os
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set environment before loading app
os.environ["ENVIRONMENT"] = "testing"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_RATE_LIMIT_ENABLED"] = "false"
os.environ["KAFKA_ENABLED"] = "false"
os.environ["AUTO_SEED_DATABASE"] = "true"

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.entities import User
from app.services.seed_service import seed_database

# In-memory testing engine
test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
test_session_maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Create a fresh database for each test function."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_maker() as session:
        await seed_database(session)
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    """FastAPI async test client with overridden DB dependency."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """Helper fixture to generate Bearer auth headers for specific user IDs."""
    def _headers(user_id: str, org_id: str = "org-acme-corp"):
        token = create_access_token(user_id)
        return {
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": org_id,
        }
    return _headers
