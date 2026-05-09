# AI Job Tracker Backend

Backend API for the AI Job Tracker portfolio project.

Built with **Node.js + Express**, using **PostgreSQL** for persistence, **JWT authentication** for protected user data, and the **OpenAI API** for AI-assisted job tracking features.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- pg
- bcrypt
- jsonwebtoken
- OpenAI API
- dotenv
- cors

## Main Features

- User registration
- User login
- JWT-based authentication
- Protected job CRUD endpoints
- Per-user job isolation through `user_id`
- Password hashing with bcrypt
- Input validation and normalization
- Unique job URL handling
- AI-powered endpoints:
  - job details suggestion
  - job data extraction from text or URL
- Safe OpenAI integration through backend proxy

## Database

### Users table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Jobs table

```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  job_url TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Migration Notes

Existing jobs were assigned to a temporary test user during the authentication migration:

```text
create users table
→ insert temporary user
→ add user_id to jobs
→ assign existing jobs to temporary user
→ make user_id required
```

This keeps old job data valid after introducing authentication.

## Authentication

### POST /auth/register

Creates a new user.

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Behavior:

- validates required fields
- hashes password with bcrypt
- stores email and password hash
- returns created user without password hash

Errors:

- `400` missing email or password
- `409` user already exists
- `500` server error

---

### POST /auth/login

Logs in an existing user.

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Behavior:

- validates credentials
- compares password with stored hash
- signs JWT with user id
- returns user and token

Response:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com"
  },
  "token": "jwt-token"
}
```

Errors:

- `400` missing email or password
- `401` invalid credentials
- `500` server error

---

### GET /auth/me

Returns the current authenticated user.

Requires:

```http
Authorization: Bearer <token>
```

Errors:

- `401` missing or invalid token
- `404` user not found
- `500` server error

## Protected Job Endpoints

All job endpoints require:

```http
Authorization: Bearer <token>
```

The backend reads the user id from the JWT and applies it to all job queries.

---

### GET /jobs

Returns jobs for the authenticated user only.

---

### POST /jobs

Creates a new job for the authenticated user.

Rules:

- `title`, `company`, and `job_url` are required
- `status` defaults to `applied`
- `job_url` is normalized
- duplicate job URLs return a conflict error

---

### PATCH /jobs/:id

Updates a job only if it belongs to the authenticated user.

Allowed fields:

- `title`
- `company`
- `status`
- `details`

Rules:

- unknown fields are rejected
- invalid statuses are rejected
- empty required fields are rejected
- `updated_at` is refreshed on update

---

### DELETE /jobs/:id

Deletes a job only if it belongs to the authenticated user.

## AI Endpoints

### POST /ai/suggest-details

Rewrites and shortens job details using OpenAI.

Request:

```json
{
  "details": "Long job notes..."
}
```

Response:

```json
{
  "suggestion": "Short improved version..."
}
```

---

### POST /ai/extract-job

Extracts structured job data from pasted text or URL.

Request:

```json
{
  "text": "optional pasted job text",
  "url": "optional job URL"
}
```

Response:

```json
{
  "job": {
    "title": "",
    "company": "",
    "details": ""
  }
}
```

Rules:

- at least one of `text` or `url` is required
- if only URL is provided, backend attempts to fetch and clean HTML
- OpenAI must return valid JSON
- missing or unclear fields are returned as empty strings

## Environment Variables

```env
DATABASE_URL=your_postgres_connection_string
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

```env
DATABASE_URL=postgresql://user:password@localhost:5432/job_tracker
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
```

### 3. Run database SQL

Run the initial schema and migration SQL files in order:

```text
init.sql
002_add_users_and_user_id.sql
```

### 4. Start server

```bash
node index.js
```

Server runs on:

```text
http://localhost:3000
```

## Deployment

- Backend: Render / Railway
- Database: Neon PostgreSQL

Required production environment variables:

```env
DATABASE_URL=production_database_url
OPENAI_API_KEY=production_openai_key
JWT_SECRET=strong_production_secret
```

## Current Limitations

- No password reset flow.
- No email verification.
- No refresh tokens.
- No rate limiting.
- No pagination.
- No formal migration tool yet, only manual SQL files.
- AI URL extraction is best-effort because many sites block server-side requests or require JavaScript rendering.

## Portfolio Context

This backend demonstrates practical fullstack behavior: authentication, protected data access, relational database design, backend validation, safe AI integration, and predictable API responses.
