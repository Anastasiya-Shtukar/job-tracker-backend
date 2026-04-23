# AI Job Tracker Backend

Backend API for the AI Job Tracker portfolio project.

This service is built with **Node.js + Express**, uses **PostgreSQL** for data storage, and exposes a small REST API for managing job applications. It also includes an AI endpoint that rewrites job details using the OpenAI API.

## Tech stack

- Node.js
- Express
- PostgreSQL
- `pg`
- OpenAI API
- dotenv
- cors

## What this backend does

- fetches all jobs from the database
- creates a new job entry
- updates an existing job
- deletes a job
- validates incoming data
- connects to PostgreSQL through `DATABASE_URL`
- calls OpenAI through a backend proxy so the frontend never sees the API key

## Project structure

```text
job-tracker-backend/
├── index.js
├── package.json
└── .gitignore
```

## Environment variables

Create a `.env` file in the project root.

Example:

```env
DATABASE_URL=your_neon_postgres_connection_string
OPENAI_API_KEY=your_openai_api_key
```

### Required variables

- `DATABASE_URL` - connection string for your Neon PostgreSQL database
- `OPENAI_API_KEY` - API key used for the AI suggestion endpoint

## Database

This project uses PostgreSQL.

Main table: `jobs`

Recommended schema:

```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Notes about the schema

- `id` is the unique identifier for each job
- `title` is required
- `company` is required
- `status` should contain one of these values:
  - `applied`
  - `interview`
  - `rejected`
- `details` is optional from the UI perspective, but the backend normalizes it to a string
- `updated_at` is refreshed on update requests

## API endpoints

### Health check

#### `GET /`

Returns a simple message to confirm the API is running.

Response:

```json
"API is running"
```

---

### Get all jobs

#### `GET /jobs`

Returns all rows from the `jobs` table.

Example response:

```json
[
  {
    "id": 1,
    "title": "Frontend Developer",
    "company": "Acme",
    "status": "applied",
    "details": "React, REST API, remote",
    "created_at": "2026-04-20T10:00:00.000Z",
    "updated_at": "2026-04-20T10:00:00.000Z"
  }
]
```

---

### Create a new job

#### `POST /jobs`

Request body:

```json
{
  "title": "Frontend Developer",
  "company": "Acme",
  "status": "applied",
  "details": "React, REST API, remote"
}
```

Rules:

- `title` is required
- `company` is required
- `status` must be one of: `applied`, `interview`, `rejected`
- if `status` is missing, the backend uses `applied`
- strings are trimmed before saving

Success response:

```json
{
  "job": {
    "id": 1,
    "title": "Frontend Developer",
    "company": "Acme",
    "status": "applied",
    "details": "React, REST API, remote",
    "created_at": "2026-04-20T10:00:00.000Z",
    "updated_at": "2026-04-20T10:00:00.000Z"
  }
}
```

---

### Delete a job

#### `DELETE /jobs/:id`

Deletes a job by id.

Success response:

```json
{
  "message": "Job deleted"
}
```

Possible errors:

- `404` if the job does not exist
- `500` if deletion fails

---

### Update a job

#### `PATCH /jobs/:id`

Allows partial updates.

Allowed fields:

- `title`
- `company`
- `status`
- `details`

Example request body:

```json
{
  "status": "interview"
}
```

Example request body:

```json
{
  "title": "Frontend Engineer",
  "company": "Acme",
  "details": "React, accessibility, API integration"
}
```

Rules:

- request body cannot be empty
- only allowed fields can be updated
- `status` must be one of: `applied`, `interview`, `rejected`
- `title` and `company` must be non-empty strings if provided
- `details` must be a string if provided
- strings are trimmed before saving
- `updated_at` is updated automatically

Possible errors:

- `400` invalid request body
- `404` job not found
- `500` failed to update job

---

### AI suggestion endpoint

#### `POST /ai/suggest-details`

This endpoint rewrites and shortens job details using the OpenAI API.

Request body:

```json
{
  "details": "Long job description or copied vacancy notes here"
}
```

What it does:

- validates that `details` is not empty
- sends the text to OpenAI
- asks the model to rewrite and shorten it
- returns a shorter suggestion for the frontend UI

Success response:

```json
{
  "suggestion": "Frontend role focused on React, API integration, and teamwork in a remote environment."
}
```

Possible errors:

- `400` empty request
- `500` failed to generate suggestion

## Validation rules

The backend currently supports these status values:

- `applied`
- `interview`
- `rejected`

Incoming strings are normalized with `.trim()` before being saved.

## How to run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Add environment variables

Create a `.env` file:

```env
DATABASE_URL=your_neon_postgres_connection_string
OPENAI_API_KEY=your_openai_api_key
```

### 3. Make sure the database table exists

Run the `CREATE TABLE jobs (...)` SQL statement in Neon.

### 4. Start the server

```bash
node index.js
```

The server runs on:

```text
http://localhost:3000
```

## Frontend connection

The frontend should use this backend through:

```env
VITE_API_URL=https://job-tracker-backend-ch5u.onrender.com
```

For production deployment, replace it with your deployed backend URL.

## Deployment notes

Recommended setup:

- **Frontend**: Vercel
- **Backend**: Render
- **Database**: Neon PostgreSQL

Why this setup:

- Vercel is a natural fit for the React frontend
- Render or Railway are simpler for a standard Express server
- Neon works well as a managed PostgreSQL database

## Current limitations

- no authentication yet
- no pagination yet
- no rate limiting yet
- no test suite yet
- no migrations yet
- AI feature depends on a valid OpenAI API key and available credits

## Portfolio context

This is part of the **AI Job Tracker** project built as a portfolio application.

The goal is not just CRUD, but a realistic product that shows:

- frontend and backend integration
- async UI states
- backend validation
- database persistence
- safe AI integration through a server-side proxy
