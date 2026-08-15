.PHONY: help setup dev dev-backend dev-frontend test test-backend test-frontend build lint clean docker-up docker-down

help:
	@echo "SECUREFLOW Engineering Command Suite"
	@echo "------------------------------------"
	@echo "make setup          Install all backend and frontend dependencies"
	@echo "make dev            Run backend and frontend dev servers concurrently"
	@echo "make dev-backend    Run FastAPI uvicorn backend with reload"
	@echo "make dev-frontend   Run Vite React frontend dev server"
	@echo "make test           Run full backend and frontend test suites"
	@echo "make test-backend   Run Pytest unit and integration tests"
	@echo "make test-frontend  Run Vitest component tests"
	@echo "make build          Compile frontend production build and typecheck"
	@echo "make docker-up      Start all services with Docker Compose"
	@echo "make docker-down    Stop all Docker Compose services"
	@echo "make clean          Clean temporary caches and artifacts"

setup:
	@echo "Setting up Python virtual environment..."
	python -m venv backend/.venv
	backend/.venv/bin/pip install -r backend/requirements.txt
	@echo "Installing Node dependencies..."
	cd frontend && npm install

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test-backend:
	cd backend && pytest

test-frontend:
	cd frontend && npm test

test: test-backend test-frontend

build:
	cd frontend && npm run build

docker-up:
	docker-compose up --build -d

docker-down:
	docker-compose down

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name "dist" -exec rm -rf {} +
	find . -type d -name "node_modules" -exec rm -rf {} +
