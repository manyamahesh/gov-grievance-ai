# AI-Based Government Grievance Management System

A full-stack AI-assisted complaint management system designed to streamline government grievance handling through intelligent classification, secure administration, and real-time analytics.

---

## 🚀 Project Overview

This system enables citizens to submit complaints which are automatically:

- Language detected
- Sentiment analyzed
- Priority assigned
- Department mapped

An admin dashboard allows authorized officials to:

- View complaints
- Filter and paginate tickets
- Update ticket status
- Analyze complaint trends using charts

The system is built with production-ready architecture principles including authentication, protected routes, aggregation pipelines, and clean API design.

---

## 🏗️ Architecture

Frontend (React)  
⬇  
Backend API (FastAPI)  
⬇  
MongoDB Atlas (Cloud Database)

AI classification is handled via NLP-based pre-trained models.

---

## 🛠️ Tech Stack

### Backend
- FastAPI
- MongoDB Atlas
- JWT Authentication
- Python
- Aggregation Pipelines
- Pre-trained NLP models

### Frontend
- React
- Axios
- Chart.js
- Protected Routes

### Deployment (Planned)
- Backend → Render
- Frontend → Vercel

---

## 🔐 Security Features

- JWT-based authentication
- Protected admin routes
- Token validation middleware
- Secure environment variable handling

---

## 📊 Features

- Complaint submission system
- AI-based automatic prioritization
- Department auto-routing
- Ticket status management
- Pagination and filtering
- Analytics dashboard with charts
- Secure admin login

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /chat | Submit complaint |
| GET | /conversation/{id} | Get session conversation |
| PUT | /ticket/{ticket_id}/status | Update ticket status |
| GET | /tickets | Paginated ticket list |
| GET | /analytics/overview | Complaint analytics |
| POST | /admin/login | Admin authentication |

---

## 🎯 Key Engineering Highlights

- Modular backend structure
- Service-layer abstraction
- MongoDB aggregation pipelines
- JWT token verification dependency injection
- Axios interceptor for auto-token injection
- ProtectedRoute pattern in React
- Clean Git repository with proper ignore rules

---

## 📌 Future Enhancements

- Real-time notifications
- Role-based access control
- Email alerts
- Advanced analytics visualization
- Model fine-tuning for domain-specific classification

---

## 👩‍💻 Author

Manya Mahesh  
Information Science Engineering  
Full-stack & AI enthusiast
