# 🎀 Maid Cafe Event Management System

A full stack web application for managing events, attendance, and carpooling for a Maid Cafe organization. Built with Next.js, Flask, and PostgreSQL.

---

## Tech Stack

**Frontend**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui

**Backend**
- Python / Flask
- Flask Blueprints (modular routing)
- JWT Authentication (httponly cookies)
- bcrypt (password hashing)

**Database**
- PostgreSQL
- psycopg2

---

## Features

### Auth
- Register / Login / Logout
- JWT authentication via httponly cookies
- Remember me (extends session to 30 days)
- Change password with current password verification
- Admin vs regular user roles

### Events
- Browse all events with pagination
- Search events by title or description (debounced)
- Filter by location
- Event status: Draft, Published, Cancelled
- Admins can create, edit, and delete events

### Attendance
- Sign up for events with status (Going, Maybe, Not Going)
- Select role: Driver, Passenger, or None
- Drivers can specify available seats
- Leave events
- Edit attendance details
- View only your events via "Show my events" toggle

### Account
- View and edit profile (first name, last name, email, username)
- Change password

---

## Project Structure

```
maid-cafe/
├── client/                  # Next.js frontend
│   └── app/
│       ├── events/          # Events page and components
│       │   ├── page.tsx     # Server component — fetches events
│       │   ├── EventCards.tsx
│       │   ├── EventFilters.tsx
│       │   ├── Pagination.tsx
│       │   ├── AddEvent.tsx
│       │   ├── EditEvent.tsx
│       │   ├── SignUpModal.tsx
│       │   └── EditAttendance.tsx
│       ├── login/           # Login and register pages
│       ├── account/         # Account settings page
│       ├── UserAuthentication.tsx  # Auth context provider
│       └── NavBar.tsx
│
└── server/                  # Flask backend
    ├── main.py              # App setup, CORS, error handlers
    ├── auth.py              # JWT create/verify
    ├── db.py                # Database connection
    ├── models.py            # Pydantic models
    ├── utils.py             # success_response, APIError
    ├── middleware.py        # require_auth, require_admin decorators
    ├── schema.sql           # Database schema
    ├── routes/
    │   ├── auth_routes.py   # /auth/login, /auth/me, /auth/logout
    │   ├── event_routes.py  # /events, /events/<id>
    │   ├── user_routes.py   # /users, /users/<id>
    │   └── attendance_routes.py  # /attendances/me, /attendances/<id>
    └── queries/
        ├── user_queries.py
        ├── event_queries.py
        ├── attendance_queries.py
        └── task_queries.py
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL

### Database Setup

Create a PostgreSQL database and run the schema:
```bash
psql -U postgres -d your_db_name -f server/schema.sql
```

### Backend Setup

```bash
cd server
python -m venv .venv
.venv/Scripts/activate  # Windows
source .venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

Create a `.env` file in the `server/` folder:
```
DATABASE_NAME=your_db_name
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_HOST=localhost
SECRET_KEY=your_secret_key
```

Run the server:
```bash
make backend
# or
python main.py
```

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

---

## API Overview

### Auth
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | /auth/login | Login | Public |
| GET | /auth/me | Get current user | Required |
| POST | /auth/logout | Logout | Public |

### Events
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | /events | Get all events (paginated) | Public |
| POST | /events | Create event | Admin only |
| GET | /events/<id> | Get event by id | Public |
| PATCH | /events/<id> | Edit event | Admin or creator |
| DELETE | /events/<id> | Delete event | Admin or creator |

### Users
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | /users | Register | Public |
| GET | /users/<id> | Get user | Public |
| PATCH | /users/<id> | Edit user | Owner or admin |
| DELETE | /users/<id> | Delete user | Owner or admin |

### Attendances
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | /attendances/me | Get my attendances | Required |
| POST | /attendances/me | Sign up for event | Required |
| PATCH | /attendances/<id> | Edit attendance | Owner only |
| DELETE | /attendances/<id> | Leave event | Owner only |

---

## Security
- Passwords hashed with bcrypt
- JWT stored in httponly cookies (not accessible by JavaScript)
- `require_auth` decorator protects all write routes
- `require_admin` decorator restricts admin-only actions
- Ownership checks prevent users from editing others' data
- Cascade deletes remove attendance records when an event is deleted
- Secrets stored in environment variables, never in source code

---

## Roadmap
- [ ] Email notifications (SendGrid)
- [ ] Image upload for events (Cloudinary)
- [ ] Forgot password flow
- [ ] Event comments/announcements
- [ ] Waitlist when event is full
- [ ] Admin dashboard
- [ ] Export attendee list as CSV
- [ ] Rate limiting
- [ ] Deploy (Vercel + Railway)
