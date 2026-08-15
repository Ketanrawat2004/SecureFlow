# SECUREFLOW Security & Governance Posture

## 1. Security Overview

SECUREFLOW is architected following **Zero-Trust** and **Principle of Least Privilege** paradigms. Security controls are applied at every layer of the stack:

1. **Authentication & Session Management**:
   - Industry-standard bcrypt password hashing (`bcrypt.hashpw` with salt rounds).
   - Short-lived JWT access tokens (HMAC-SHA256) paired with cryptographically randomized refresh tokens.
   - OIDC / Google OAuth 2.0 PKCE compatibility.
2. **Authorization Boundary**:
   - Frontend UI permission gates (`<Can />`) enhance user experience by hiding unauthorized actions.
   - All backend API endpoints strictly enforce permissions at the route layer via FastAPI dependency injection (`require_permission(...)`).
3. **Sliding Window API Rate Limiting**:
   - Redis-backed sliding window rate limiter (default: 120 requests/minute per client).
   - Resilient in-memory fallback protects against DDoS attacks even in standalone deployments.
4. **Immutable Audit Trails**:
   - Every state-altering action automatically generates an audit log record with actor email, resource identifier, structured JSON context, client IP, and UTC timestamp.
5. **Container Sandboxing & Least Privilege**:
   - Non-root user execution inside Docker containers (`adduser --disabled-password secureflow`).
   - Multi-stage minimal footprint build stripping compiler toolchains from production images.
6. **Data Protection at Rest & in Transit**:
   - All database columns containing sensitive credentials use parameterized queries via SQLAlchemy Async Engine (immune to SQL injection).
   - TLS/HTTPS encryption enforced in transit via Nginx reverse proxy and AWS Application Load Balancers.
