# AI Job Tracker Backend

Backend API for the AI Job Tracker portfolio project.

Built with **Node.js + Express**, using **PostgreSQL** for persistence and **OpenAI API** for AI-assisted features.

---

## Tech stack

- Node.js
- Express
- PostgreSQL
- pg
- OpenAI API
- dotenv
- cors

---

## What this backend does

- CRUD operations for job tracking
- input validation and normalization
- unique constraint on job URLs
- AI-powered endpoints:
  - job details suggestion
  - job data extraction (text or URL)
- safe OpenAI integration via backend proxy

---

## Database

### Schema

    CREATE TABLE jobs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT,
      job_url TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

### Notes

- job_url is required and must be unique
- duplicate job entries are prevented at the database level
- strings are normalized before saving
- updated_at is updated on every modification

---

## API endpoints

### GET /jobs

Returns all jobs.

---

### POST /jobs

Creates a new job.

Rules:

- title, company, and job_url are required
- status defaults to applied
- job_url must be unique

Errors:

- 400 invalid input
- 409 duplicate job URL
- 500 server error

---

### PATCH /jobs/:id

Updates job fields:

- title
- company
- status
- details

---

### DELETE /jobs/:id

Deletes a job.

---

## AI endpoints

### POST /ai/suggest-details

Rewrites and shortens job details using OpenAI.

---

### POST /ai/extract-job

Extracts structured job data from:

- pasted job text
- or job URL (best-effort)

### Request

    {
      "text": "optional",
      "url": "optional"
    }

### Rules

- at least one of text or url must be provided
- if only URL is provided:
  - backend attempts to fetch page content
  - HTML is cleaned before sending to AI
- user always reviews extracted data before saving

### Response

    {
      "job": {
        "title": "",
        "company": "",
        "details": ""
      }
    }

---

## Limitations of URL extraction

URL extraction is best-effort only.

Limitations:

- some websites block server-side requests
- some pages require JavaScript rendering
- some platforms (e.g. LinkedIn) restrict access
- fetched HTML may not contain meaningful content

Because of this:

- extraction may fail
- user can always paste job text manually

---

## Environment variables

    DATABASE_URL=your_postgres_connection
    OPENAI_API_KEY=your_openai_key

---

## Running locally

    npm install
    node index.js

Server runs on:

    http://localhost:3000

---

## Deployment

- Backend: Render / Railway
- Database: Neon

---

## Current limitations

- no authentication yet
- no pagination
- no rate limiting
- no migrations system (manual SQL)
- limited scraping capability

---

## Portfolio context

This backend is part of a fullstack project focused on:

- real product behavior
- safe backend design
- AI integration with clear UX boundaries
