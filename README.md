# AI-Based Government Grievance Management System (v2.0)

A full-stack, enterprise-grade AI-assisted public grievance management portal supporting multi-language conversational intake (Anthropic Claude API), httpOnly secure cookie authentication, Redis analytics caching, SLA escalation tracking, role-based admin operations, visual chart dashboards, and Docker containerization.

---

## 🚀 Architecture & Features

```
     ┌─────────────────────────────┐
     │ React Frontend (Port 3000)   │
     └──────────────┬──────────────┘
                    │ (Axios withCredentials: true)
                    ▼
     ┌─────────────────────────────┐      ┌────────────────────────────┐
     │  FastAPI Backend (Port 8000)├─────►│ Anthropic Messages API     │
     └──────┬──────────────┬───────┘      │ (Claude Sonnet 3.5)        │
            │              │              └────────────────────────────┘
            ▼              ▼
 ┌───────────────────┐ ┌───────────────┐
 │ MongoDB Atlas DB  │ │ Redis Cache   │
 │ (Conversations &  │ │ (Analytics    │
 │  Tickets Queue)   │ │  60s TTL)     │
 └───────────────────┘ └───────────────┘
```

### Key Capabilities
1. **Multi-Language Conversational Intake**:
   - Analyzes citizen complaints in native languages (Hindi, Tamil, Marathi, Gujarati, Telugu, Kannada, English, etc.).
   - Multi-turn conversation sessions using `session_id`.
   - Asynchronous calls to Anthropic Claude Messages API.
   - Dynamic follow-up questions when complaint details are ambiguous.
2. **Security & Auth**:
   - `httpOnly`, `SameSite=Lax` secure JWT cookies (`access_token` & `refresh_token`).
   - Token refresh endpoint (`/admin/refresh`).
   - Rate limiting with `slowapi` on public `/chat` endpoint (15 requests/min).
   - Strict Pydantic input validation & length limits.
3. **Role-Based Access Control (RBAC)**:
   - `super_admin`: Full system oversight across all government departments.
   - `department_admin`: Scoped access strictly to tickets assigned to their department (Water, Electricity, Sanitation, PWD).
4. **SLA & Escalations**:
   - Deadlines automatically set at creation (HIGH: 24h, MEDIUM: 48h, LOW: 72h).
   - Dynamic check flags overdue tickets as `ESCALATED`.
5. **Analytics & Performance**:
   - Redis aggregation caching with 60s TTL (graceful fallback if Redis is offline).
   - Visual Recharts (Department bar chart, Priority pie chart, Status distribution).
6. **Citizen Experience & DevOps**:
   - Evidence photo upload support.
   - Post-resolution 1–5 star rating & feedback.
   - Docker & Docker Compose setup (`docker-compose up`).
   - GitHub Actions CI workflow running Pytest and Jest tests.

---

## 🛠️ Environment Configuration

Copy `.env.example` to `.env` in `backend/`:

```env
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/gov_grievance_db?retryWrites=true&w=majority
SECRET_KEY=supersecretkey_change_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
ANTHROPIC_API_KEY=your_anthropic_api_key_here
REDIS_URL=redis://localhost:6379/0
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
```

---

## 🔑 Demo Admin Credentials

| Username | Password | Role | Scope |
|---|---|---|---|
| `admin` | `admin123` | `super_admin` | All Departments |
| `water_admin` | `admin123` | `department_admin` | Water Supply Department |
| `elec_admin` | `admin123` | `department_admin` | Electricity Board |
| `pwd_admin` | `admin123` | `department_admin` | Public Works Department |
| `san_admin` | `admin123` | `department_admin` | Sanitation Department |

---

## 🐳 Docker Deployment

To launch the full stack locally via Docker Compose:

```bash
docker-compose up --build
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Swagger Docs**: `http://localhost:8000/docs`
- **Redis Cache**: `localhost:6379`

---

## 🧪 Testing

### Backend Pytest Suite
```bash
cd backend
pytest tests
```

### Frontend Jest Suite
```bash
cd frontend
npm test -- --watchAll=false
```

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/chat` | Conversational complaint intake (LLM analysis & intake) | Public (Rate-limited) |
| `GET` | `/conversation/{session_id}` | Retrieve multi-turn chat session thread | Public |
| `POST` | `/upload/evidence` | Upload photo or file evidence | Public |
| `POST` | `/ticket/{id}/feedback` | Submit 1–5 star rating & feedback | Public |
| `POST` | `/admin/login` | Admin login (sets httpOnly cookies) | Public |
| `POST` | `/admin/refresh` | Silent access token refresh via refresh cookie | Cookie |
| `GET` | `/admin/me` | Current authenticated admin profile | Cookie / Bearer |
| `POST` | `/admin/logout` | Clear authentication cookies | Cookie |
| `GET` | `/tickets` | Filtered & paginated ticket queue | Admin |
| `PUT` | `/ticket/{id}/status` | Update ticket status | Admin (RBAC check) |
| `GET` | `/analytics/overview` | Redis-cached aggregation stats | Admin |
| `GET` | `/health` | Live MongoDB & Redis status check | Public |

---

## 👩‍💻 Author

Manya Mahesh  
Information Science Engineering  
Full-stack & AI Enthusiast
