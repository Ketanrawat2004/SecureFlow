# SECUREFLOW Deployment & Infrastructure Operations

## 1. Local Development Quickstart

### Prerequisites
- Python 3.13+
- Node.js 20+ & npm
- Docker & Docker Compose (Optional for containerized run)

### Step-by-Step Local Setup

1. **Clone and Configure Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Run Backend**:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

3. **Run Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open browser at `http://localhost:3000`.

---

## 2. Docker Compose Deployment (Single Node)

To start the entire platform (Postgres, Redis, Kafka, Backend, Frontend, and 3 Event Workers) in one command:

```bash
docker-compose up --build -d
```

- **Frontend Application**: `http://localhost:3000`
- **Backend OpenAPI Docs**: `http://localhost:8000/docs`
- **Health Check Probe**: `http://localhost:8000/health`

To stop all containers:
```bash
docker-compose down
```

---

## 3. Production AWS Deployment via Terraform

The `terraform/` directory contains production-ready modules for AWS:

```bash
cd terraform/environments/prod
terraform init
terraform plan
terraform apply
```

This provisions:
- Multi-AZ VPC with public and private subnets (`10.0.0.0/16`)
- Multi-AZ RDS PostgreSQL 16 instance with automated snapshots and encryption
- ECS Fargate Cluster with container insights enabled
- IAM roles with least-privilege policies
