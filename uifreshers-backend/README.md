# UI Freshers Companion — Backend API

FastAPI + MongoDB backend for the UI Freshers Companion webapp. Custom auth
(email/password + Google Sign-In) with JWT access tokens and rotating
refresh tokens — no third-party auth provider.

## Stack

- **FastAPI** — async web framework
- **MongoDB** via **Motor** (async driver)
- **python-jose** — JWT signing/verification
- **passlib[bcrypt]** — password hashing
- **google-auth** — verifies Google ID tokens server-side

## Project layout

```
app/
  main.py            FastAPI app, router registration, CORS, lifespan (DB connect)
  config.py          Settings loaded from .env (pydantic-settings)
  database.py        Mongo connection + index creation
  security.py        Password hashing, JWT + refresh token helpers
  dependencies.py     get_current_user / get_current_admin / get_optional_user
  models/            Informal reference docs describing Mongo document shapes
  schemas/           Pydantic request/response models
  routers/
    auth.py          register, login, google, refresh, logout, /auth/me
    users.py         profile, onboarding wizard, change password
    faculties.py     faculty CRUD (public GET, admin-only writes)
    departments.py   department CRUD
    courses.py       course CRUD (level, semester, units, CBT flags)
    guides.py        faculty/clearance guides CRUD
    resources.py     resource links (Google Drive etc.) CRUD
    opportunities.py scholarships / work-study / hackathons CRUD
    faqs.py          FAQ CRUD
    search.py        global search across faculties/departments/courses/guides
  seed/
    seed_data.py     Populates representative starter data
```

## Setup

1. **Create a virtual environment and install dependencies:**

   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Copy the environment template and fill in your values:**

   ```bash
   cp .env.example .env
   ```

   You need to fill in:
   - `MONGODB_URI` — your MongoDB Atlas (or local) connection string
   - `JWT_SECRET_KEY` — any long random string (e.g. `openssl rand -hex 32`)
   - `GOOGLE_CLIENT_ID` — from Google Cloud Console → APIs & Services →
     Credentials → OAuth 2.0 Client ID (type: Web application). The
     frontend uses the *same* client ID with Google Identity Services to
     get an `id_token`, which is what gets sent to `POST /api/auth/google`.
   - `ALLOWED_ORIGINS` — your frontend URL(s), comma separated
   - `ADMIN_BOOTSTRAP_EMAIL` (optional) — this email is auto-promoted to
     `is_admin: true` on register/first Google login, so you have a way to
     manage reference data (faculties, courses, guides, etc.) without
     touching the database directly.

3. **Run the seed script** (optional, but recommended for local dev so the
   frontend has real data to render):

   ```bash
   python -m app.seed.seed_data
   ```

4. **Run the dev server:**

   ```bash
   uvicorn app.main:app --reload
   ```

   API docs (Swagger UI) at `http://localhost:8000/docs`.

## Auth flow summary

- **Email sign-up**: `POST /api/auth/register` `{full_name, email, password}`
  → returns `{access_token, refresh_token}`.
- **Email sign-in**: `POST /api/auth/login` `{email, password}`.
- **Google sign-in**: frontend obtains a Google `id_token` via Google
  Identity Services, sends it to `POST /api/auth/google` `{id_token}`. If
  no account exists for that Google user, one is created automatically —
  **no separate signup step**, matching the product requirement that
  Google users never see a "create account" form. If an email/password
  account with the same email already exists, the Google identity is
  linked to it (`provider` becomes `"both"`).
- **Access tokens** are short-lived JWTs (default 60 min) sent as
  `Authorization: Bearer <token>`.
- **Refresh tokens** are opaque random strings, stored hashed in Mongo,
  rotated on every use (`POST /api/auth/refresh`), and expire after 7 days
  by default. `POST /api/auth/logout` revokes one.

## Admin-protected endpoints

All `POST`/`PATCH`/`DELETE` routes on faculties, departments, courses,
guides, resources, opportunities, and FAQs require `is_admin: true` on
the current user. `GET` routes are public. Set `ADMIN_BOOTSTRAP_EMAIL` in
`.env` before you register/sign in with your own account to get admin
rights automatically.

## Deploying

This is structured to deploy the same way your other FastAPI projects run
on Render: point the start command at `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
and set the same environment variables from `.env.example` in the Render
dashboard.
